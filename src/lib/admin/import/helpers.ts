import fs from 'node:fs'

/**
 * The gestionale exports CSVs in cp1252, not UTF-8: decoding them as UTF-8
 * turns accented letters (Società, CIUCCIOVÈ…) into U+FFFD. Try UTF-8 first;
 * if replacement characters appear, fall back to latin1.
 */
export function readCsvText(filePath: string): string {
    const buf = fs.readFileSync(filePath)
    const utf8 = buf.toString('utf8')
    return utf8.includes('�') ? buf.toString('latin1') : utf8
}

/**
 * Every .csv under `src`, recursively, sorted by path. A file path is returned
 * as-is, so the same argument accepts "una cartella con l'anno" or un singolo file.
 */
export function collectCsvFiles(src: string): string[] {
    if (!fs.existsSync(src)) throw new Error(`Percorso non trovato: ${src}`)
    if (!fs.statSync(src).isDirectory()) return [src]

    const out: string[] = []
    const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = `${dir}/${entry.name}`
            if (entry.isDirectory()) walk(full)
            else if (entry.name.toLowerCase().endsWith('.csv')) out.push(full)
        }
    }
    walk(src)
    return out.sort()
}

/**
 * Runs `fn` over `items` with at most `limit` running concurrently. Unlike
 * fixed-size chunking, a finished item is immediately replaced by the next
 * one instead of waiting for its whole pair/chunk to finish.
 */
export async function runWithConcurrency<T>(
    items: T[],
    limit: number,
    fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
    let next = 0
    async function worker(): Promise<void> {
        while (next < items.length) {
            const i = next++
            await fn(items[i], i)
        }
    }
    const workerCount = Math.max(1, Math.min(limit, items.length))
    await Promise.all(Array.from({ length: workerCount }, () => worker()))
}

/** True for y/yes/s/si (Italian + English), case-insensitive, trimmed. */
export function isAffirmative(answer: string): boolean {
    const a = answer.trim().toLowerCase()
    return a === 'y' || a === 'yes' || a === 's' || a === 'si'
}

/** Strip one layer of surrounding single/double quotes (drag-and-dropped paths). */
export function stripQuotes(raw: string): string {
    return raw.trim().replace(/^["']|["']$/g, '')
}

/** Collapse anything outside [A-Za-z0-9._- space] to underscore (matches old route). */
export function sanitizePdfFilename(rawName: string): string {
    return rawName.replace(/[^A-Za-z0-9._\- ]/g, '_')
}

/** Reject empty, dotfiles, and names longer than 200 chars (matches old route). */
export function isSafePdfFilename(name: string): boolean {
    return Boolean(name) && !name.startsWith('.') && name.length <= 200
}

/**
 * Filter parsed bills to only the new ones: drops any idboll already in `existing`
 * and any idboll seen twice within the batch (protects the UNIQUE index). Bills with
 * a null idboll are always kept.
 */
export function dedupeNewBills<T extends { idboll: number | null }>(
    parsed: T[],
    existing: Set<number>,
): { toInsert: T[]; duplicateCount: number } {
    const seen = new Set<number>()
    const toInsert = parsed.filter((b) => {
        const k = b.idboll
        if (typeof k === 'number' && k > 0) {
            if (existing.has(k) || seen.has(k)) return false
            seen.add(k)
        }
        return true
    })
    return { toInsert, duplicateCount: parsed.length - toInsert.length }
}

/** Run an async fn over fixed-size slices of items, sequentially. */
export async function chunked<T>(
    items: T[],
    size: number,
    fn: (chunk: T[]) => Promise<void>,
): Promise<void> {
    for (let i = 0; i < items.length; i += size) {
        await fn(items.slice(i, i + size))
    }
}
