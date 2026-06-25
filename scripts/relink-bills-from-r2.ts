/**
 * Insert bills from the CSVs and link them to PDFs that are ALREADY in R2 —
 * WITHOUT re-uploading anything.
 *
 * Why: a batch's PDFs upload to R2 under its import_logs.r2_path even when the
 * bill INSERT fails (or hasn't run yet). Re-running the admin uploader would
 * re-upload every PDF under a brand-new importId. This script instead creates
 * the missing bill rows and sets bills.pdf_url to the existing R2 object key
 * ({r2_path}/{nome_pdf}), so the PDFs are reused as-is.
 *
 * Matching: CSV "XmlYYYYMMDD.csv"  ↔  import_logs.archive_name
 * "Clienti_Singoli_XmlYYYYMMDD.7z" (status=completed) → r2_path = R2 prefix.
 *
 * - Skips bills whose idboll already exists (idempotent / safe to re-run).
 * - Skips the cfpi field (no longer used).
 * - Only links pdf_url for PDFs that actually exist in R2 (verified by listing);
 *   a missing PDF leaves pdf_url null so it can be uploaded later.
 *
 * Usage:
 *   npm run relink -- --csv "Z:\...\Risultato" --dry-run
 *   npm run relink -- --csv "Z:\...\Risultato"
 */
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { StandardCsvAdapter } from '../src/lib/admin/adapters/standard-csv'

dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

// r2.ts reads R2_* env vars at module-eval time, so it MUST be imported only
// AFTER dotenv has populated process.env — hence this dynamic import.
type R2 = typeof import('../src/lib/r2')
let r2: R2
async function loadR2(): Promise<R2> { return (r2 ??= await import('../src/lib/r2')) }

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
    if (!a.src) { console.error('Usage: npm run relink -- --csv <file-or-folder> [--dry-run]'); process.exit(1) }
    return a as Args
}

function csvFilesFrom(src: string): string[] {
    const resolved = path.resolve(src)
    if (!fs.existsSync(resolved)) { console.error(`Not found: ${resolved}`); process.exit(1) }
    if (fs.statSync(resolved).isDirectory()) {
        return fs.readdirSync(resolved).filter(f => /^xml\d{8}.*\.csv$/i.test(f)).map(f => path.join(resolved, f)).sort()
    }
    return [resolved]
}

// Mirror the upload route's filename sanitisation so the R2 key matches exactly.
function sanitizeFilename(rawName: string): string {
    return rawName.replace(/[^A-Za-z0-9._\- ]/g, '_')
}

async function loadProfileMap(): Promise<Map<string, string>> {
    const map = new Map<string, string>()
    const pageSize = 1000
    for (let page = 0; ; page++) {
        const { data, error } = await supabase
            .from('profiles').select('id, codice_cliente')
            .range(page * pageSize, (page + 1) * pageSize - 1)
        if (error) throw new Error(`profiles fetch: ${error.message}`)
        if (!data || data.length === 0) break
        for (const p of data) if (p.codice_cliente) map.set(String(p.codice_cliente).trim(), p.id)
        if (data.length < pageSize) break
    }
    return map
}

/** Resolve the R2 prefix (import_logs.r2_path) for a CSV's date token. */
async function resolveR2Prefix(token: string): Promise<string | null> {
    const { data, error } = await supabase
        .from('import_logs')
        .select('r2_path, created_at')
        .eq('archive_name', `Clienti_Singoli_Xml${token}.7z`)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
    if (error) { console.error(`  import_logs lookup error: ${error.message}`); return null }
    return data && data.length > 0 ? (data[0].r2_path as string) : null
}

async function main() {
    const args = parseArgs(process.argv.slice(2))
    const files = csvFilesFrom(args.src)
    console.log(`CSV files: ${files.length}${args.dryRun ? '   [DRY RUN]' : ''}\n`)

    const adapter = new StandardCsvAdapter()
    const clientMap = await loadProfileMap()
    console.log(`Loaded ${clientMap.size} profiles for user linking\n`)

    let totalInserted = 0, totalLinked = 0, totalSkippedExisting = 0, totalMissingPdf = 0, batchesNoR2 = 0

    for (const file of files) {
        const base = path.basename(file)
        const token = base.match(/(\d{8})/)?.[1]
        if (!token) { console.warn(`! ${base}: no date token, skipped`); continue }

        const prefix = await resolveR2Prefix(token)
        // No PDFs in R2 for this batch → relinking can't help. Leave it for a
        // normal CSV+7z upload (which uploads the PDFs and inserts the bills).
        if (!prefix) {
            batchesNoR2++
            console.log(`${base}: SKIPPED — no PDFs in R2 yet (upload its 7z via the admin uploader)`)
            continue
        }

        const text = fs.readFileSync(file, 'utf8')
        const { bills } = await adapter.parse(text)

        // Existing idbolls for this CSV → skip (idempotent).
        const idbolls = bills.map(b => (b as any).idboll).filter((n): n is number => typeof n === 'number' && n > 0)
        const existing = new Set<number>()
        for (let i = 0; i < idbolls.length; i += 1000) {
            const chunk = idbolls.slice(i, i + 1000)
            const { data } = await supabase.from('bills').select('idboll').in('idboll', chunk)
            data?.forEach(r => { if (typeof r.idboll === 'number') existing.add(r.idboll) })
        }

        // R2 keys present for this batch (for accurate pdf_url linking).
        let r2Keys: Set<string> | null = null
        try { r2Keys = await (await loadR2()).listKeysWithPrefix(prefix) } catch (e) { console.warn(`  R2 list failed for ${prefix}: ${e instanceof Error ? e.message : e}`) }

        const seen = new Set<number>()
        let inserted = 0, linked = 0, missingPdf = 0
        const rows: Record<string, unknown>[] = []
        for (const b of bills as any[]) {
            const idboll = typeof b.idboll === 'number' ? b.idboll : null
            if (idboll !== null) {
                if (existing.has(idboll) || seen.has(idboll)) continue
                seen.add(idboll)
            }
            let pdf_url: string | null = null
            if (b.nome_pdf) {
                const key = `${prefix}/${sanitizeFilename(b.nome_pdf)}`  // matches buildInvoiceKey(filename, prefix)
                // Only link if the object is actually in R2 (verified by listing).
                if (r2Keys && r2Keys.has(key)) { pdf_url = key; linked++ } else { missingPdf++ }
            }
            rows.push({
                idboll,
                user_id: b.codice_cliente ? (clientMap.get(b.codice_cliente) ?? null) : null,
                codice_cliente: b.codice_cliente,
                nome_pdf: b.nome_pdf,
                tipo_servizio: b.tipo_servizio || 'ACQUA',
                data_emissione: b.data_emissione,
                scadenza: b.scadenza,
                importo: b.importo,
                consumo: b.consumo,
                cif: b.cif,
                billing_type: b.billing_type ?? null,
                expected_method: b.expected_method ?? null,
                pdf_url,
                import_log_id: prefix,           // FK → import_logs.r2_path (null if no batch)
                // cfpi intentionally omitted
            })
            inserted++
        }

        if (!args.dryRun && rows.length > 0) {
            for (let i = 0; i < rows.length; i += 500) {
                const { error } = await supabase.from('bills').insert(rows.slice(i, i + 500))
                if (error) console.error(`  insert error (${base}): ${error.message}`)
            }
        }

        totalInserted += inserted; totalLinked += linked; totalMissingPdf += missingPdf
        totalSkippedExisting += (bills.length - inserted)
        console.log(`${base}: +${inserted} bills (linked ${linked}, no-pdf ${missingPdf}, skip-existing ${bills.length - inserted})`)
    }

    console.log(`\n=== ${args.dryRun ? 'DRY RUN — ' : ''}Done ===`)
    console.log(`Bills inserted:        ${totalInserted}`)
    console.log(`PDFs linked (in R2):   ${totalLinked}`)
    console.log(`Bills w/o PDF in R2:   ${totalMissingPdf}`)
    console.log(`Skipped (already in):  ${totalSkippedExisting}`)
    console.log(`CSVs with no R2 batch: ${batchesNoR2}`)
    if (args.dryRun) console.log('\n[dry-run] nothing written. Re-run without --dry-run to apply.')
}

main().catch((err) => { console.error('\nFailed:', err instanceof Error ? err.message : err); process.exit(1) })
