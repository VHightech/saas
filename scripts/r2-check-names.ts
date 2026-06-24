/**
 * Check whether specific PDF filenames exist in the R2 bucket (under any prefix).
 * Distinguishes "upload failed / file missing" from "linking failed" for bills
 * whose pdf_url is null.
 *
 * Usage:
 *   npm run r2:check -- --csv scripts/_input.csv        # reads the nome_pdf column
 *   npm run r2:check -- --names 20260038544.pdf,20260035223.pdf
 *
 * Reads R2 creds from .env / .env.local.
 */
import { S3Client, ListObjectsV2Command, type ListObjectsV2CommandOutput } from '@aws-sdk/client-s3'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const endpoint = process.env.R2_ACCOUNT_ENDPOINT
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
const bucket = process.env.R2_BUCKET

if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    console.error('Error: R2 not configured.')
    process.exit(1)
}

function parseArgs(argv: string[]): { names: string[] } {
    let names: string[] = []
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--names') {
            names = (argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean)
        } else if (argv[i] === '--csv') {
            const csvPath = path.resolve(argv[++i] || '')
            const text = fs.readFileSync(csvPath, 'utf8')
            const lines = text.split(/\r?\n/).filter(Boolean)
            const header = lines.shift()?.split(',') ?? []
            const col = header.findIndex((h) => h.trim().toLowerCase() === 'nome_pdf')
            const idx = col >= 0 ? col : 0
            names = lines.map((l) => l.split(',')[idx]?.trim()).filter(Boolean)
        }
    }
    if (names.length === 0) {
        console.error('Provide --names a.pdf,b.pdf  or  --csv path/to/file.csv (with a nome_pdf column)')
        process.exit(1)
    }
    return { names }
}

async function main(): Promise<void> {
    const { names } = parseArgs(process.argv.slice(2))
    const wanted = new Set(names.map((n) => n.toLowerCase()))

    const s3 = new S3Client({
        region: 'auto',
        endpoint,
        credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
        forcePathStyle: true,
    })

    // Full bucket scan; map basename(lower) -> list of full keys it appears under.
    const byBasename = new Map<string, string[]>()
    let token: string | undefined = undefined
    let scanned = 0
    do {
        const res: ListObjectsV2CommandOutput = await s3.send(
            new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }),
        )
        for (const o of res.Contents ?? []) {
            if (!o.Key) continue
            const base = o.Key.split('/').pop()!.toLowerCase()
            if (wanted.has(base)) {
                const arr = byBasename.get(base) ?? []
                arr.push(o.Key)
                byBasename.set(base, arr)
            }
        }
        scanned += res.Contents?.length ?? 0
        token = res.IsTruncated ? res.NextContinuationToken : undefined
        process.stdout.write(`\rScanned ${scanned} objects…`)
    } while (token)
    process.stdout.write('\n\n')

    let present = 0
    let missing = 0
    for (const name of names) {
        const keys = byBasename.get(name.toLowerCase())
        if (keys && keys.length > 0) {
            present++
            console.log(`✓ IN R2  ${name}   ->  ${keys.join(' , ')}`)
        } else {
            missing++
            console.log(`✗ MISSING ${name}   (not found anywhere in the bucket)`)
        }
    }

    console.log(`\n=== Summary ===`)
    console.log(`Requested: ${names.length}`)
    console.log(`In R2 (upload OK, linking failed): ${present}`)
    console.log(`Missing from R2 (never uploaded / not in archive): ${missing}`)
}

main().catch((err) => {
    console.error('\nFailed:', err instanceof Error ? err.message : err)
    process.exit(1)
})
