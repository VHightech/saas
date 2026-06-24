/**
 * Recover an interrupted invoice upload: upload only the PDFs that are MISSING
 * for a given import batch and link them in the `bills` table.
 *
 * Background: the web upload pushes 1000s of PDFs in one long HTTP request. If
 * the connection drops (tunnel/timeout), the server returns an HTML error page
 * and the browser shows `Unexpected token '<' ... is not valid JSON`. The batch
 * is left partially uploaded — bills with no `pdf_url`. This script finishes the
 * job server-side with no HTTP timeout, and is safe to re-run (idempotent).
 *
 * Usage:
 *   npm run r2:fix -- --batch <importId> --src "C:\path\to\pdfs_or_archive.7z"
 *   npm run r2:fix -- --batch 425d37be-4386-44cd-b3f6-435da1fe1914 --src "C:\...\Clienti_Singoli_Xml20260605.7z"
 *   npm run r2:fix -- --batch <importId> --src "C:\...\folder" --dry-run
 *
 * --src may be a folder of PDFs (searched recursively) or a .7z/.zip archive.
 *
 * Env (from .env / .env.local):
 *   R2_ACCOUNT_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET,
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import os from 'os'

dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const endpoint = process.env.R2_ACCOUNT_ENDPOINT
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
const bucket = process.env.R2_BUCKET
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    console.error('Error: R2 not configured (R2_ACCOUNT_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET).')
    process.exit(1)
}
if (!supabaseUrl || !serviceRoleKey) {
    console.error('Error: Supabase not configured (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).')
    process.exit(1)
}

interface CliArgs {
    batch: string
    src: string
    dryRun: boolean
    concurrency: number
}

function parseArgs(argv: string[]): CliArgs {
    const args: Partial<CliArgs> = { dryRun: false, concurrency: 10 }
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]
        if (a === '--batch') args.batch = argv[++i]
        else if (a === '--src') args.src = argv[++i]
        else if (a === '--dry-run') args.dryRun = true
        else if (a === '--concurrency') args.concurrency = Math.max(1, parseInt(argv[++i], 10) || 10)
    }
    if (!args.batch || !args.src) {
        console.error('Usage: npm run r2:fix -- --batch <importId> --src <folder-or-archive> [--dry-run] [--concurrency N]')
        process.exit(1)
    }
    return args as CliArgs
}

const s3 = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
    forcePathStyle: true,
})
const supabase = createClient(supabaseUrl!, serviceRoleKey!)

/** Recursively collect all .pdf paths under a directory. */
function collectPdfs(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir)) {
        const p = path.join(dir, entry)
        const stat = fs.statSync(p)
        if (stat.isDirectory()) collectPdfs(p, out)
        else if (entry.toLowerCase().endsWith('.pdf')) out.push(p)
    }
    return out
}

/** Resolve a usable PDF source dir: extract archive to temp if needed. */
async function resolveSourceDir(src: string): Promise<{ dir: string; cleanup: () => void }> {
    const resolved = path.resolve(src)
    if (!fs.existsSync(resolved)) {
        console.error(`Source not found: ${resolved}`)
        process.exit(1)
    }
    if (fs.statSync(resolved).isDirectory()) {
        return { dir: resolved, cleanup: () => {} }
    }
    // It's an archive — extract with node-7z + 7zip-bin (same deps the app uses).
    const no7z = require('node-7z')
    const sevenBin = require('7zip-bin')
    const pathTo7zip: string = sevenBin.path7za
    const extractPath = fs.mkdtempSync(path.join(os.tmpdir(), 'r2fix-'))
    console.log(`Extracting archive to ${extractPath} …`)
    await new Promise<void>((resolve, reject) => {
        const stream = no7z.extractFull(resolved, extractPath, { $bin: pathTo7zip, recursive: true })
        stream.on('end', () => resolve())
        stream.on('error', (err: Error) => reject(err))
    })
    return { dir: extractPath, cleanup: () => fs.rmSync(extractPath, { recursive: true, force: true }) }
}

async function objectExists(key: string): Promise<boolean> {
    try {
        await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
        return true
    } catch {
        return false
    }
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2))

    // 1. Which PDFs are still missing for this batch? (bills with no pdf_url)
    console.log(`Batch: ${args.batch}`)
    const needed = new Map<string, string>() // lowercased nome_pdf -> original nome_pdf
    let from = 0
    const page = 1000
    for (;;) {
        const { data, error } = await supabase
            .from('bills')
            .select('nome_pdf')
            .eq('import_log_id', args.batch)
            .is('pdf_url', null)
            .not('nome_pdf', 'is', null)
            .range(from, from + page - 1)
        if (error) {
            console.error('Supabase query failed:', error.message)
            process.exit(1)
        }
        if (!data || data.length === 0) break
        for (const row of data) {
            if (row.nome_pdf) needed.set(String(row.nome_pdf).toLowerCase(), String(row.nome_pdf))
        }
        if (data.length < page) break
        from += page
    }
    console.log(`Unlinked bills (need a PDF): ${needed.size}`)
    if (needed.size === 0) {
        console.log('Nothing to do — every bill in this batch already has a linked PDF.')
        return
    }

    // 2. Locate the PDFs on disk.
    const { dir, cleanup } = await resolveSourceDir(args.src)
    try {
        const allPdfs = collectPdfs(dir)
        console.log(`PDFs found in source: ${allPdfs.length}`)

        // Map basename(lower) -> filepath, for the ones we actually need.
        const toProcess: { key: string; filePath: string; filename: string }[] = []
        const foundNames = new Set<string>()
        for (const filePath of allPdfs) {
            const base = path.basename(filePath)
            const lower = base.toLowerCase()
            if (needed.has(lower) && !foundNames.has(lower)) {
                foundNames.add(lower)
                toProcess.push({ key: `${args.batch}/${base}`, filePath, filename: base })
            }
        }

        const missingFromSource = [...needed.keys()].filter((n) => !foundNames.has(n))
        console.log(`Matched in source: ${toProcess.length}`)
        if (missingFromSource.length > 0) {
            console.warn(`⚠ ${missingFromSource.length} needed PDFs were NOT found in the source folder/archive.`)
            console.warn(`  e.g. ${missingFromSource.slice(0, 5).map((n) => needed.get(n)).join(', ')}`)
        }

        if (args.dryRun) {
            console.log('\n[dry-run] No uploads performed. Re-run without --dry-run to apply.')
            return
        }

        // 3. Upload + link, with bounded concurrency. Idempotent (skips if already on R2).
        let uploaded = 0
        let linked = 0
        let skipped = 0
        const errors: string[] = []
        let done = 0

        for (let i = 0; i < toProcess.length; i += args.concurrency) {
            const chunk = toProcess.slice(i, i + args.concurrency)
            await Promise.all(
                chunk.map(async ({ key, filePath, filename }) => {
                    try {
                        if (await objectExists(key)) {
                            skipped++
                        } else {
                            await s3.send(
                                new PutObjectCommand({
                                    Bucket: bucket,
                                    Key: key,
                                    Body: fs.readFileSync(filePath),
                                    ContentType: 'application/pdf',
                                }),
                            )
                            uploaded++
                        }
                        // Persist canonical object key (matches the web upload convention).
                        const { data: updated, error: upErr } = await supabase
                            .from('bills')
                            .update({ pdf_url: key })
                            .ilike('nome_pdf', filename)
                            .is('pdf_url', null)
                            .select('id')
                        if (upErr) errors.push(`link ${filename}: ${upErr.message}`)
                        else if (updated && updated.length > 0) linked += updated.length
                    } catch (e) {
                        errors.push(`${filename}: ${e instanceof Error ? e.message : String(e)}`)
                    } finally {
                        done++
                        if (done % 25 === 0 || done === toProcess.length) {
                            process.stdout.write(`\rProcessed ${done}/${toProcess.length}  (uploaded ${uploaded}, linked ${linked}, skipped ${skipped})`)
                        }
                    }
                }),
            )
        }
        process.stdout.write('\n')

        console.log('\n=== Done ===')
        console.log(`Uploaded to R2:    ${uploaded}`)
        console.log(`Already on R2:     ${skipped}`)
        console.log(`Bills linked:      ${linked}`)
        console.log(`Errors:            ${errors.length}`)
        if (errors.length > 0) errors.slice(0, 20).forEach((e) => console.log(`  - ${e}`))
        if (missingFromSource.length > 0) {
            console.log(`\nStill unlinked (PDF not in source): ${missingFromSource.length}`)
        }
    } finally {
        cleanup()
    }
}

main().catch((err) => {
    console.error('\nFailed:', err instanceof Error ? err.message : err)
    process.exit(1)
})
