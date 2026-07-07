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
