import type { SupabaseClient } from '@supabase/supabase-js'
import type { ParsedBill } from '@/lib/admin/adapters/types'

export interface PartitionResult {
    billsToInsert: ParsedBill[]
    duplicateBillCount: number
}

/**
 * Split parsed bills into those new to the system vs duplicates. A bill is a
 * duplicate if its `idboll` already exists in the bills table OR appears earlier
 * in this same batch (protects the UNIQUE index on idboll). Bills without a
 * positive numeric idboll are always kept.
 */
export async function partitionNewBills(
    supabase: SupabaseClient,
    parsedBills: ParsedBill[],
): Promise<PartitionResult> {
    const allDocNumbers = parsedBills
        .map(b => (b as any).idboll as number | null)
        .filter((n): n is number => typeof n === 'number' && n > 0)

    const existingNumbers = new Set<number>()
    if (allDocNumbers.length > 0) {
        const chunkSize = 1000
        for (let i = 0; i < allDocNumbers.length; i += chunkSize) {
            const chunk = allDocNumbers.slice(i, i + chunkSize)
            const { data: existing } = await supabase
                .from('bills')
                .select('idboll')
                .in('idboll', chunk)

            if (existing) {
                existing.forEach(row => {
                    if (typeof row.idboll === 'number') existingNumbers.add(row.idboll)
                })
            }
        }
    }

    const seenInBatch = new Set<number>()
    const billsToInsert = parsedBills.filter(b => {
        const k = (b as any).idboll as number | null
        if (typeof k === 'number' && k > 0) {
            if (existingNumbers.has(k) || seenInBatch.has(k)) return false
            seenInBatch.add(k)
        }
        return true
    })

    return { billsToInsert, duplicateBillCount: parsedBills.length - billsToInsert.length }
}
