/**
 * Corregge UN SOLO campo delle bollette già importate a partire dai CSV
 * rigenerati, senza reimportare nulla e senza toccare i PDF su R2.
 *
 * Stesso motore dell'opzione 4 di `npm run import` (src/lib/admin/import/
 * field-fix-core.ts): match su bills.idboll, una sola colonna scritta, solo
 * UPDATE, rollback sempre generato. Vedi il core per le invarianti complete.
 *
 * Uso:
 *   npm run fix:field                                                  # elenco campi
 *   npm run fix:field -- --field consumo --csv "C:\dir" --inspect      # layout colonne
 *   npm run fix:field -- --field consumo --csv "C:\dir"                # dry-run
 *   npm run fix:field -- --field consumo --csv "C:\dir" --apply         # scrittura
 *   npm run fix:consumo -- --csv "C:\dir"                              # alias del campo consumo
 *   npm run fix:field -- --restore "tmp/consumo-rollback-<ts>.csv" --apply
 *
 * Flag: --apply (scrive), --inspect (mostra le colonne), --last-wins (in caso di
 * idboll ripetuto fra file vince l'ultimo), --allow-empty (scrive NULL dove il
 * CSV è vuoto: per default quelle righe vengono saltate).
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (.env / .env.local)
 */
import dotenv from 'dotenv'
import path from 'node:path'

dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const OUT_DIR = path.resolve(__dirname, '../tmp')

interface Args {
    field?: string
    src?: string
    restore?: string
    apply: boolean
    inspect: boolean
    lastWins: boolean
    allowEmpty: boolean
}

function parseArgs(argv: string[]): Args {
    const a: Args = { apply: false, inspect: false, lastWins: false, allowEmpty: false }
    for (let i = 0; i < argv.length; i++) {
        const v = argv[i]
        if (v === '--field') a.field = argv[++i]
        else if (v === '--csv') a.src = argv[++i]
        else if (v === '--restore') a.restore = argv[++i]
        else if (v === '--apply') a.apply = true
        else if (v === '--inspect') a.inspect = true
        else if (v === '--last-wins') a.lastWins = true
        else if (v === '--allow-empty') a.allowEmpty = true
    }
    return a
}

async function main() {
    const args = parseArgs(process.argv.slice(2))

    // Import dinamici: dotenv deve aver popolato process.env prima dei client.
    const { createServiceClient } = await import('../src/lib/admin/import/client')
    const core = await import('../src/lib/admin/import/field-fix-core')
    const report = await import('../src/lib/admin/import/field-fix-report')
    const { collectCsvFiles, stripQuotes } = await import('../src/lib/admin/import/helpers')

    const usage = () => {
        console.log('Uso: npm run fix:field -- --field <campo> --csv <file-o-cartella> [--inspect] [--apply] [--last-wins] [--allow-empty]')
        console.log('     npm run fix:field -- --restore <rollback.csv> --apply\n')
        console.log('Campi correggibili:')
        for (const f of core.FIXABLE_FIELDS) console.log(`  ${f.key.padEnd(16)} ${f.label}  (${f.hint})`)
        console.log('\nCampi bloccati (mai scrivibili da qui):')
        for (const [k, why] of Object.entries(core.BLOCKED_FIELDS)) console.log(`  ${k.padEnd(16)} ${why}`)
    }

    const sb = createServiceClient()

    // ---- Rollback ----
    if (args.restore) {
        const { spec, changes } = report.readRollback(stripQuotes(args.restore))
        console.log(`Rollback "${spec.key}": ${changes.length} righe da ripristinare.`)
        if (!args.apply) { console.log('[dry-run] niente scritto. Aggiungi --apply.'); return }
        const res = await core.applyFieldFix(sb, spec, changes, (g, tot, up) => {
            process.stdout.write(`\r  scrittura ${g}/${tot} valori distinti - righe: ${up}   `)
        })
        process.stdout.write('\n')
        console.log(`Ripristinate: ${res.updated}, errori: ${res.errors.length}`)
        if (res.errors.length) console.log(res.errors.slice(0, 10).join('\n'))
        return
    }

    if (!args.field || !args.src) { usage(); process.exit(args.field || args.src ? 1 : 0) }

    const spec = core.getFieldSpec(args.field)
    if (!spec) {
        const why = core.BLOCKED_FIELDS[args.field.trim().toLowerCase()]
        console.error(why ? `Campo "${args.field}" non correggibile: ${why}.\n` : `Campo "${args.field}" sconosciuto.\n`)
        usage()
        process.exit(1)
    }

    const files = collectCsvFiles(path.resolve(stripQuotes(args.src)))
    console.log(`File CSV trovati: ${files.length}${args.apply ? '' : '   [DRY RUN]'}`)
    if (files.length === 0) { console.error('Nessun CSV trovato.'); process.exit(1) }

    // ---- Ispezione layout colonne ----
    if (args.inspect) {
        const { readCsvText } = await import('../src/lib/admin/import/helpers')
        const target = spec.source === 'column' ? spec.column : null
        for (const f of files) {
            const rows = core.parseRawCsv(readCsvText(f)).slice(0, 3)
            console.log(`\n=== ${path.basename(f)} ===`)
            rows.forEach((r, n) => {
                console.log(`  riga ${n + 1} (${r.length} colonne):`)
                r.forEach((cell, i) => {
                    const mark = i === target ? '  <== ' + spec.key : ''
                    console.log(`    [${i}] ${JSON.stringify(cell)}${mark}`)
                })
                console.log(`    -> valore letto per ${spec.key}: ${JSON.stringify(core.csvValueFor(spec, r))}`)
            })
        }
        console.log(`\nVerifica che il valore letto sia davvero il campo "${spec.key}" in tutti i file, poi rilancia senza --inspect.`)
        return
    }

    // ---- Analisi ----
    console.log(`\nParsing CSV (campo: ${spec.key})...`)
    const analysis = await core.analyzeFieldFix(sb, files, spec, {
        allowEmpty: args.allowEmpty,
        lastWins: args.lastWins,
        onFile: (file, rows) => console.log(`  ${file} -> ${rows} righe utili`),
        onProgress: (done, total, changes) => {
            process.stdout.write(`\r  confronto ${done}/${total} - da aggiornare: ${changes}   `)
        },
    })
    process.stdout.write('\n')
    console.log(report.formatFieldFixPreview(analysis))

    if (analysis.changes.length === 0) { console.log('Nulla da fare.'); return }

    const paths = report.writeFixReports(OUT_DIR, spec, analysis.changes)
    console.log(`Report scritti:\n   modifiche: ${path.relative(process.cwd(), paths.diff)}\n   rollback:  ${path.relative(process.cwd(), paths.rollback)}`)

    if (!args.apply) {
        console.log('\n[dry-run] niente scritto sul DB. Rilancia con --apply per applicare.')
        return
    }

    // ---- Scrittura ----
    console.log(`\nScrittura (solo colonna ${spec.key})...`)
    const res = await core.applyFieldFix(sb, spec, analysis.changes, (g, tot, up) => {
        process.stdout.write(`\r  ${g}/${tot} valori distinti - righe aggiornate: ${up}   `)
    })
    process.stdout.write('\n')
    console.log(`\nFatto. Righe aggiornate: ${res.updated}, errori: ${res.errors.length}`)
    if (res.errors.length) console.log(res.errors.slice(0, 20).join('\n'))
    console.log(`\nPer annullare: npm run fix:field -- --restore "${path.relative(process.cwd(), paths.rollback)}" --apply`)
}

main().catch((e) => { console.error('\nFallito:', e instanceof Error ? e.message : e); process.exit(1) })
