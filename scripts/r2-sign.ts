/**
 * Print a temporary signed URL for a specific R2 object key, to verify a file
 * exists and is downloadable.
 *
 * Usage:
 *   npm run r2:sign -- --key "efa677d6-e339-407a-9974-6b4dc1349fab/20260038544.pdf"
 */
import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import dotenv from 'dotenv'
import path from 'path'

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

async function main(): Promise<void> {
    const argv = process.argv.slice(2)
    const keyIdx = argv.indexOf('--key')
    const key = keyIdx >= 0 ? argv[keyIdx + 1] : undefined
    if (!key) {
        console.error('Usage: npm run r2:sign -- --key "<object key>"')
        process.exit(1)
    }

    const s3 = new S3Client({
        region: 'auto',
        endpoint,
        credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
        forcePathStyle: true,
    })

    try {
        const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
        console.log(`Object exists: ${key}`)
        console.log(`  Size:     ${head.ContentLength} bytes`)
        console.log(`  Modified: ${head.LastModified?.toISOString() ?? 'unknown'}`)
    } catch (e) {
        console.log(`(HEAD check failed: ${e instanceof Error ? e.message : e} — generating URL anyway)`)
    }

    const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 3600 })
    console.log(`\nSigned URL (valid 1h):\n${url}`)
}

main().catch((err) => {
    console.error('\nFailed:', err instanceof Error ? err.message : err)
    process.exit(1)
})
