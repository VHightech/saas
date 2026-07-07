/**
 * Interactive local bulk-import tool. Run: `npm run import`
 *
 * Modes:
 *   1) Anagrafiche utenti (CSV)         → profiles + user_supplies + mass-link
 *   2) Bollette + PDF (CSV + 7z)        → bills insert + PDF upload to R2 + link
 *
 * Each run: pick mode → pick file(s) → PREVIEW (nothing written) → confirm → COMMIT.
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, R2_* (.env / .env.local)
 */
import dotenv from 'dotenv'
import path from 'node:path'
import fs from 'node:fs'

dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

async function main() {
    // Dynamic imports so dotenv has populated process.env before r2.ts evaluates.
    const { createServiceClient } = await import('../src/lib/admin/import/client')
    const logs = await import('../src/lib/admin/import/import-logs')
    const bills = await import('../src/lib/admin/import/bills-core')
    const pdf = await import('../src/lib/admin/import/pdf-archive')
    const users = await import('../src/lib/admin/import/users-core')
    const { createPrompter, requireExistingFile } = await import('../src/lib/admin/import/prompts')

    const sb = createServiceClient()
    const p = createPrompter()

    try {
        const mode = await p.choose('Cosa vuoi importare?', [
            'Anagrafiche utenti (CSV)',
            'Bollette + PDF (CSV + 7z)',
        ])

        if (mode === 0) {
            // ---- USERS ----
            const csvPath = requireExistingFile(await p.ask('Percorso CSV anagrafiche: '), 'CSV')
            const csvText = fs.readFileSync(csvPath, 'utf8')

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
        } else {
            // ---- BILLS + PDF ----
            const csvPath = requireExistingFile(await p.ask('Percorso CSV bollette (Xml…): '), 'CSV')
            const archivePath = requireExistingFile(await p.ask('Percorso archivio 7z: '), 'Archivio')
            const csvText = fs.readFileSync(csvPath, 'utf8')

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
        }
    } finally {
        p.close()
    }
}

main().catch((err) => {
    console.error('\nFallito:', err instanceof Error ? err.message : err)
    process.exit(1)
})
