/**
 * Compress invoice PDFs already stored on R2, in place, to reclaim space.
 *
 * Runs OUTSIDE the upload request (compression is too slow to do inline for
 * thousands of files). Downloads each PDF, compresses it with Ghostscript
 * (see src/lib/pdf-compress.ts), and re-uploads to the SAME key — so every
 * bills.pdf_url keeps working and NO database change is needed.
 *
 * Safe + resumable: each processed object is tagged with metadata
 * `compressed=1`, so re-runs skip what's already done. Use --dry-run / --limit
 * to test first.
 *
 * Usage:
 *   npm run r2:compress -- --dry-run --limit 20      # test on 20 files, no writes
 *   npm run r2:compress -- --limit 50                # really compress 50
 *   npm run r2:compress                              # whole bucket
 *   npm run r2:compress -- --prefix <batchId>/       # only one import batch
 *   npm run r2:compress -- --concurrency 8           # parallelism (default 4)
 *
 * Quality is controlled by PDF_COMPRESS_PRESET (/screen | /ebook (default) | /printer).
 */
import {
    S3Client,
    ListObjectsV2Command,
    GetObjectCommand,
    PutObjectCommand,
    HeadObjectCommand,
    type ListObjectsV2CommandOutput,
} from '@aws-sdk/client-s3'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { Readable } from 'stream'
import { compressPdf } from '../src/lib/pdf-compress'

dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const endpoint = process.env.R2_ACCOUNT_ENDPOINT
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
const bucket = process.env.R2_BUCKET

if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    console.error('Error: R2 not configured (R2_ACCOUNT_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET).')
    process.exit(1)
}

interface Args {
    prefix?: string
    limit: number
    dryRun: boolean
    concurrency: number
}

function parseArgs(argv: string[]): Args {
    const a: Args = { limit: Infinity, dryRun: false, concurrency: 4 }
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]
        if (arg === '--prefix') a.prefix = argv[++i]
        else if (arg === '--limit') a.limit = Math.max(1, parseInt(argv[++i], 10) || 1)
        else if (arg === '--dry-run') a.dryRun = true
        else if (arg === '--concurrency') a.concurrency = Math.max(1, parseInt(argv[++i], 10) || 4)
    }
    return a
}

const s3 = new S3Client({
    region: 'auto',
    endpoint,
    credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
    forcePathStyle: true,
})

function fmtMB(bytes: number): string {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(Buffer.from(chunk))
    return Buffer.concat(chunks)
}

async function listPdfObjects(prefix?: string): Promise<{ key: string; size: number }[]> {
    const out: { key: string; size: number }[] = []
    let token: string | undefined = undefined
    do {
        const res: ListObjectsV2CommandOutput = await s3.send(
            new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }),
        )
        for (const o of res.Contents ?? []) {
            if (o.Key && o.Key.toLowerCase().endsWith('.pdf')) out.push({ key: o.Key, size: o.Size ?? 0 })
        }
        token = res.IsTruncated ? res.NextContinuationToken : undefined
        process.stdout.write(`\rListing… ${out.length} PDFs`)
    } while (token)
    process.stdout.write('\n')
    return out
}

async function alreadyCompressed(key: string): Promise<boolean> {
    try {
        const h = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
        return h.Metadata?.compressed === '1'
    } catch {
        return false
    }
}

interface Result { origBytes: number; newBytes: number; skipped: boolean; error?: string }

async function processOne(key: string, dryRun: boolean): Promise<Result> {
    if (await alreadyCompressed(key)) return { origBytes: 0, newBytes: 0, skipped: true }

    const tmp = path.join(os.tmpdir(), `r2c_${process.pid}_${Date.now()}_${Math.floor(Math.random() * 1e9)}.pdf`)
    try {
        const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
        const orig = await streamToBuffer(res.Body as Readable)
        fs.writeFileSync(tmp, orig)

        const compressed = await compressPdf(tmp)
        const useCompressed = compressed.length > 0 && compressed.length < orig.length
        const body = useCompressed ? compressed : orig

        if (!dryRun) {
            await s3.send(new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: body,
                ContentType: 'application/pdf',
                Metadata: { compressed: '1' },
            }))
        }
        return { origBytes: orig.length, newBytes: body.length, skipped: false }
    } catch (e) {
        return { origBytes: 0, newBytes: 0, skipped: false, error: e instanceof Error ? e.message : String(e) }
    } finally {
        try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp) } catch { /* ignore */ }
    }
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2))
    console.log(`Bucket: ${bucket}${args.prefix ? `  prefix: ${args.prefix}` : ''}${args.dryRun ? '  [DRY RUN]' : ''}`)
    console.log(`Preset: ${process.env.PDF_COMPRESS_PRESET || '/ebook'}  concurrency: ${args.concurrency}`)

    const all = await listPdfObjects(args.prefix)
    const targets = all.slice(0, args.limit === Infinity ? all.length : args.limit)
    console.log(`Processing ${targets.length} of ${all.length} PDFs\n`)

    let processed = 0, compressed = 0, skipped = 0, errors = 0
    let origTotal = 0, newTotal = 0

    for (let i = 0; i < targets.length; i += args.concurrency) {
        const chunk = targets.slice(i, i + args.concurrency)
        const results = await Promise.all(chunk.map(t => processOne(t.key, args.dryRun)))
        for (const r of results) {
            processed++
            if (r.error) { errors++; continue }
            if (r.skipped) { skipped++; continue }
            origTotal += r.origBytes
            newTotal += r.newBytes
            if (r.newBytes < r.origBytes) compressed++
        }
        process.stdout.write(`\rProcessed ${processed}/${targets.length}  ·  compressed ${compressed}  ·  skipped ${skipped}  ·  saved ${fmtMB(origTotal - newTotal)}  ·  errors ${errors}`)
    }
    process.stdout.write('\n\n')

    console.log('=== Done ===')
    console.log(`Processed:        ${processed}`)
    console.log(`Compressed:       ${compressed}`)
    console.log(`Skipped (done):   ${skipped}`)
    console.log(`Errors:           ${errors}`)
    console.log(`Size before:      ${fmtMB(origTotal)}`)
    console.log(`Size after:       ${fmtMB(newTotal)}`)
    console.log(`Reclaimed:        ${fmtMB(origTotal - newTotal)}${origTotal > 0 ? ` (${(100 * (origTotal - newTotal) / origTotal).toFixed(1)}%)` : ''}`)
    if (args.dryRun) console.log('\n[dry-run] nothing was written. Re-run without --dry-run to apply.')
}

main().catch((err) => {
    console.error('\nFailed:', err instanceof Error ? err.message : err)
    process.exit(1)
})
