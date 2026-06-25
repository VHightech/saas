/**
 * Collect the "Clienti_Singoli" PDF archive from every batch subfolder and copy
 * it into the CSV source folder, renamed with the batch's date token so it pairs
 * with the matching XmlYYYYMMDD.csv in the admin uploader (which matches CSV↔zip
 * by the 8-digit date in the filename).
 *
 * Source layout (one folder per batch):
 *   <src>/Xml20250114/Clienti_Singoli.7z              ← copied
 *   <src>/Xml20250114/Clienti_Singoli_Xml20250114.7z  ← (alt name) copied
 *   <src>/Xml20250114/Mail_Xml20250114.7z             ← ignored
 *
 * Output (all in the flat dest folder, uniquely named by date token):
 *   <dest>/Clienti_Singoli_Xml20250114.7z
 *
 * Folders without an 8-digit date token, "_old" duplicate variants, and any
 * second folder that resolves to an already-used token are skipped (reported).
 *
 * Usage:
 *   npm run collect-7z -- --dry-run
 *   npm run collect-7z
 *   npm run collect-7z -- --src "Z:\path\Nuova cartella" --dest "Z:\path\Risultato"
 */
import fs from 'fs'
import path from 'path'

const DEFAULT_SRC = 'Z:\\Progetti\\Acquambiente\\Nuovo portale\\Risultato\\Nuova cartella'
const DEFAULT_DEST = 'Z:\\Progetti\\Acquambiente\\Nuovo portale\\Risultato'

interface Args { src: string; dest: string; dryRun: boolean; overwrite: boolean }
function parseArgs(argv: string[]): Args {
    const a: Args = { src: DEFAULT_SRC, dest: DEFAULT_DEST, dryRun: false, overwrite: false }
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--src') a.src = argv[++i]
        else if (argv[i] === '--dest') a.dest = argv[++i]
        else if (argv[i] === '--dry-run') a.dryRun = true
        else if (argv[i] === '--overwrite') a.overwrite = true
    }
    return a
}

function main() {
    const { src, dest, dryRun, overwrite } = parseArgs(process.argv.slice(2))
    if (!fs.existsSync(src)) { console.error(`Source not found: ${src}`); process.exit(1) }
    if (!fs.existsSync(dest)) { console.error(`Dest not found: ${dest}`); process.exit(1) }

    const folders = fs.readdirSync(src, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => e.name)
        .sort((a, b) => a.localeCompare(b))   // canonical "XmlYYYYMMDD" sorts before "..._old"

    console.log(`Source : ${src}`)
    console.log(`Dest   : ${dest}`)
    console.log(`Folders: ${folders.length}${dryRun ? '   [DRY RUN]' : ''}\n`)

    let copied = 0, skippedOld = 0, noToken = 0, missing = 0, collisions = 0, skippedExisting = 0
    const usedToken = new Map<string, string>()  // token -> folder that claimed it

    for (const folder of folders) {
        const token = folder.match(/(\d{8})/)?.[1]
        if (!token) { console.warn(`!  ${folder}: no 8-digit date token — skipped`); noToken++; continue }

        if (/_old\b/i.test(folder)) { console.log(`-  ${folder}: "_old" variant — skipped`); skippedOld++; continue }

        const folderPath = path.join(src, folder)
        const archive = fs.readdirSync(folderPath)
            .find(f => /^clienti_singoli.*\.7z$/i.test(f))   // excludes Mail_*.7z
        if (!archive) { console.warn(`!  ${folder}: no Clienti_Singoli*.7z found — skipped`); missing++; continue }

        if (usedToken.has(token)) {
            console.warn(`!  ${folder}: token ${token} already claimed by "${usedToken.get(token)}" — skipped (would collide)`)
            collisions++
            continue
        }
        usedToken.set(token, folder)

        const targetName = `Clienti_Singoli_Xml${token}.7z`
        const from = path.join(folderPath, archive)
        const to = path.join(dest, targetName)
        const exists = fs.existsSync(to)

        if (exists && !overwrite) {
            console.log(`=  ${folder}/${archive}  →  ${targetName}  (already exists — skipped, use --overwrite)`)
            skippedExisting++
            continue
        }

        console.log(`${exists ? '⟳' : '+'}  ${folder}/${archive}  →  ${targetName}${exists ? '  (overwrite)' : ''}`)
        if (!dryRun) fs.copyFileSync(from, to)
        copied++
    }

    console.log(`\n=== ${dryRun ? 'DRY RUN — ' : ''}Done ===`)
    console.log(`Copied:            ${copied}`)
    console.log(`Skipped (_old):    ${skippedOld}`)
    console.log(`Skipped (exists):  ${skippedExisting}`)
    console.log(`No date token:     ${noToken}`)
    console.log(`Missing archive:   ${missing}`)
    console.log(`Token collisions:  ${collisions}`)
    if (dryRun) console.log('\n[dry-run] nothing copied. Re-run without --dry-run to apply.')
}

main()
