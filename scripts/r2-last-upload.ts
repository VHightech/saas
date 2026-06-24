/**
 * Retrieve the most recently uploaded object from the Cloudflare R2 bucket.
 *
 * R2 (S3 API) does NOT sort listings by date — keys come back in lexicographic
 * order — so to find the "last upload" we must page through the listing and keep
 * the object with the newest LastModified timestamp.
 *
 * Usage:
 *   npx tsx scripts/r2-last-upload.ts                 # show the single newest object
 *   npx tsx scripts/r2-last-upload.ts --prefix foo/   # restrict search to a key prefix
 *   npx tsx scripts/r2-last-upload.ts --top 10        # show the 10 most recent objects
 *   npx tsx scripts/r2-last-upload.ts --download       # also download the newest object to ./tmp
 *   npx tsx scripts/r2-last-upload.ts --download ./out # download to a specific directory
 *
 * Reads R2 credentials from .env / .env.local:
 *   R2_ACCOUNT_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 */
import {
    S3Client,
    ListObjectsV2Command,
    GetObjectCommand,
    type _Object,
    type ListObjectsV2CommandOutput,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { Readable } from 'stream'

// Load env from root (match scripts/create-admin-user.ts convention).
dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const endpoint = process.env.R2_ACCOUNT_ENDPOINT
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
const bucket = process.env.R2_BUCKET

if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    console.error('Error: R2 is not configured.')
    console.error('Ensure .env or .env.local contains R2_ACCOUNT_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET.')
    process.exit(1)
}

interface CliArgs {
    prefix?: string
    top: number
    download: boolean
    downloadDir: string
}

function parseArgs(argv: string[]): CliArgs {
    const args: CliArgs = { top: 1, download: false, downloadDir: path.resolve(__dirname, '../tmp') }
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]
        if (arg === '--prefix') {
            args.prefix = argv[++i]
        } else if (arg === '--top') {
            const n = parseInt(argv[++i], 10)
            args.top = Number.isFinite(n) && n > 0 ? n : 1
        } else if (arg === '--download') {
            args.download = true
            // Optional value: a following token that is not another flag is the dir.
            const next = argv[i + 1]
            if (next && !next.startsWith('--')) {
                args.downloadDir = path.resolve(next)
                i++
            }
        }
    }
    return args
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    const units = ['KB', 'MB', 'GB', 'TB']
    let value = bytes / 1024
    let unitIndex = 0
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024
        unitIndex++
    }
    return `${value.toFixed(2)} ${units[unitIndex]}`
}

async function listAllObjects(client: S3Client, prefix?: string): Promise<_Object[]> {
    const objects: _Object[] = []
    let continuationToken: string | undefined = undefined
    let pages = 0

    do {
        const res: ListObjectsV2CommandOutput = await client.send(
            new ListObjectsV2Command({
                Bucket: bucket,
                Prefix: prefix,
                ContinuationToken: continuationToken,
            }),
        )
        if (res.Contents) objects.push(...res.Contents)
        continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
        pages++
        process.stdout.write(`\rScanning… ${objects.length} objects (${pages} page${pages === 1 ? '' : 's'})`)
    } while (continuationToken)

    process.stdout.write('\n')
    return objects
}

async function downloadObject(client: S3Client, key: string, destDir: string): Promise<string> {
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    const destPath = path.join(destDir, path.basename(key))
    const body = res.Body as Readable
    await new Promise<void>((resolve, reject) => {
        const out = fs.createWriteStream(destPath)
        body.pipe(out)
        body.on('error', reject)
        out.on('finish', () => resolve())
        out.on('error', reject)
    })
    return destPath
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2))

    const client = new S3Client({
        region: 'auto',
        endpoint,
        credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
        forcePathStyle: true,
    })

    console.log(`Bucket: ${bucket}${args.prefix ? `  (prefix: ${args.prefix})` : ''}`)
    const objects = await listAllObjects(client, args.prefix)

    if (objects.length === 0) {
        console.log('No objects found.')
        return
    }

    // Sort newest-first by LastModified.
    const sorted = [...objects].sort((a, b) => {
        const ta = a.LastModified?.getTime() ?? 0
        const tb = b.LastModified?.getTime() ?? 0
        return tb - ta
    })

    const top = sorted.slice(0, args.top)

    console.log(`\nTotal objects: ${objects.length}`)
    console.log(`Showing ${top.length} most recent${args.top > 1 ? ` (--top ${args.top})` : ''}:\n`)

    top.forEach((obj, idx) => {
        console.log(`${idx + 1}. ${obj.Key}`)
        console.log(`   Uploaded: ${obj.LastModified?.toISOString() ?? 'unknown'}`)
        console.log(`   Size:     ${formatBytes(obj.Size ?? 0)}`)
        if (obj.ETag) console.log(`   ETag:     ${obj.ETag.replace(/"/g, '')}`)
        console.log('')
    })

    // Always provide a signed URL for the single newest object.
    const newest = sorted[0]
    if (newest.Key) {
        const signedUrl = await getSignedUrl(
            client,
            new GetObjectCommand({ Bucket: bucket, Key: newest.Key }),
            { expiresIn: 3600 },
        )
        console.log('Signed URL for the newest object (valid 1h):')
        console.log(signedUrl)
        console.log('')

        if (args.download) {
            console.log(`Downloading newest object to ${args.downloadDir}…`)
            const saved = await downloadObject(client, newest.Key, args.downloadDir)
            console.log(`Saved: ${saved}`)
        }
    }
}

main().catch((err) => {
    console.error('\nFailed:', err instanceof Error ? err.message : err)
    process.exit(1)
})
