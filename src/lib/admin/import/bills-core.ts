import type { SupabaseClient } from '@supabase/supabase-js'
import { StandardCsvAdapter } from '@/lib/admin/adapters/standard-csv'
import type { ParsedBill } from '@/lib/admin/adapters/types'
import { dedupeNewBills, chunked } from './helpers'

export type ProgressFn = (current: string, processed: number, total: number) => Promise<void>

export interface BillsAnalysis {
    parsedRows: number
    toInsert: number
    duplicateBills: number
    matchedUsers: number
    parseErrors: string[]
    billsToInsert: ParsedBill[]
}

/** Load every profile's codice_cliente → id (paged) for user linkage. */
async function loadClientCodeMap(sb: SupabaseClient): Promise<Map<string, string>> {
    const map = new Map<string, string>()
    const pageSize = 1000
    let page = 0
    for (;;) {
        const { data, error } = await sb
            .from('profiles')
            .select('id, codice_cliente')
            .range(page * pageSize, (page + 1) * pageSize - 1)
        if (error) throw new Error(`Errore lettura profili: ${error.message}`)
        for (const p of data ?? []) {
            if (p.codice_cliente) map.set(String(p.codice_cliente).trim(), p.id as string)
        }
        if (!data || data.length < pageSize) break
        page++
    }
    return map
}

/** Fetch existing idboll among the parsed set (chunked .in queries). */
async function loadExistingIdbolls(sb: SupabaseClient, idbolls: number[]): Promise<Set<number>> {
    const existing = new Set<number>()
    await chunked(idbolls, 1000, async (chunk) => {
        const { data } = await sb.from('bills').select('idboll').in('idboll', chunk)
        for (const row of data ?? []) {
            if (typeof row.idboll === 'number') existing.add(row.idboll)
        }
    })
    return existing
}

/**
 * @param extraExisting Extra idboll values to treat as already-taken on top of
 * what's in the DB — used when analyzing several CSVs in one batch run, so a
 * bill re-listed in a later month's file isn't staged twice before either has
 * actually been inserted.
 */
export async function analyzeBills(
    sb: SupabaseClient,
    csvText: string,
    extraExisting?: Set<number>,
): Promise<BillsAnalysis> {
    const adapter = new StandardCsvAdapter()
    const { bills: parsed, errors: parseErrors } = await adapter.parse(csvText)

    const idbolls = parsed
        .map((b) => b.idboll)
        .filter((n): n is number => typeof n === 'number' && n > 0)
    const existing = idbolls.length ? await loadExistingIdbolls(sb, idbolls) : new Set<number>()
    if (extraExisting) for (const n of extraExisting) existing.add(n)

    const { toInsert, duplicateCount } = dedupeNewBills(parsed, existing)

    // Link user_id by codice_cliente (mutates the objects we will insert).
    const clientCodeMap = await loadClientCodeMap(sb)
    const matched = new Set<string>()
    for (const b of toInsert) {
        if (b.codice_cliente && clientCodeMap.has(b.codice_cliente)) {
            b.user_id = clientCodeMap.get(b.codice_cliente)!
            matched.add(b.user_id)
        }
    }

    return {
        parsedRows: parsed.length,
        toInsert: toInsert.length,
        duplicateBills: duplicateCount,
        matchedUsers: matched.size,
        parseErrors,
        billsToInsert: toInsert,
    }
}

export async function insertBills(
    sb: SupabaseClient,
    billsToInsert: ParsedBill[],
    importId: string,
    onProgress: ProgressFn,
): Promise<{ inserted: number; errors: string[] }> {
    const errors: string[] = []
    let processed = 0
    const total = billsToInsert.length

    await chunked(billsToInsert, 500, async (chunk) => {
        // Strip fields that aren't columns on bills; attach the FK.
        const rows = chunk.map(({ original_row_index, cfpi, ...rest }) => ({
            ...rest,
            import_log_id: importId || null,
        }))
        const { error } = await sb.from('bills').insert(rows)
        if (error) errors.push(`Batch @${processed}: ${error.message}`)
        processed += chunk.length
        await onProgress(`Salvataggio bollette ${Math.min(processed, total)}/${total}…`, processed, total)
    })

    return { inserted: processed, errors }
}
