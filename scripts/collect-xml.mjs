// Collect every .xml found in the sub-folders of  <base>\source\test
// and copy them up into  <base>\source.
//
// Usage:
//   node scripts/collect-xml.mjs "C:\path\to\base"            (base = folder that contains "source")
//   node scripts/collect-xml.mjs "C:\path\to\base" --dry-run  (list only, copy nothing)
//
// If two .xml share the same name, the second is copied with its parent-folder
// name prefixed (so nothing is overwritten).

import fs from 'fs'
import path from 'path'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const base = args.find((a) => !a.startsWith('--')) || process.cwd()

const sourceDir = path.join(base, 'source')
const testDir = path.join(sourceDir, 'test')

if (!fs.existsSync(testDir)) {
    console.error(`Not found: ${testDir}\nPass the folder that contains "source" as the first argument.`)
    process.exit(1)
}
if (!fs.existsSync(sourceDir)) fs.mkdirSync(sourceDir, { recursive: true })

function walkXml(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name)
        if (entry.isDirectory()) walkXml(p, out)
        else if (entry.name.toLowerCase().endsWith('.xml')) out.push(p)
    }
    return out
}

const xmls = walkXml(testDir)
console.log(`Found ${xmls.length} .xml file(s) under ${testDir}${dryRun ? '   [DRY RUN]' : ''}`)

let copied = 0
let renamed = 0
for (const src of xmls) {
    const baseName = path.basename(src)
    let target = path.join(sourceDir, baseName)
    if (fs.existsSync(target)) {
        const parent = path.basename(path.dirname(src))
        target = path.join(sourceDir, `${parent}_${baseName}`)
        renamed++
    }
    if (!dryRun) fs.copyFileSync(src, target)
    copied++
    if (copied % 100 === 0) process.stdout.write(`\rCopied ${copied}/${xmls.length}…`)
}
process.stdout.write('\n')

console.log(`\nDone.`)
console.log(`Copied:  ${copied} file(s) into ${sourceDir}`)
console.log(`Renamed: ${renamed} (had a name collision)`)
if (dryRun) console.log('\n[dry-run] nothing was copied. Re-run without --dry-run to apply.')
