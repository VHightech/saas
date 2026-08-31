/**
 * Interactive local bulk-import tool. Run: `npm run import`
 *
 * Modes:
 *   1) Anagrafiche utenti (CSV)              → profiles + user_supplies + mass-link
 *   2) Bollette + PDF (CSV + 7z/cartella)    → bills insert + PDF upload to R2 + link
 *   3) Bollette + PDF — batch (intero anno)  → stessa cosa per più coppie CSV+archivio
 *      trovate in una cartella, 2 alla volta
 *   4) Correggi un singolo campo (CSV)       → UPDATE della sola colonna scelta su
 *      bollette già importate, match su idboll: niente reimport, PDF su R2 intatti,
 *      rollback su file. Vedi src/lib/admin/import/field-fix-core.ts.
 *
 * Each run: pick mode → pick file(s) → PREVIEW (nothing written) → confirm → COMMIT.
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, R2_* (.env / .env.local)
 */
import dotenv from 'dotenv'
import path from 'node:path'

dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

async function main() {
    // Dynamic imports so dotenv has populated process.env before r2.ts evaluates.
    const { createServiceClient } = await import('../src/lib/admin/import/client')
    const logs = await import('../src/lib/admin/import/import-logs')
    const bills = await import('../src/lib/admin/import/bills-core')
    const pdf = await import('../src/lib/admin/import/pdf-archive')
    const users = await import('../src/lib/admin/import/users-core')
    const { readCsvText, collectCsvFiles } = await import('../src/lib/admin/import/helpers')
    const batch = await import('../src/lib/admin/import/batch-core')
    const fieldFix = await import('../src/lib/admin/import/field-fix-core')
    const fixReport = await import('../src/lib/admin/import/field-fix-report')
    const { createPrompter, requireExistingFile } = await import('../src/lib/admin/import/prompts')

    const sb = createServiceClient()
    const p = createPrompter()

    try {
        const mode = await p.choose('Cosa vuoi importare?', [
            'Anagrafiche utenti (CSV)',
            'Bollette + PDF (CSV + 7z/cartella)',
            'Bollette + PDF — batch (cartella con tutto l\'anno)',
            'Correggi UN campo delle bollette già importate (CSV, senza reimport)',
        ])

        if (mode === 0) {
            // ---- USERS ----
            const csvPath = requireExistingFile(await p.ask('Percorso CSV anagrafiche: '), 'CSV')
            const csvText = readCsvText(csvPath)

            console.log('\nAnalisi in corso…')
            const a = await users.analyzeUsers(sb, csvText)
            console.log(`\n— Anteprima —
  Righe CSV:            ${a.records}
  Profili da importare: ${a.profiles}
  Forniture:            ${a.supplies}
  Saltati: annullati=${a.skipped.annullato} noCif=${a.skipped.noCif} cifCorto=${a.skipped.shortCif} admin=${a.skipped.admin}\n`)

            if (!(await p.confirm('Procedere con la scrittura?'))) { console.log('Annullato.'); return }

            const importId = logs.newImportId()
            await logs.initImportLog(sb, importId, 'users', path.basename(csvPath), 'Import anagrafiche…')
            const onProgress = async (c: string, done: number, total: number) => {
                process.stdout.write(`\r${c.padEnd(48)}`)
                await logs.updateImportLog(sb, importId, c, done, total)
            }
            const res = await users.commitUsers(sb, a, onProgress)
            process.stdout.write('\n')
            await logs.completeImportLog(sb, importId, a.records, a.records, { errors: [...a.skipMessages, ...res.errors] })
            console.log(`\nFatto. Profili: ${res.imported}, Forniture: ${res.suppliesUpserted}, Errori: ${res.errors.length}`)
            if (res.link) console.log(`Bollette agganciate: ${JSON.stringify(res.link)}`)
            if (res.errors.length) console.log(res.errors.slice(0, 20).join('\n'))
        } else if (mode === 1) {
            // ---- BILLS + PDF (single pair) ----
            const csvPath = requireExistingFile(await p.ask('Percorso CSV bollette (Xml…): '), 'CSV')
            const archivePath = requireExistingFile(await p.ask('Percorso archivio 7z o cartella PDF: '), 'Archivio')
            const csvText = readCsvText(csvPath)

            console.log('\nAnalisi CSV…')
            const a = await bills.analyzeBills(sb, csvText)
            console.log('Analisi archivio…')
            const arch = await pdf.analyzeArchive(sb, archivePath, a.billsToInsert.map((b) => b.nome_pdf))
            console.log(`\n— Anteprima —
  Righe CSV:              ${a.parsedRows}
  Bollette nuove:         ${a.toInsert}
  Duplicati (saltati):    ${a.duplicateBills}
  Clienti collegati:      ${a.matchedUsers}
  PDF nell'archivio:      ${arch.pdfTotal}
  PDF nuovi:              ${arch.matches - arch.alreadyLinked}
  PDF già presenti:       ${arch.alreadyLinked}
  Errori parsing:         ${a.parseErrors.length}\n`)

            if (!(await p.confirm('Procedere con la scrittura?'))) { console.log('Annullato.'); return }

            const importId = logs.newImportId()
            await logs.initImportLog(sb, importId, 'bills', path.basename(archivePath), 'Import bollette…')
            const onProgress = async (c: string, done: number, total: number) => {
                process.stdout.write(`\r${c.padEnd(48)}`)
                await logs.updateImportLog(sb, importId, c, done, total)
            }

            const ins = await bills.insertBills(sb, a.billsToInsert, importId, onProgress)
            const pr = await pdf.processArchive(sb, archivePath, importId, onProgress)
            process.stdout.write('\n')

            const allErrors = [...a.parseErrors, ...ins.errors, ...pr.errors]
            await logs.completeImportLog(sb, importId, pr.uploaded + pr.skipped, arch.pdfTotal, { errors: allErrors })
            console.log(`\nFatto. Bollette inserite: ${ins.inserted}, PDF caricati: ${pr.uploaded}, collegati: ${pr.linked}, saltati: ${pr.skipped}, errori: ${allErrors.length}`)
            if (allErrors.length) console.log(allErrors.slice(0, 20).join('\n'))
        } else if (mode === 2) {
            // ---- BILLS + PDF (batch: whole-year folder, 2 pairs at a time) ----
            const folderPath = requireExistingFile(
                await p.ask('Cartella con le coppie CSV + archivio/cartella (es. una per mese): '),
                'Cartella',
            )

            const { pairs, unmatchedCsv, unmatchedArchives } = batch.discoverBatchPairs(folderPath)
            if (pairs.length === 0) {
                console.log('Nessuna coppia CSV + archivio/cartella trovata (stesso nome, estensioni .csv e .7z o sottocartella).')
                return
            }

            console.log(`\nTrovate ${pairs.length} coppie:`)
            for (const pr of pairs) console.log(`  - ${pr.label}  (${path.basename(pr.csvPath)} + ${path.basename(pr.archivePath)})`)
            if (unmatchedCsv.length) {
                console.log(`\nCSV senza archivio corrispondente (ignorati): ${unmatchedCsv.map((f) => path.basename(f)).join(', ')}`)
            }
            if (unmatchedArchives.length) {
                console.log(`Archivi/cartelle senza CSV corrispondente (ignorati): ${unmatchedArchives.map((f) => path.basename(f)).join(', ')}`)
            }

            console.log('\nAnalisi di tutte le coppie…')
            const staged = await batch.analyzeBatch(sb, pairs, (item) => {
                console.log(`  [${item.label}] nuove=${item.billsAnalysis.toInsert} duplicati=${item.billsAnalysis.duplicateBills} pdf_nuovi=${item.archAnalysis.matches - item.archAnalysis.alreadyLinked}`)
            })

            const totalNew = staged.reduce((s, x) => s + x.billsAnalysis.toInsert, 0)
            const totalDup = staged.reduce((s, x) => s + x.billsAnalysis.duplicateBills, 0)
            const totalPdfNew = staged.reduce((s, x) => s + (x.archAnalysis.matches - x.archAnalysis.alreadyLinked), 0)
            console.log(`\n— Totale batch — Bollette nuove: ${totalNew}  Duplicati: ${totalDup}  PDF nuovi: ${totalPdfNew}\n`)

            if (!(await p.confirm(`Procedere con la scrittura di tutte le ${staged.length} coppie?`))) { console.log('Annullato.'); return }

            console.log('\nElaborazione (2 coppie alla volta)…')
            const results = await batch.processBatch(sb, staged, 2, (label, message) => {
                console.log(`  [${label}] ${message}`)
            })

            console.log('\n=== Riepilogo batch ===')
            let grandInserted = 0, grandUploaded = 0, grandLinked = 0, grandSkipped = 0
            const allBatchErrors: string[] = []
            for (const r of results) {
                console.log(`${r.label}: inserite=${r.inserted} caricati=${r.uploaded} collegati=${r.linked} saltati=${r.skipped} errori=${r.errors.length}`)
                grandInserted += r.inserted
                grandUploaded += r.uploaded
                grandLinked += r.linked
                grandSkipped += r.skipped
                allBatchErrors.push(...r.errors.map((e) => `[${r.label}] ${e}`))
            }
            console.log(`\nTOTALE: inserite=${grandInserted} caricati=${grandUploaded} collegati=${grandLinked} saltati=${grandSkipped} errori=${allBatchErrors.length}`)
            if (allBatchErrors.length) console.log('\n' + allBatchErrors.slice(0, 40).join('\n'))
        } else {
            // ---- CORREZIONE DI UN SINGOLO CAMPO (nessun reimport, PDF intatti) ----
            const fieldIdx = await p.choose(
                'Quale campo vuoi correggere? (si scrive SOLO questa colonna)',
                fieldFix.fieldChoiceLabels(),
            )
            const spec = fieldFix.FIXABLE_FIELDS[fieldIdx]

            console.log('\nCampi NON correggibili da qui, per progetto:')
            for (const [k, why] of Object.entries(fieldFix.BLOCKED_FIELDS)) {
                console.log(`  ${k.padEnd(16)} ${why}`)
            }

            const srcPath = requireExistingFile(
                await p.ask('\nPercorso CSV corretto (file o cartella, anche con sottocartelle): '),
                'CSV',
            )
            const files = collectCsvFiles(srcPath)
            if (files.length === 0) { console.log('Nessun CSV trovato nel percorso indicato.'); return }
            console.log(`\nFile CSV trovati: ${files.length}`)
            for (const f of files.slice(0, 20)) console.log(`  - ${path.basename(f)}`)
            if (files.length > 20) console.log(`  … e altri ${files.length - 20}`)

            // Controllo layout: se la colonna non è quella attesa ce ne accorgiamo ora.
            const sample = fieldFix.parseRawCsv(readCsvText(files[0])).slice(0, 2)
            console.log(`\nControllo colonne su ${path.basename(files[0])} (${spec.hint}):`)
            for (const row of sample) {
                console.log(`  riga: ${JSON.stringify(row.slice(0, 10))}`)
                console.log(`  -> ${spec.key} = ${JSON.stringify(fieldFix.csvValueFor(spec, row))}`)
            }
            if (!(await p.confirm(`Il valore letto per "${spec.key}" è corretto?`))) {
                console.log('Annullato: controlla il layout delle colonne del CSV.')
                return
            }

            const allowEmpty = await p.confirm(
                'Scrivere NULL dove il CSV è vuoto? (No = quelle righe vengono saltate, consigliato)',
            )

            console.log('\nAnalisi (nessuna scrittura)…')
            const analysis = await fieldFix.analyzeFieldFix(sb, files, spec, {
                allowEmpty,
                onFile: (file, rows) => console.log(`  ${file} -> ${rows} righe utili`),
                onProgress: (done, total, changes) => {
                    process.stdout.write(`\r  confronto ${done}/${total} - da aggiornare: ${changes}   `)
                },
            })
            process.stdout.write('\n')
            console.log(fixReport.formatFieldFixPreview(analysis))

            if (analysis.changes.length === 0) { console.log('Nulla da fare.'); return }
            if (analysis.conflictCount > 0) {
                console.log(`Nota: i ${analysis.conflictCount} idboll discordanti fra file sono esclusi.`)
            }

            const outDir = path.resolve(__dirname, '../tmp')
            const paths = fixReport.writeFixReports(outDir, spec, analysis.changes)
            console.log(`Report scritti:\n  modifiche: ${paths.diff}\n  rollback:  ${paths.rollback}`)

            if (!(await p.confirm(`Aggiornare ${analysis.changes.length} bollette sulla sola colonna "${spec.key}"?`))) {
                console.log('Annullato. Nessuna scrittura eseguita (i report restano su tmp/).')
                return
            }

            const res = await fieldFix.applyFieldFix(sb, spec, analysis.changes, (g, tot, up) => {
                process.stdout.write(`\r  ${g}/${tot} valori distinti - righe aggiornate: ${up}   `)
            })
            process.stdout.write('\n')
            console.log(`\nFatto. Righe aggiornate: ${res.updated}, errori: ${res.errors.length}`)
            if (res.errors.length) console.log(res.errors.slice(0, 20).join('\n'))
            console.log(`\nPer annullare: npm run fix:field -- --restore "${paths.rollback}" --apply`)
        }
    } finally {
        p.close()
    }
}

main().catch((err) => {
    console.error('\nFallito:', err instanceof Error ? err.message : err)
    process.exit(1)
})
