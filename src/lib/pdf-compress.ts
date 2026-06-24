import { execFile } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import os from 'os'
import path from 'path'

const execFileAsync = promisify(execFile)

/**
 * PDF compression via Ghostscript, used to shrink invoice PDFs before they are
 * stored on R2 (font subsetting + image downsampling). Text stays vector, so
 * invoices remain crisp and printable.
 *
 * Config (env):
 *   PDF_COMPRESS=off            disable entirely (upload originals)
 *   PDF_COMPRESS_PRESET=/ebook  quality preset: /screen (72dpi) | /ebook (150dpi,
 *                               default) | /printer (300dpi)
 *   GHOSTSCRIPT_PATH=...        explicit path to the gs executable
 *
 * Compression NEVER blocks or fails an upload: if gs is missing, errors, or the
 * result isn't smaller, the original bytes are returned.
 */

let cachedGsPath: string | null | undefined = undefined

function resolveGhostscript(): string | null {
    if (cachedGsPath !== undefined) return cachedGsPath

    const tryAbsolute = (p: string): string | null => {
        try { return fs.existsSync(p) ? p : null } catch { return null }
    }

    // 1. Explicit override.
    if (process.env.GHOSTSCRIPT_PATH) {
        const p = tryAbsolute(process.env.GHOSTSCRIPT_PATH)
        if (p) { cachedGsPath = p; return p }
    }

    // 2. Newest install under "C:\Program Files\gs\gsX.YZ\bin\gswin64c.exe".
    for (const base of ['C:\\Program Files\\gs', 'C:\\Program Files (x86)\\gs']) {
        try {
            if (!fs.existsSync(base)) continue
            const versions = fs.readdirSync(base).sort().reverse()
            for (const ver of versions) {
                for (const exe of ['gswin64c.exe', 'gswin32c.exe']) {
                    const p = path.join(base, ver, 'bin', exe)
                    if (tryAbsolute(p)) { cachedGsPath = p; return p }
                }
            }
        } catch { /* ignore */ }
    }

    // 3. Rely on PATH (Linux/macOS or gs on PATH). If it isn't really there the
    //    execFile below throws and we fall back to the original bytes.
    cachedGsPath = process.platform === 'win32' ? 'gswin64c' : 'gs'
    return cachedGsPath
}

export function isPdfCompressionEnabled(): boolean {
    return process.env.PDF_COMPRESS !== 'off' && resolveGhostscript() !== null
}

/**
 * Compress a PDF on disk and return the bytes to store. Returns the ORIGINAL
 * bytes if compression is disabled, gs is unavailable, it errors, or it didn't
 * actually shrink the file.
 */
export async function compressPdf(inputPath: string): Promise<Buffer> {
    const original = fs.readFileSync(inputPath)

    if (process.env.PDF_COMPRESS === 'off') return original
    const gs = resolveGhostscript()
    if (!gs) return original

    const preset = process.env.PDF_COMPRESS_PRESET || '/ebook'
    const outPath = path.join(os.tmpdir(), `gsc_${process.pid}_${Date.now()}_${Math.floor(Math.random() * 1e9)}.pdf`)

    try {
        await execFileAsync(
            gs,
            [
                '-sDEVICE=pdfwrite',
                '-dCompatibilityLevel=1.5',
                `-dPDFSETTINGS=${preset}`,
                '-dNOPAUSE',
                '-dQUIET',
                '-dBATCH',
                '-dDetectDuplicateImages=true',
                '-dSubsetFonts=true',
                '-dCompressFonts=true',
                `-sOutputFile=${outPath}`,
                inputPath,
            ],
            { timeout: 60_000, windowsHide: true, maxBuffer: 1024 * 1024 },
        )

        if (!fs.existsSync(outPath)) return original
        const compressed = fs.readFileSync(outPath)
        // Only keep the compressed version if it is valid and actually smaller.
        if (compressed.length > 0 && compressed.length < original.length) {
            return compressed
        }
        return original
    } catch {
        return original
    } finally {
        try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath) } catch { /* ignore */ }
    }
}
