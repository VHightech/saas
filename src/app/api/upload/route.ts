import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse/sync'
import { getAdapterForTenant, getTenantStoragePath } from '@/lib/admin/adapters/factory'

// Use Service Role to bypass RLS for Admin Uploads
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

import { requireAdmin } from '@/lib/auth-checks'

export async function POST(req: NextRequest) {
    try {
        const authCheck = await requireAdmin()
        if (authCheck.error) {
            return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
        }

        const formData = await req.formData()
        const file = formData.get('csv') as File
        const importId = formData.get('importId') as string // Client generated ID
        const tenantSlug = req.headers.get('x-tenant-slug') || 'acq'

        console.log('[Upload] Service Role Key Present:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)
        console.log('[Upload] Is Service Role Key default/placeholder?', process.env.SUPABASE_SERVICE_ROLE_KEY === 'your-service-role-key')

        if (!file) {
            return NextResponse.json({ error: 'No CSV file provided' }, { status: 400 })
        }

        // Parsing will happen via Adapter after loading profiles
        const text = await file.text()

        // Resolve Tenant Config EARLY
        const { data: tenantData } = await supabase
            .from('tenants')
            .select('id, adapter, import_mapping')
            .eq('slug', tenantSlug)
            .single()

        if (!tenantData) {
            return NextResponse.json({ error: `Tenant not found: ${tenantSlug}` }, { status: 400 })
        }
        const tenantId = tenantData.id
        const adapterName = tenantData.adapter
        const mapping = tenantData.import_mapping

        // Progress Tracking Helpers
        let totalFiles = 0
        let processedTotal = 0
        let lastUpdate = 0

        const updateProgress = async (current: string, processed: number, total: number, status: 'processing' | 'completed' | 'error' = 'processing') => {
            console.log(`[Upload API] updateProgress called for ID: ${importId} with status: ${status}`)
            const now = Date.now()
            // Update at most once per second or if completed/error
            if (importId && (now - lastUpdate > 1000 || status !== 'processing')) {
                lastUpdate = now
                const { error: logError } = await supabase.from('import_logs').upsert({
                    id: importId,
                    status: status,
                    current_file: current,
                    processed_files: processed,
                    total_files: total,
                    archive_name: formData.get('archive') ? (formData.get('archive') as File).name : null,
                    tenant_id: tenantId // Added tenant_id
                })
                if (logError) {
                    console.error(`[Upload API] Log update failed for ${importId}:`, logError)
                }
            }
        }

        // Initialize Log
        if (importId) {
            console.log(`[Upload API] Initializing log for ID: ${importId}`)
            const { error: logInitError } = await supabase.from('import_logs').upsert({
                id: importId,
                status: 'processing',
                total_files: totalFiles,
                processed_files: 0,
                current_file: 'Analisi CSV...',
                tenant_id: tenantId // Added tenant_id
            })
            if (logInitError) {
                console.error('[Upload API] Failed to initialize import log:', logInitError)
            }
        } else {
            console.warn('[Upload API] No importId provided, skipping log initialization')
        }

        // Initial log initialized above

        // 1. Fetch Existing Profiles (Batched)
        const allProfiles: any[] = []
        let hasMore = true
        let page = 0
        const pageSize = 1000

        try {
            while (hasMore) {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, cif, cfpi')
                    .range(page * pageSize, (page + 1) * pageSize - 1)

                if (error) throw error

                if (data) {
                    allProfiles.push(...data)
                    if (data.length < pageSize) hasMore = false
                    else page++
                } else {
                    hasMore = false
                }
            }
        } catch (profileError) {
            console.error('Profile Fetch Error:', profileError)
            return NextResponse.json({ error: 'Database error fetching profiles' }, { status: 500 })
        }

        const cifMap = new Map<string, string>()
        const cfpiMap = new Map<string, string>()

        allProfiles.forEach(p => {
            if (p.cif) cifMap.set(p.cif.trim(), p.id)
            if (p.cfpi) cfpiMap.set(p.cfpi.trim(), p.id)
        })

        console.log(`[Upload] Loaded ${allProfiles.length} profiles from DB for deduplication.`)

        // Tenant config resolved earlier

        // 2. PARSE via Adapter
        const adapter = getAdapterForTenant(tenantSlug, adapterName, mapping)
        await updateProgress('Analisi del file in corso...', 0, 0)

        const { bills: billsToInsert, errors: parseErrors } = await adapter.parse(text, cifMap, cfpiMap)

        // Update stats
        totalFiles = billsToInsert.length
        let processedBills = billsToInsert.length
        let newProfiles = 0
        const errors: string[] = []
        errors.push(...parseErrors)

        const matchedCifIds = new Set<string>()
        const matchedCfpiIds = new Set<string>()

        // Reconstruct stats for the response
        billsToInsert.forEach(b => {
            if (b.user_id) {
                if (b.cif && cifMap.has(b.cif)) matchedCifIds.add(b.user_id)
                else if (b.cfpi && cfpiMap.has(b.cfpi)) matchedCfpiIds.add(b.user_id)
            }
        })

        if (parseErrors.length > 0) {
            await updateProgress(`Rilevati ${parseErrors.length} errori nel parsing`, totalFiles, totalFiles)
        }

        const previewMode = req.nextUrl.searchParams.get('preview') === 'true'
        const forceUpload = req.nextUrl.searchParams.get('force') === 'true'

        if (!previewMode) {
            const chunkSize = 500
            for (let i = 0; i < billsToInsert.length; i += chunkSize) {
                const chunk = billsToInsert.slice(i, i + chunkSize).map(({ original_row_index, ...rest }) => ({
                    ...rest,
                    tenant_id: tenantId
                }))
                const { error: dateError } = await supabase.from('bills').upsert(chunk)
                if (dateError) {
                    console.error('Bill Insert Error', dateError)
                    errors.push(`Batch ${i}: ${dateError.message}`)
                }
                processedTotal += chunk.length
                await updateProgress(`Salvataggio dati ${Math.min(processedTotal, totalFiles)}/${billsToInsert.length}...`, processedTotal, totalFiles)
            }
        }

        const archiveFile = formData.get('archive') as File
        let pdfsUploaded = 0
        let pdfsSkipped = 0
        let pdfsLinked = 0
        let previewPdfCount = 0
        let previewPdfMatches = 0
        let previewAlreadyLinked = 0

        let duplicateArchive = false
        let existingArchiveTotal = 0
        let overwriteWarning = false

        if (archiveFile) {
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
                if (previewMode && !forceUpload) {
                    // Return immediately with warning info so frontend can prompt user
                    // But we continue to get stats if possible?
                    // Actually, in preview mode we want to show the stats BUT warn about the duplicate.
                    // We will add these flags to the JSON response.
                }
            }

            try {
                await updateProgress('Estrazione archivio...', processedTotal, totalFiles)
                const fs = require('fs')
                const path = require('path')
                const no7z = require('node-7z')
                const sevenBin = require('7zip-bin')
                let pathTo7zip = sevenBin.path7za

                if (!fs.existsSync(pathTo7zip)) {
                    const manualPath = path.join(process.cwd(), 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe')
                    if (fs.existsSync(manualPath)) {
                        pathTo7zip = manualPath
                    } else {
                        const manualPathUp = path.join(process.cwd(), '..', 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe')
                        if (fs.existsSync(manualPathUp)) pathTo7zip = manualPathUp
                    }
                }

                const tempDir = path.join(process.cwd(), 'tmp')
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir)

                // Use original filename to prevent duplicates in tmp folder as per user request
                const originalName = archiveFile.name
                const safeName = originalName.replace(/[^a-z0-9.]/gi, '_') // Basic sanitization
                const archivePath = path.join(tempDir, safeName)
                const extractPath = path.join(tempDir, `extract_${safeName.replace(/\./g, '_')}`)

                const buffer = Buffer.from(await archiveFile.arrayBuffer())
                fs.writeFileSync(archivePath, buffer)

                interface SevenZipError extends Error {
                    stderr?: string;
                }

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
                    await updateProgress('Analisi PDF estratti...', 0, totalFiles)

                    // 2. Filter Duplicates (Check DB) & Storage
                    const pdfNames = pdfFiles.map(p => path.basename(p))
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

                    // B. Check Local Storage (public/invoices/TENANT)
                    const storageFilesSet = new Set<string>()
                    const storageSubDir = getTenantStoragePath(tenantSlug)
                    const localInvoicesDir = path.join(process.cwd(), 'public', storageSubDir)

                    if (!fs.existsSync(localInvoicesDir)) { fs.mkdirSync(localInvoicesDir, { recursive: true }) }
                    console.log(`[Upload] Checking Local Storage (${storageSubDir}) for existing files...`)
                    try {
                        const localFiles = fs.readdirSync(localInvoicesDir)
                        localFiles.forEach((f: string) => storageFilesSet.add(f.toLowerCase()))
                    } catch (err) {
                        console.error('Error reading local invoices dir:', err)
                    }
                    console.log(`[Upload] Found ${storageFilesSet.size} files already in Local Storage.`)



                    console.log(`[Upload] Found ${existingPdfMap.size} bills already linked in DB.`)

                    // 3. Upload Non-Duplicates in Parallel
                    // Local FS is fast, but let's keep concurrency controlled to avoid blocking event loop too much
                    const CONCURRENCY = 10
                    for (let i = 0; i < pdfFiles.length; i += CONCURRENCY) {
                        if (req.signal.aborted) throw new Error('Upload aborted by user')

                        const chunk = pdfFiles.slice(i, i + CONCURRENCY)
                        await Promise.all(chunk.map(async (filePath) => {
                            processedTotal++
                            const filename = path.basename(filePath)
                            const lowerFilename = filename.toLowerCase()

                            // Check DB first
                            const existingUrl = existingPdfMap.get(lowerFilename)

                            // IF it is already linked AND it is a local link, we are done.
                            // IF it is linked but to Supabase (http...), we want to proceed to overwrite/migrate it.
                            if (existingUrl && existingUrl.startsWith('/invoices/')) {
                                pdfsSkipped++
                                if (processedTotal % 50 === 0) {
                                    await updateProgress(`Skipped (Already Local): ${filename}`, processedTotal, totalFiles)
                                }
                                return
                            }

                            const targetPath = path.join(localInvoicesDir, filename)
                            let needsUpload = true

                            // Check Local Storage - if exists, skip upload but DO link in DB
                            if (storageFilesSet.has(lowerFilename)) {
                                needsUpload = false
                                // Log skipping upload
                                if (processedTotal % 50 === 0) {
                                    await updateProgress(`Linking Local File: ${filename}`, processedTotal, totalFiles)
                                }
                            } else {
                                if (processedTotal % 10 === 0) {
                                    await updateProgress(`Salvo: ${filename}`, processedTotal, totalFiles)
                                }
                            }

                            try {
                                if (needsUpload) {
                                    const fileBuffer = fs.readFileSync(filePath)
                                    fs.writeFileSync(targetPath, fileBuffer)
                                    pdfsUploaded++
                                }

                                // Use local URL (Multi-Tenant)
                                // storageSubDir is like 'invoices/slug', ensure forward slashes
                                const publicUrl = `/${storageSubDir.replace(/\\/g, '/')}/${filename}`

                                const { error: updateError, data: updatedData } = await supabase
                                    .from('bills')
                                    .update({ pdf_url: publicUrl })
                                    .ilike('nome_pdf', filename) // Use ilike for case-insensitive link
                                    .select('id')

                                if (updateError) {
                                    console.error(`DB Update Error for ${filename}:`, updateError)
                                } else {
                                    // console.log(`DB Update Success for ${filename}:`, updatedData)
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

                // Cleanup with retry for Windows EBUSY
                const cleanup = () => {
                    try {
                        if (fs.existsSync(archivePath)) fs.rmSync(archivePath)
                        if (fs.existsSync(extractPath)) fs.rmSync(extractPath, { recursive: true, force: true })
                    } catch (cleanupErr) {
                        console.error('Cleanup Error (Retrying in 1s):', cleanupErr)
                        setTimeout(() => {
                            try {
                                if (fs.existsSync(archivePath)) fs.rmSync(archivePath)
                                if (fs.existsSync(extractPath)) fs.rmSync(extractPath, { recursive: true, force: true })
                            } catch (retryErr) {
                                console.error('Cleanup Failed permanently:', retryErr)
                            }
                        }, 1000)
                    }
                }
                cleanup()

            } catch (err: any) {
                console.error('Archive Error', err)
                errors.push(`Archive Error: ${err.message}`)
            }
        }

        const uniqueMatchedUsers = new Set([...matchedCifIds, ...matchedCfpiIds]).size

        // Final Completion Log
        if (importId) {
            await updateProgress('Completato', processedTotal, totalFiles, 'completed')
        }

        return NextResponse.json({
            success: true,
            preview: previewMode,
            processed: processedBills,
            newUsers: newProfiles,
            matchedByCif: matchedCifIds.size,
            matchedByCfpi: matchedCfpiIds.size,
            uniqueMatchedUsers,
            pdfsUploaded,
            pdfsSkipped,
            pdfsLinked,
            previewPdfCount,
            previewPdfMatches,
            previewAlreadyLinked: previewAlreadyLinked,
            errors: errors,
            duplicateArchive,
            existingArchiveTotal,
            overwriteWarning: duplicateArchive // If duplicate, it's an overwrite warning
        })
    } catch (unexpectedError: any) {
        console.error('[Upload API] Critical Error:', unexpectedError)
        return NextResponse.json({
            error: unexpectedError.message || 'An unexpected error occurred during upload',
            details: unexpectedError.stack
        }, { status: 500 })
    }
}
