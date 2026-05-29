import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Load every profile's codice_cliente → id mapping (paged) for linking imported
 * bills to their owner. Throws on a DB error so the caller can surface a 500.
 */
export async function loadProfileCodeMap(supabase: SupabaseClient): Promise<Map<string, string>> {
    const allProfiles: any[] = []
    let hasMore = true
    let page = 0
    const pageSize = 1000

    while (hasMore) {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, codice_cliente')
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

    const clientCodeMap = new Map<string, string>()
    allProfiles.forEach(p => {
        if (p.codice_cliente) clientCodeMap.set(p.codice_cliente.trim(), p.id)
    })
    return clientCodeMap
}
