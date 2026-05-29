import type { SupabaseClient } from '@supabase/supabase-js'
import type { ParsedBill } from '@/lib/admin/adapters/types'
import { buildInvoiceKey, isR2Configured, pdfExistsOnR2, uploadPdfToR2 } from '@/lib/r2'
import type { ImportProgress } from '@/lib/admin/import-progress'

export interface ProcessArchiveParams {
    supabase: SupabaseClient
    archiveFile: File
    billsToInsert: ParsedBill[]
    importId: string | null
    previewMode: boolean
    abortSignal: AbortSignal
    progress: ImportProgress
    /** Shared error accumulator — appended to in place. */
    errors: string[]
    /** Running counters carried in from the bill-insert stage. */
    processedTotal: number
    totalFiles: number
}

export interface ProcessArchiveResult {
    pdfsUploaded: number
    pdfsSkipped: number
    pdfsLinked: number
    previewPdfCount: number
    previewPdfMatches: number
    previewAlreadyLinked: number
    duplicateArchive: boolean
    existingArchiveTotal: number
    processedTotal: number
    totalFiles: number
}

interface SevenZipError extends Error {
    stderr?: string
}

/**
 * Extract a PDF archive and link/upload each PDF to its bill. In preview mode it
 * only reports match/skip counts; otherwise it uploads to R2 (or local FS fallback)
 * and persists the object key into bills.pdf_url. Temp files are always cleaned up.
 *
 * This is the heaviest stage of the import pipeline; kept as one cohesive module
 * so the route orchestrates stages rather than inlining ~330 lines.
 */
export async function processArchive(params: ProcessArchiveParams): Promise<ProcessArchiveResult> {
    const { supabase, archiveFile, billsToInsert, importId, previewMode, abortSignal, progress, errors } = params
    let processedTotal = params.processedTotal
    let totalFiles = params.totalFiles

    let pdfsUploaded = 0
    let pdfsSkipped = 0
    let pdfsLinked = 0
    let previewPdfCount = 0
    let previewPdfMatches = 0
    let previewAlreadyLinked = 0
    let duplicateArchive = false
    let existingArchiveTotal = 0

    // Check for duplicates
    const { data: existingLogs } = await supabase
        .from('import_logs')
        .select('total_files')
        .eq('archive_name', archiveFile.name)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)

    if (existingLogs && existingLogs.length > 0) {
        duplicateArchive = true
        existingArchiveTotal = existingLogs[0].total_files
    }

    try {
        await progress.update('Estrazione archivio...', processedTotal, totalFiles)
        const fs = require('fs')
        const path = require('path')
        const no7z = require('node-7z')
        const sevenBin = require('7zip-bin')
        let pathTo7zip = sevenBin.path7za

        if (!fs.existsSync(pathTo7zip)) {
            const manualPath = path.join(/*turbopackIgnore: true*/ process.cwd(), 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe')
            if (fs.existsSync(manualPath)) {
                pathTo7zip = manualPath
            } else {
                const manualPathUp = path.join(/*turbopackIgnore: true*/ process.cwd(), '..', 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe')
                if (fs.existsSync(manualPathUp)) pathTo7zip = manualPathUp
            }
        }

        const tempDir = path.join(/*turbopackIgnore: true*/ process.cwd(), 'tmp')
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir)

        // Use original filename to prevent duplicates in tmp folder as per user request
        const originalName = archiveFile.name
        const safeName = originalName.replace(/[^a-z0-9.]/gi, '_') // Basic sanitization
        const archivePath = path.join(tempDir, safeName)
        const extractPath = path.join(tempDir, `extract_${safeName.replace(/\./g, '_')}`)

        const buffer = Buffer.from(await archiveFile.arrayBuffer())
        fs.writeFileSync(archivePath, buffer)

        const pdfFiles: string[] = []

        if (previewMode) {
            const stream = no7z.list(archivePath, {
                $bin: pathTo7zip,
                recursive: true
            })

            await new Promise<void>((resolve, reject) => {
                stream.on('data', (file: any) => {
                    if (file.file && file.file.toLowerCase().endsWith('.pdf')) {
                        pdfFiles.push(file.file)
                    }
                })
                stream.on('end', () => resolve())
                stream.on('error', (err: SevenZipError) => reject(err))
            })

            // CHECK DUPLICATES IN PREVIEW
            const pdfNames = pdfFiles.map(p => path.basename(p))
            const matchSet = new Set<string>()
            const alreadyLinkedSet = new Set<string>()

            // 1. Check against CSV Data (In-Memory)
            const csvPdfSet = new Set(billsToInsert.map(b => b.nome_pdf.toLowerCase()))

            // 2. Check against DB - Fetch ALL linked bills for robust case-insensitive check
            const dbBills: any[] = []
            let billsHasMore = true
            let billsPage = 0
            const billsPageSize = 2500 // Large pages for efficiency

            while (billsHasMore) {
                const { data, error } = await supabase
                    .from('bills')
                    .select('nome_pdf, pdf_url')
                    .not('nome_pdf', 'is', null)
                    .range(billsPage * billsPageSize, (billsPage + 1) * billsPageSize - 1)

                if (error) {
                    console.error('Error fetching bills for preview:', error)
                    billsHasMore = false
                } else if (data) {
                    dbBills.push(...data)
                    if (data.length < billsPageSize) billsHasMore = false
                    else billsPage++
                } else {
                    billsHasMore = false
                }
            }

            // Let's simplify: Build a Map from DB
            const dbMap = new Map<string, string>() // filename -> url
            dbBills.forEach(d => {
                if (d.nome_pdf) dbMap.set(d.nome_pdf.toLowerCase(), d.pdf_url || '')
            })

            // Now iterate the ZIP files
            pdfNames.forEach(name => {
                const lowerName = name.toLowerCase()
                if (dbMap.has(lowerName)) {
                    matchSet.add(lowerName)
                    const url = dbMap.get(lowerName)
                    if (url && url.startsWith('/invoices/')) {
                        alreadyLinkedSet.add(lowerName)
                    }
                }
            })

            // Add CSV matches to matchSet
            pdfNames.forEach(name => {
                if (csvPdfSet.has(name.toLowerCase())) {
                    matchSet.add(name.toLowerCase())
                }
            })

            pdfsSkipped = alreadyLinkedSet.size
            previewAlreadyLinked = alreadyLinkedSet.size
            previewPdfMatches = matchSet.size // Total found in DB OR CSV
            previewPdfCount = pdfFiles.length
        } else {
            // 1. Extract Archive
            await new Promise<void>((resolve, reject) => {
                const stream = no7z.extractFull(archivePath, extractPath, {
                    $bin: pathTo7zip,
                    recursive: true
                })
                stream.on('end', () => resolve())
                stream.on('error', (err: SevenZipError) => reject(err))
            })

            const getAllFiles = (dir: string, fileList: string[] = []) => {
                if (!fs.existsSync(dir)) return fileList
                const files = fs.readdirSync(dir)
                files.forEach((file: string) => {
                    const filePath = path.join(dir, file)
                    if (fs.statSync(filePath).isDirectory()) {
                        getAllFiles(filePath, fileList)
                    } else {
                        fileList.push(filePath)
                    }
                })
                return fileList
            }

            const extracted = getAllFiles(extractPath)
            pdfFiles.push(...extracted.filter(f => f.toLowerCase().endsWith('.pdf')))

            // Update total to include PDF files
            // RESET counts for PDF phase to make it clearer for the user (0 to N instead of N to N+M)
            totalFiles = pdfFiles.length
            processedTotal = 0
            await progress.update('Analisi PDF estratti...', 0, totalFiles)

            // 2. Filter Duplicates (Check DB) & Storage
            const existingPdfMap = new Map<string, string>()

            // A. Check DB - Fetch ALL linked bills to handle case-insensitivity properly
            const allBills: any[] = []
            let bHasMore = true
            let bPage = 0
            const bPageSize = 2500

            while (bHasMore) {
                const { data, error } = await supabase
                    .from('bills')
                    .select('nome_pdf, pdf_url')
                    .not('nome_pdf', 'is', null)
                    .range(bPage * bPageSize, (bPage + 1) * bPageSize - 1)

                if (error) {
                    console.error('Error fetching all bills:', error)
                    bHasMore = false
                } else if (data) {
                    allBills.push(...data)
                    if (data.length < bPageSize) bHasMore = false
                    else bPage++
                } else {
                    bHasMore = false
                }
            }

            allBills.forEach(d => {
                if (d.nome_pdf) {
                    existingPdfMap.set(d.nome_pdf.toLowerCase(), d.pdf_url || '')
                }
            })

            // B. Storage backend: prefer Cloudflare R2; fall back to local FS only if unconfigured.
            const storageSubDir = 'invoices/acq'
            const useR2 = isR2Configured()
            const localInvoicesDir = path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', storageSubDir)
            if (!useR2 && !fs.existsSync(localInvoicesDir)) {
                fs.mkdirSync(localInvoicesDir, { recursive: true })
            }

            console.log(`[Upload] Found ${existingPdfMap.size} bills already linked in DB.`)

            // 3. Upload Non-Duplicates in Parallel
            // Local FS is fast, but let's keep concurrency controlled to avoid blocking event loop too much
            const CONCURRENCY = 10
            for (let i = 0; i < pdfFiles.length; i += CONCURRENCY) {
                if (abortSignal.aborted) throw new Error('Upload aborted by user')

                const chunk = pdfFiles.slice(i, i + CONCURRENCY)
                await Promise.all(chunk.map(async (filePath) => {
                    processedTotal++
                    const rawName = path.basename(filePath)
                    // Hard sanitize: allow only safe chars, collapse others to underscore.
                    const filename = rawName.replace(/[^A-Za-z0-9._\- ]/g, '_')
                    if (!filename || filename.startsWith('.') || filename.length > 200) {
                        errors.push(`Skipped unsafe filename: ${rawName}`)
                        return
                    }
                    const lowerFilename = filename.toLowerCase()

                    // Check DB first — pdf_url now stores an R2 object key like "invoices/acq/<name>".
                    const existingUrl = existingPdfMap.get(lowerFilename)
                    if (existingUrl && (existingUrl.startsWith('invoices/') || existingUrl.startsWith('/invoices/'))) {
                        pdfsSkipped++
                        if (processedTotal % 50 === 0) {
                            await progress.update(`Skipped (Already Linked): ${filename}`, processedTotal, totalFiles)
                        }
                        return
                    }

                    const r2Key = buildInvoiceKey(filename, importId ?? undefined)
                    let needsUpload = true

                    try {
                        if (useR2) {
                            if (await pdfExistsOnR2(r2Key)) {
                                needsUpload = false
                            }
                            if (needsUpload) {
                                const fileBuffer = fs.readFileSync(filePath)
                                await uploadPdfToR2(r2Key, fileBuffer)
                                pdfsUploaded++
                            }
                            if (processedTotal % 10 === 0) {
                                await progress.update(`R2: ${filename}`, processedTotal, totalFiles)
                            }
                        } else {
                            const targetPath = path.resolve(localInvoicesDir, filename)
                            const invoicesRoot = path.resolve(localInvoicesDir) + path.sep
                            if (!targetPath.startsWith(invoicesRoot)) {
                                errors.push(`Skipped path traversal attempt: ${rawName}`)
                                return
                            }
                            if (fs.existsSync(targetPath)) {
                                needsUpload = false
                            } else {
                                const fileBuffer = fs.readFileSync(filePath)
                                fs.writeFileSync(targetPath, fileBuffer)
                                pdfsUploaded++
                            }
                        }

                        // Persist the canonical object key in bills.pdf_url.
                        const persistedUrl = r2Key

                        const { error: updateError, data: updatedData } = await supabase
                            .from('bills')
                            .update({ pdf_url: persistedUrl })
                            .ilike('nome_pdf', filename) // case-insensitive link
                            .select('id')

                        if (updateError) {
                            console.error(`DB Update Error for ${filename}:`, updateError)
                        }

                        if (!updateError && updatedData && updatedData.length > 0) {
                            pdfsLinked++
                        } else {
                            console.warn(`No DB match found for PDF to link: ${filename}`)
                        }

                    } catch (err) {
                        console.error(`File Processing Error: ${filePath}`, err)
                        errors.push(`Error ${filename}: ${err}`)
                    }
                }))
            }
        }

    } catch (err: any) {
        console.error('Archive Error', err)
        errors.push(`Archive Error: ${err.message}`)
    } finally {
        // Unified Cleanup in finally block
        try {
            const fs = require('fs')
            const path = require('path')
            const originalName = archiveFile.name
            const safeName = originalName.replace(/[^a-z0-9.]/gi, '_')
            const archivePath = path.join(/*turbopackIgnore: true*/ process.cwd(), 'tmp', safeName)
            const extractPath = path.join(/*turbopackIgnore: true*/ process.cwd(), 'tmp', `extract_${safeName.replace(/\./g, '_')}`)

            if (fs.existsSync(archivePath)) {
                fs.unlinkSync(archivePath)
                console.log(`[Upload] Deleted temp archive: ${archivePath}`)
            }
            if (fs.existsSync(extractPath)) {
                fs.rmSync(extractPath, { recursive: true, force: true })
                console.log(`[Upload] Deleted extraction folder: ${extractPath}`)
            }
        } catch (cleanupErr) {
            console.error('[Upload] Cleanup failed:', cleanupErr)
        }
    }

    return {
        pdfsUploaded, pdfsSkipped, pdfsLinked,
        previewPdfCount, previewPdfMatches, previewAlreadyLinked,
        duplicateArchive, existingArchiveTotal,
        processedTotal, totalFiles,
    }
}
