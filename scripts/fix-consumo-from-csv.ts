/**
 * Corregge SOLO bills.consumo a partire dai CSV rigenerati, senza reimportare
 * nulla e senza toccare alcun altro campo.
 *
 * Perche' e' sicuro:
 *   - match esclusivamente su bills.idboll (UNIQUE, popolato su tutte le righe)
 *   - unica colonna scritta: consumo. pdf_url / import_log_id / user_id /
 *     importo / date / status / import_logs NON vengono mai scritti
 *   - nessun INSERT e nessun DELETE: solo UPDATE ... WHERE idboll IN (...)
 *     (le bollette presenti nel CSV ma non a DB vengono segnalate, non create)
 *   - controllo incrociato su nome_pdf: se CSV e DB non concordano sul nome file
 *     per lo stesso idboll la riga viene scartata (protegge da CSV con layout
 *     colonne diverso)
 *   - prima di scrivere produce sempre un file di rollback (idboll,consumo)
 *     riapplicabile con --restore
 *
 * Uso:
 *   npm run fix:consumo -- --csv "C:\path\cartella-o-file" --inspect
 *   npm run fix:consumo -- --csv "C:\path\cartella-o-file"            # dry-run
 *   npm run fix:consumo -- --csv "C:\path\cartella-o-file" --apply
 *   npm run fix:consumo -- --restore "tmp/consumo-rollback-<ts>.csv" --apply
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (.env / .env.local)
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse/sync'
import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import { StandardCsvAdapter } from '../src/lib/admin/adapters/standard-csv'

dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const OUT_DIR = path.resolve(__dirname, '../tmp')
const CHUNK = 500

interface Args {
    src?: string
    restore?: string
    apply: boolean
    inspect: boolean
    lastWins: boolean
}

function parseArgs(argv: string[]): Args {
    const a: Args = { apply: false, inspect: false, lastWins: false }
    for (let i = 0; i < argv.length; i++) {
        const v = argv[i]
        if (v === '--csv') a.src = argv[++i]
        else if (v === '--restore') a.restore = argv[++i]
        else if (v === '--apply') a.apply = true
        else if (v === '--inspect') a.inspect = true
        else if (v === '--last-wins') a.lastWins = true
    }
    if (!a.src && !a.restore) {
        console.error('Uso: npm run fix:consumo -- --csv <file-o-cartella> [--inspect] [--apply] [--last-wins]')
        console.error('     npm run fix:consumo -- --restore <rollback.csv> --apply')
        process.exit(1)
    }
    return a
}

function serviceClient(): SupabaseClient {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
        console.error('Errore: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY mancanti')
        process.exit(1)
    }
    return createClient(url, key)
}

/** Tutti i .csv sotto src (ricorsivo se cartella), ordinati per percorso. */
function collectCsv(src: string): string[] {
    const root = path.resolve(src)
    if (!fs.existsSync(root)) {
        console.error(`Percorso non trovato: ${root}`)
        process.exit(1)
    }
    if (!fs.statSync(root).isDirectory()) return [root]
    const out: string[] = []
    const walk = (dir: string) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, e.name)
            if (e.isDirectory()) walk(p)
            else if (e.name.toLowerCase().endsWith('.csv')) out.push(p)
        }
    }
    walk(root)
    return out.sort()
}

function readCsvText(file: string): string {
    const buf = fs.readFileSync(file)
    if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.toString('utf8').slice(1)
    const asUtf8 = buf.toString('utf8')
    return asUtf8.includes('\uFFFD') ? buf.toString('latin1') : asUtf8
}

const round2 = (n: number) => Math.round(n * 100) / 100

async function chunked<T>(items: T[], size: number, fn: (c: T[], i: number) => Promise<void>) {
    for (let i = 0; i < items.length; i += size) await fn(items.slice(i, i + size), i)
}

/** Mostra le prime righe grezze con indice colonna: serve a validare il layout. */
function inspectFiles(files: string[]) {
    const LABEL = ['CIF', 'CFPIVA', 'NOMEPDF', 'SERVIZIO', 'EMISSIONE', 'SCADENZA', 'IMPORTO', 'CONSUMO', 'MPxx/tipo', 'tipo']
    for (const f of files) {
        const rows = parse(readCsvText(f), {
            columns: false,
            skip_empty_lines: true,
            trim: true,
            relax_quotes: true,
            relax_column_count: true,
            delimiter: ';',
            to: 3,
        }) as string[][]
        console.log(`\n=== ${path.relative(process.cwd(), f)} ===`)
        rows.forEach((r, n) => {
            console.log(`  riga ${n + 1} (${r.length} colonne):`)
            r.forEach((c, i) => console.log(`    [${i}] ${LABEL[i] ? LABEL[i] + ' = ' : ''}${JSON.stringify(c)}`))
        })
    }
    console.log('\nVerifica che [7] sia davvero il CONSUMO in tutti i file prima di procedere.')
}

interface Want { consumo: number; nome_pdf: string; file: string }

async function buildWants(files: string[], lastWins: boolean) {
    const adapter = new StandardCsvAdapter()
    const wants = new Map<number, Want>()
    const conflicts: string[] = []
    const conflictIds = new Set<number>()
    let rowsParsed = 0
    let noIdboll = 0

    for (const file of files) {
        const { bills, errors } = await adapter.parse(readCsvText(file))
        const label = path.basename(file)
        for (const b of bills as unknown as Array<{ idboll: number | null; consumo: number; nome_pdf: string }>) {
            rowsParsed++
            if (typeof b.idboll !== 'number') { noIdboll++; continue }
            const next: Want = { consumo: round2(Number(b.consumo) || 0), nome_pdf: b.nome_pdf, file: label }
            const prev = wants.get(b.idboll)
            if (prev && prev.consumo !== next.consumo) {
                conflictIds.add(b.idboll)
                if (conflicts.length < 20) {
                    conflicts.push(`idboll ${b.idboll}: ${prev.consumo} (${prev.file}) vs ${next.consumo} (${next.file})`)
                }
                if (!lastWins) continue
            }
            wants.set(b.idboll, next)
        }
        console.log(`  ${label} -> ${bills.length} righe${errors.length ? ` (${errors.length} errori parsing)` : ''}`)
    }
    if (!lastWins) for (const id of conflictIds) wants.delete(id)
    return { wants, conflicts, conflictIds, rowsParsed, noIdboll }
}

interface Change { idboll: number; from: number; to: number }

async function diffAgainstDb(sb: SupabaseClient, wants: Map<number, Want>) {
    const changes: Change[] = []
    const foundIds = new Set<number>()
    const pdfMismatch: string[] = []
    let pdfMismatchCount = 0
    let unchanged = 0
    const ids = [...wants.keys()]

    await chunked(ids, CHUNK, async (chunk, i) => {
        const { data, error } = await sb.from('bills').select('idboll, consumo, nome_pdf').in('idboll', chunk)
        if (error) throw new Error(`Lettura bills: ${error.message}`)
        for (const row of data ?? []) {
            const id = row.idboll as number
            const want = wants.get(id)
            if (!want) continue
            foundIds.add(id)
            if (want.nome_pdf && row.nome_pdf && want.nome_pdf !== row.nome_pdf) {
                pdfMismatchCount++
                if (pdfMismatch.length < 20) pdfMismatch.push(`idboll ${id}: CSV "${want.nome_pdf}" vs DB "${row.nome_pdf}"`)
                continue
            }
            const from = round2(Number(row.consumo) || 0)
            if (from === want.consumo) { unchanged++; continue }
            changes.push({ idboll: id, from, to: want.consumo })
        }
        process.stdout.write(`\r  confronto ${Math.min(i + CHUNK, ids.length)}/${ids.length} - da aggiornare: ${changes.length}   `)
    })
    process.stdout.write('\n')

    const missingInDb = ids.filter((id) => !foundIds.has(id))
    return { changes, unchanged, missingInDb, pdfMismatch, pdfMismatchCount, matched: foundIds.size }
}

function writeReports(changes: Change[]): { rollback: string; diff: string } {
    fs.mkdirSync(OUT_DIR, { recursive: true })
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const rollback = path.join(OUT_DIR, `consumo-rollback-${ts}.csv`)
    const diff = path.join(OUT_DIR, `consumo-changes-${ts}.csv`)
    fs.writeFileSync(rollback, 'idboll,consumo\n' + changes.map((c) => `${c.idboll},${c.from}`).join('\n') + '\n', 'utf8')
    fs.writeFileSync(diff, 'idboll,consumo_attuale,consumo_nuovo\n' + changes.map((c) => `${c.idboll},${c.from},${c.to}`).join('\n') + '\n', 'utf8')
    return { rollback, diff }
}

/**
 * Applica le modifiche raggruppando per valore: un UPDATE per (valore, blocco di
 * 500 idboll). Nessun INSERT, quindi nessun rischio di creare righe vuote.
 */
async function applyChanges(sb: SupabaseClient, changes: Change[]): Promise<{ updated: number; errors: string[] }> {
    const byValue = new Map<number, number[]>()
    for (const c of changes) {
        const list = byValue.get(c.to) ?? []
        list.push(c.idboll)
        byValue.set(c.to, list)
    }
    const errors: string[] = []
    let updated = 0
    let group = 0
    for (const [value, ids] of byValue) {
        group++
        await chunked(ids, CHUNK, async (chunk) => {
            const { error } = await sb.from('bills').update({ consumo: value }).in('idboll', chunk)
            if (error) errors.push(`consumo=${value} (${chunk.length} id): ${error.message}`)
            else updated += chunk.length
        })
        if (group % 25 === 0 || group === byValue.size) {
            process.stdout.write(`\r  scrittura ${group}/${byValue.size} valori distinti - righe aggiornate: ${updated}   `)
        }
    }
    process.stdout.write('\n')
    return { updated, errors }
}

async function restore(sb: SupabaseClient, file: string, apply: boolean) {
    const lines = fs.readFileSync(path.resolve(file), 'utf8').trim().split(/\r?\n/)
    const changes: Change[] = []
    for (const line of lines.slice(1)) {
        const [id, val] = line.split(',')
        const idboll = Number(id)
        const consumo = Number(val)
        if (!Number.isFinite(idboll) || !Number.isFinite(consumo)) continue
        changes.push({ idboll, from: NaN, to: round2(consumo) })
    }
    console.log(`Rollback: ${changes.length} righe da ripristinare da ${path.basename(file)}`)
    if (!apply) { console.log('[dry-run] niente scritto. Aggiungi --apply per ripristinare.'); return }
    const res = await applyChanges(sb, changes)
    console.log(`Ripristinate: ${res.updated}, errori: ${res.errors.length}`)
    if (res.errors.length) console.log(res.errors.slice(0, 10).join('\n'))
}

async function main() {
    const args = parseArgs(process.argv.slice(2))
    const sb = serviceClient()

    if (args.restore) return restore(sb, args.restore, args.apply)

    const files = collectCsv(args.src!)
    console.log(`File CSV trovati: ${files.length}${args.apply ? '' : '   [DRY RUN]'}`)
    if (files.length === 0) { console.error('Nessun CSV trovato.'); process.exit(1) }

    if (args.inspect) return inspectFiles(files)

    console.log('\nParsing CSV...')
    const { wants, conflicts, conflictIds, rowsParsed, noIdboll } = await buildWants(files, args.lastWins)

    const { count: dbTotal } = await sb.from('bills').select('*', { count: 'exact', head: true })

    console.log(`\nRighe CSV lette:            ${rowsParsed}`)
    console.log(`Senza idboll (scartate):    ${noIdboll}`)
    console.log(`idboll univoci nel CSV:     ${wants.size}`)
    if (conflictIds.size) {
        console.log(`\n[!] idboll con consumo discordante tra file: ${conflictIds.size}` +
            (args.lastWins ? " (--last-wins: vince l'ultimo file)" : ' -> ESCLUSI dall\'aggiornamento'))
        console.log(conflicts.map((c) => '   ' + c).join('\n'))
    }

    console.log('\nConfronto con il DB...')
    const d = await diffAgainstDb(sb, wants)

    const dec = d.changes.filter((c) => c.to < c.from).length
    const inc = d.changes.length - dec
    const zeroed = d.changes.filter((c) => c.to === 0 && c.from !== 0).length
    const unzeroed = d.changes.filter((c) => c.from === 0 && c.to !== 0).length
    const top = [...d.changes].sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from)).slice(0, 10)

    console.log(`\n- Anteprima -
  Bollette a DB (totale):     ${dbTotal}
  Trovate a DB dal CSV:       ${d.matched}
  Non presenti a DB:          ${d.missingInDb.length}   (NON verranno create)
  Non coperte dal CSV:        ${(dbTotal ?? 0) - d.matched}   (restano col valore attuale)
  nome_pdf discordante:       ${d.pdfMismatchCount}   (scartate per sicurezza)
  consumo gia' corretto:      ${d.unchanged}
  DA AGGIORNARE:              ${d.changes.length}   (in aumento ${inc} / in calo ${dec})
    nuovo valore 0:           ${zeroed}
    da 0 a valore:            ${unzeroed}
`)
    if (d.pdfMismatch.length) console.log('Esempi nome_pdf discordante:\n' + d.pdfMismatch.map((s) => '   ' + s).join('\n') + '\n')
    if (d.missingInDb.length) console.log(`Esempi idboll assenti a DB: ${d.missingInDb.slice(0, 15).join(', ')}\n`)
    if (top.length) {
        console.log('Scostamenti maggiori:')
        for (const c of top) console.log(`   idboll ${c.idboll}: ${c.from} -> ${c.to}`)
        console.log('')
    }

    if (d.changes.length === 0) { console.log('Nulla da fare.'); return }

    const { rollback, diff } = writeReports(d.changes)
    console.log(`Report scritti:\n   modifiche: ${path.relative(process.cwd(), diff)}\n   rollback:  ${path.relative(process.cwd(), rollback)}`)

    if (!args.apply) {
        console.log('\n[dry-run] niente scritto sul DB. Rilancia con --apply per applicare.')
        return
    }

    console.log('\nScrittura (solo colonna consumo)...')
    const res = await applyChanges(sb, d.changes)
    console.log(`\nFatto. Righe aggiornate: ${res.updated}, errori: ${res.errors.length}`)
    if (res.errors.length) console.log(res.errors.slice(0, 20).join('\n'))
    console.log(`\nPer annullare: npm run fix:consumo -- --restore "${path.relative(process.cwd(), rollback)}" --apply`)
}

main().catch((e) => { console.error('\nFallito:', e instanceof Error ? e.message : e); process.exit(1) })
