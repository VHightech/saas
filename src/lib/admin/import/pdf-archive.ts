import type { SupabaseClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import no7z from 'node-7z'
import sevenBin from '7zip-bin'
import {
    buildInvoiceKey,
    uploadPdfToR2,
    listKeysWithPrefix,
    isR2Configured,
} from '@/lib/r2'
import { sanitizePdfFilename, isSafePdfFilename } from './helpers'
import type { ProgressFn } from './bills-core'

interface SevenZipError extends Error { stderr?: string }

/** Locate the 7za binary, with the same fallbacks the old route used (Windows). */
function resolve7zaPath(): string {
    let p = (sevenBin as { path7za: string }).path7za
    if (fs.existsSync(p)) return p
    const candidates = [
        path.join(process.cwd(), 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe'),
        path.join(process.cwd(), '..', 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe'),
    ]
    for (const c of candidates) if (fs.existsSync(c)) return c
    return p // let node-7z surface a clear error if truly missing
}

function tempPaths(archivePath: string): { archiveCopy: string; extractDir: string; tmpDir: string } {
    const tmpDir = path.join(process.cwd(), 'tmp')
    const safeName = path.basename(archivePath).replace(/[^a-z0-9.]/gi, '_')
    return {
        tmpDir,
        archiveCopy: path.join(tmpDir, safeName),
        extractDir: path.join(tmpDir, `extract_${safeName.replace(/\./g, '_')}`),
    }
}

/** True when `p` is a plain folder rather than a .7z archive file. */
function isDirSource(p: string): boolean {
    return fs.existsSync(p) && fs.statSync(p).isDirectory()
}

/** List all *.pdf entries under a source, which may be a .7z archive or a plain folder. */
async function listSourcePdfNames(sourcePath: string): Promise<string[]> {
    if (isDirSource(sourcePath)) {
        return walkFiles(sourcePath).filter((f) => f.toLowerCase().endsWith('.pdf'))
    }
    return list7zPdfNames(sourcePath, resolve7zaPath())
}

/** List all *.pdf entries inside a 7z without extracting. */
function list7zPdfNames(archivePath: string, bin: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const names: string[] = []
        const stream = no7z.list(archivePath, { $bin: bin, recursive: true })
        stream.on('data', (f: { file?: string }) => {
            if (f.file && f.file.toLowerCase().endsWith('.pdf')) names.push(f.file)
        })
        stream.on('end', () => resolve(names))
        stream.on('error', (e: SevenZipError) => reject(e))
    })
}

/** Map nome_pdf(lowercased) → pdf_url for every linked bill (paged). */
async function loadLinkedPdfMap(sb: SupabaseClient): Promise<Map<string, string>> {
    const map = new Map<string, string>()
    const pageSize = 2500
    let page = 0
    for (;;) {
        const { data, error } = await sb
            .from('bills')
            .select('nome_pdf, pdf_url')
            .not('nome_pdf', 'is', null)
            .range(page * pageSize, (page + 1) * pageSize - 1)
        if (error) break
        for (const d of data ?? []) {
            if (d.nome_pdf) map.set(String(d.nome_pdf).toLowerCase(), (d.pdf_url as string) || '')
        }
        if (!data || data.length < pageSize) break
        page++
    }
    return map
}

export interface ArchiveAnalysis { pdfTotal: number; matches: number; alreadyLinked: number }

export async function analyzeArchive(
    sb: SupabaseClient,
    archivePath: string,
    csvPdfNames: string[],
): Promise<ArchiveAnalysis> {
    const pdfPaths = await listSourcePdfNames(archivePath)
    const zipNames = pdfPaths.map((p) => path.basename(p).toLowerCase())

    const dbMap = await loadLinkedPdfMap(sb)
    const csvSet = new Set(csvPdfNames.map((n) => n.toLowerCase()))

    const matchSet = new Set<string>()
    const alreadyLinked = new Set<string>()
    for (const name of zipNames) {
        if (dbMap.has(name)) {
            matchSet.add(name)
            const url = dbMap.get(name)
            if (url && url.trim().length > 0) alreadyLinked.add(name)
        }
        if (csvSet.has(name)) matchSet.add(name)
    }
    return { pdfTotal: pdfPaths.length, matches: matchSet.size, alreadyLinked: alreadyLinked.size }
}

function extract7z(archivePath: string, extractDir: string, bin: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const stream = no7z.extractFull(archivePath, extractDir, { $bin: bin, recursive: true })
        stream.on('end', () => resolve())
        stream.on('error', (e: SevenZipError) => reject(e))
    })
}

function walkFiles(dir: string, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) return out
    for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry)
        if (fs.statSync(full).isDirectory()) walkFiles(full, out)
        else out.push(full)
    }
    return out
}

export async function processArchive(
    sb: SupabaseClient,
    archivePath: string,
    importId: string,
    onProgress: ProgressFn,
): Promise<{ uploaded: number; skipped: number; linked: number; errors: string[] }> {
    if (!isR2Configured()) {
        throw new Error('R2 non configurato: imposta R2_ACCOUNT_ENDPOINT/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET in .env.local')
    }
    // A folder with the same name as the CSV, containing the PDFs directly,
    // is accepted in place of a .7z archive — no extraction step needed, and
    // (crucially) it must never be deleted by the cleanup below.
    const isDir = isDirSource(archivePath)
    const { tmpDir, archiveCopy, extractDir } = isDir
        ? { tmpDir: null, archiveCopy: null, extractDir: archivePath }
        : tempPaths(archivePath)
    if (tmpDir && !fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

    let uploaded = 0
    let skipped = 0
    let linked = 0
    const errors: string[] = []

    try {
        if (isDir) {
            await onProgress('Lettura cartella PDF…', 0, 0)
        } else {
            // Copy into tmp then extract (node-7z reads from a real path).
            const bin = resolve7zaPath()
            fs.copyFileSync(archivePath, archiveCopy as string)
            await onProgress('Estrazione archivio…', 0, 0)
            await extract7z(archiveCopy as string, extractDir, bin)
        }

        const pdfFiles = walkFiles(extractDir).filter((f) => f.toLowerCase().endsWith('.pdf'))
        const total = pdfFiles.length
        let processed = 0
        await onProgress('Analisi PDF estratti…', 0, total)

        const linkedMap = await loadLinkedPdfMap(sb)
        const existingR2 = await listKeysWithPrefix(importId)

        const CONCURRENCY = 10
        for (let i = 0; i < pdfFiles.length; i += CONCURRENCY) {
            const chunk = pdfFiles.slice(i, i + CONCURRENCY)
            await Promise.all(
                chunk.map(async (filePath) => {
                    processed++
                    const rawName = path.basename(filePath)
                    const filename = sanitizePdfFilename(rawName)
                    if (!isSafePdfFilename(filename)) {
                        errors.push(`Nome file non sicuro, saltato: ${rawName}`)
                        return
                    }
                    const lower = filename.toLowerCase()

                    // Already linked in DB → skip.
                    const existingUrl = linkedMap.get(lower)
                    if (existingUrl && existingUrl.trim().length > 0) {
                        skipped++
                        return
                    }

                    const r2Key = buildInvoiceKey(filename, importId)
                    try {
                        const onR2 = existingR2.has(r2Key)
                        if (!onR2) {
                            await uploadPdfToR2(r2Key, fs.readFileSync(filePath))
                            uploaded++
                        }
                        const { data, error } = await sb
                            .from('bills')
                            .update({ pdf_url: r2Key })
                            .ilike('nome_pdf', filename)
                            .select('id')
                        if (error) errors.push(`Link ${filename}: ${error.message}`)
                        else if (data && data.length > 0) linked++
                    } catch (err) {
                        errors.push(`Errore ${filename}: ${err instanceof Error ? err.message : String(err)}`)
                    }
                }),
            )
            if (processed % 50 === 0 || processed === total) {
                await onProgress(`Upload PDF ${processed}/${total}…`, processed, total)
            }
        }
    } catch (err) {
        errors.push(`Archive Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
        // Cleanup the tmp copy + extraction dir we created — never touch the
        // source when it's the user's own PDF folder (isDir).
        if (!isDir) {
            try { if (archiveCopy && fs.existsSync(archiveCopy)) fs.unlinkSync(archiveCopy) } catch { /* ignore */ }
            try { if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true }) } catch { /* ignore */ }
        }
    }

    return { uploaded, skipped, linked, errors }
}
