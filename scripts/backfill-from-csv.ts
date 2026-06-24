/**
 * Backfill missing fields from corrected (OL-regenerated) CSV exports — WITHOUT
 * re-uploading PDFs and WITHOUT overwriting data that's already there.
 *
 * Fills ONLY where currently empty:
 *   bills.billing_type      (Tipo: S/A)           — matched by idboll
 *   bills.expected_method   (Metodo: MP..)        — matched by idboll
 *   profiles.codice_fiscale (col 1, 16-char CF)   — matched by codice_cliente
 *   profiles.partita_iva    (col 1, 11-digit PIVA)— matched by codice_cliente
 *
 * Never changes importi, dates, pdf_url, or any non-empty value.
 *
 * Usage:
 *   npm run backfill -- --csv "C:\path\to\Xml20260316.csv" --dry-run
 *   npm run backfill -- --csv "C:\path\to\folder-of-csvs"
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (.env / .env.local)
 */
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { StandardCsvAdapter } from '../src/lib/admin/adapters/standard-csv'

dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) {
    console.error('Error: missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}
const supabase = createClient(supabaseUrl, serviceRoleKey)

interface Args { src: string; dryRun: boolean }
function parseArgs(argv: string[]): Args {
    const a: Partial<Args> = { dryRun: false }
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--csv') a.src = argv[++i]
        else if (argv[i] === '--dry-run') a.dryRun = true
    }
    if (!a.src) { console.error('Usage: npm run backfill -- --csv <file-or-folder> [--dry-run]'); process.exit(1) }
    return a as Args
}

function csvFilesFrom(src: string): string[] {
    const resolved = path.resolve(src)
    if (!fs.existsSync(resolved)) { console.error(`Not found: ${resolved}`); process.exit(1) }
    if (fs.statSync(resolved).isDirectory()) {
        return fs.readdirSync(resolved).filter(f => f.toLowerCase().endsWith('.csv')).map(f => path.join(resolved, f))
    }
    return [resolved]
}

/** Decide whether a column-1 value is a Codice Fiscale or a Partita IVA. */
function classifyFiscal(value: string | null): { cf?: string; piva?: string } {
    if (!value) return {}
    const v = value.trim().toUpperCase()
    if (/^\d{11}$/.test(v)) return { piva: v }                 // 11 digits → Partita IVA
    if (/^[A-Z0-9]{16}$/.test(v) && /[A-Z]/.test(v)) return { cf: v } // 16 alphanumeric w/ letters → CF
    return {}                                                  // anything else: ambiguous, skip
}

async function chunked<T>(items: T[], size: number, fn: (chunk: T[]) => Promise<void>) {
    for (let i = 0; i < items.length; i += size) await fn(items.slice(i, i + size))
}

async function main() {
    const args = parseArgs(process.argv.slice(2))
    const files = csvFilesFrom(args.src)
    console.log(`CSV files: ${files.length}${args.dryRun ? '   [DRY RUN]' : ''}`)

    const adapter = new StandardCsvAdapter()

    // desired bill fields by idboll; desired profile fields by codice_cliente
    const billWants = new Map<number, { billing_type: string | null; expected_method: string | null }>()
    const profWants = new Map<string, { cf?: string; piva?: string }>()

    for (const file of files) {
        const text = fs.readFileSync(file, 'utf8')
        const { bills } = await adapter.parse(text)
        for (const b of bills as any[]) {
            if (typeof b.idboll === 'number') {
                billWants.set(b.idboll, { billing_type: b.billing_type ?? null, expected_method: b.expected_method ?? null })
            }
            if (b.codice_cliente) {
                const { cf, piva } = classifyFiscal(b.cfpi)
                if (cf || piva) {
                    const cur = profWants.get(b.codice_cliente) || {}
                    profWants.set(b.codice_cliente, { cf: cf ?? cur.cf, piva: piva ?? cur.piva })
                }
            }
        }
        console.log(`  parsed ${file.split(/[\\/]/).pop()} → ${bills.length} rows`)
    }
    console.log(`\nUnique bills in CSV: ${billWants.size}   unique clients with CF/IVA: ${profWants.size}\n`)

    // ---- 1. Bills: fill empty billing_type / expected_method ----
    let billUpdates = 0
    const idbolls = [...billWants.keys()]
    await chunked(idbolls, 500, async (chunk) => {
        const { data, error } = await supabase.from('bills').select('idboll, billing_type, expected_method').in('idboll', chunk)
        if (error) { console.error('bills select error:', error.message); return }
        for (const row of data || []) {
            const want = billWants.get(row.idboll as number)!
            const patch: Record<string, string> = {}
            if (!row.billing_type && want.billing_type) patch.billing_type = want.billing_type
            if (!row.expected_method && want.expected_method) patch.expected_method = want.expected_method
            if (Object.keys(patch).length === 0) continue
            billUpdates++
            if (!args.dryRun) {
                const { error: upErr } = await supabase.from('bills').update(patch).eq('idboll', row.idboll)
                if (upErr) console.error(`bill ${row.idboll}:`, upErr.message)
            }
        }
        process.stdout.write(`\rBills checked… updates so far: ${billUpdates}`)
    })
    process.stdout.write('\n')

    // ---- 2. Profiles: fill empty codice_fiscale / partita_iva ----
    let profUpdates = 0
    const codes = [...profWants.keys()]
    await chunked(codes, 500, async (chunk) => {
        const { data, error } = await supabase.from('profiles').select('id, codice_cliente, codice_fiscale, partita_iva').in('codice_cliente', chunk)
        if (error) { console.error('profiles select error:', error.message); return }
        for (const row of data || []) {
            const want = profWants.get(row.codice_cliente as string)
            if (!want) continue
            const patch: Record<string, string> = {}
            if (!row.codice_fiscale && want.cf) patch.codice_fiscale = want.cf
            if (!row.partita_iva && want.piva) patch.partita_iva = want.piva
            if (Object.keys(patch).length === 0) continue
            profUpdates++
            if (!args.dryRun) {
                const { error: upErr } = await supabase.from('profiles').update(patch).eq('id', row.id)
                if (upErr) console.error(`profile ${row.codice_cliente}:`, upErr.message)
            }
        }
        process.stdout.write(`\rProfiles checked… updates so far: ${profUpdates}`)
    })
    process.stdout.write('\n\n')

    console.log('=== Done ===')
    console.log(`Bills backfilled (Tipo/Metodo): ${billUpdates}`)
    console.log(`Profiles backfilled (CF/PIVA):  ${profUpdates}`)
    if (args.dryRun) console.log('\n[dry-run] nothing was written. Re-run without --dry-run to apply.')
}

main().catch((err) => { console.error('\nFailed:', err instanceof Error ? err.message : err); process.exit(1) })
