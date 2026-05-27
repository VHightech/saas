import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const endpoint = process.env.R2_ACCOUNT_ENDPOINT
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
const bucket = process.env.R2_BUCKET

export const R2_BUCKET = bucket || ''

let cachedClient: S3Client | null = null

export function getR2Client(): S3Client {
    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
        throw new Error('R2 is not configured — set R2_ACCOUNT_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET.')
    }
    if (!cachedClient) {
        cachedClient = new S3Client({
            region: 'auto',
            endpoint,
            credentials: { accessKeyId, secretAccessKey },
            forcePathStyle: true,
        })
    }
    return cachedClient
}

export function isR2Configured(): boolean {
    return Boolean(endpoint && accessKeyId && secretAccessKey && bucket)
}

export async function uploadPdfToR2(key: string, body: Buffer, contentType = 'application/pdf'): Promise<void> {
    const client = getR2Client()
    await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
    }))
}

export async function pdfExistsOnR2(key: string): Promise<boolean> {
    const client = getR2Client()
    try {
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
        return true
    } catch {
        return false
    }
}

export async function getSignedPdfUrl(
    key: string,
    expiresInSeconds = 300,
    downloadFilename?: string,
): Promise<string> {
    const client = getR2Client()
    // When downloadFilename is set, instruct R2 to return the object with an
    // attachment disposition so the browser downloads it (instead of inline
    // preview). Sanitize the filename to avoid response-header injection.
    const responseContentDisposition = downloadFilename
        ? `attachment; filename="${downloadFilename.replace(/[\r\n"]/g, '')}"`
        : undefined
    return getSignedUrl(
        client,
        new GetObjectCommand({
            Bucket: bucket,
            Key: key,
            ...(responseContentDisposition ? { ResponseContentDisposition: responseContentDisposition } : {}),
        }),
        { expiresIn: expiresInSeconds }
    )
}

export async function deleteBatchFromR2(batchPrefix: string): Promise<number> {
    const client = getR2Client()
    let totalDeleted = 0
    let continuationToken: string | undefined = undefined

    try {
        do {
            const listCmd: ListObjectsV2Command = new ListObjectsV2Command({
                Bucket: bucket,
                Prefix: batchPrefix.endsWith('/') ? batchPrefix : `${batchPrefix}/`,
                ContinuationToken: continuationToken
            })
            const listRes = await client.send(listCmd)
            
            if (!listRes.Contents || listRes.Contents.length === 0) break
            
            const deleteCmd = new DeleteObjectsCommand({
                Bucket: bucket,
                Delete: {
                    Objects: listRes.Contents.map(o => ({ Key: o.Key }))
                }
            })
            
            await client.send(deleteCmd)
            totalDeleted += listRes.Contents.length
            
            continuationToken = listRes.NextContinuationToken
        } while (continuationToken)

        return totalDeleted
    } catch (e) {
        console.error('Failed to empty R2 batch', e)
        return totalDeleted
    }
}

/**
 * Object key convention: `invoices/acq/<filename.pdf>`.
 * Stored verbatim in `bills.pdf_url` so signed URLs can be rebuilt on demand.
 */
export function buildInvoiceKey(filename: string, batchId?: string): string {
    if (batchId) {
        return `${batchId}/${filename}`
    }
    return filename
}
