import type { SupabaseClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse/sync'
import { chunked } from './helpers'
import type { ProgressFn } from './bills-core'

interface ProfilePayload {
    codice_cliente: string
    name: string | null
    codice_fiscale: string | null
    partita_iva: string | null
    email: string | null
    pec: string | null
    is_shadow: boolean
    role: 'user'
}
interface SupplyPayload {
    codice_cliente: string
    cif: string
    address: string | null
    city: string | null
    stadio: string | null
    stato_contratto: string | null
    email: string | null
}

export interface UsersAnalysis {
    records: number
    profiles: number
    supplies: number
    skipped: { annullato: number; noCif: number; shortCif: number; admin: number }
    skipMessages: string[]
    profilePayloads: Map<string, ProfilePayload>
    supplyPayloads: Map<string, SupplyPayload>
}

const clean = (v: unknown): string | null => (v == null ? null : String(v).trim() || null)

/**
 * Case-insensitive column access: the export changed header casing between
 * versions (stadio/statoContratto vs Stadio/StatoContratto), and a literal
 * row['statoContratto'] silently reads undefined on the newer files.
 */
function buildColumnGetter(sample: Record<string, string>) {
    const byLower = new Map<string, string>()
    for (const k of Object.keys(sample)) byLower.set(k.toLowerCase(), k)
    return (row: Record<string, string>, name: string): string | null =>
        clean(row[byLower.get(name.toLowerCase()) ?? name])
}

// Duplicate-CIF resolution: the export can list the same CIF twice (e.g. old
// CHIUSO contract + its ATTIVO renewal). Prefer the row whose stato ranks
// higher; ties keep the later row (previous behaviour).
const STATO_RANK: Record<string, number> = { 'ATTIVO': 4, 'IN LAVORAZIONE': 3, 'CHIUSO': 2, 'ANNULLATO': 1 }
const statoRank = (s: string | null): number => STATO_RANK[(s ?? '').toUpperCase()] ?? 0

export async function analyzeUsers(sb: SupabaseClient, csvText: string): Promise<UsersAnalysis> {
    const records = parse(csvText, {
        columns: true,
        delimiter: ';',
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true,
    }) as Record<string, string>[]

    // Reserved admin codice_cliente values must never be touched by an import.
    const { data: adminRows } = await sb
        .from('profiles')
        .select('codice_cliente')
        .in('role', ['admin', 'super_admin', 'superadmin'])
        .not('codice_cliente', 'is', null)
    const adminCodes = new Set<string>((adminRows ?? []).map((r) => r.codice_cliente as string))

    const profilePayloads = new Map<string, ProfilePayload>()
    const supplyPayloads = new Map<string, SupplyPayload>()
    const skipped = { annullato: 0, noCif: 0, shortCif: 0, admin: 0 }
    const skipMessages: string[] = []

    const col = records.length > 0 ? buildColumnGetter(records[0]) : null

    for (const row of records) {
        if (!col) break
        const cif = col(row, 'CIF')
        const statoContratto = col(row, 'statoContratto')
        // The export has used both numeric codes ('08') and text labels
        // ('ANNULLATO') for cancelled contracts, depending on its version.
        const isAnnullato = statoContratto === '08' || (statoContratto ?? '').toUpperCase() === 'ANNULLATO'
        if (isAnnullato) skipped.annullato++
        if (!cif) { skipped.noCif++; continue }

        const clientCode = cif.length >= 6 ? cif.substring(0, 6) : null
        if (!clientCode) {
            skipped.shortCif++
            skipMessages.push(`Escluso: CIF troppo corto: ${cif}`)
            continue
        }
        if (adminCodes.has(clientCode)) {
            skipped.admin++
            skipMessages.push(`Saltato: codice ${clientCode} riservato a un amministratore.`)
            continue
        }

        const emailRaw = col(row, 'Mail')
        if (!isAnnullato) {
            profilePayloads.set(clientCode, {
                codice_cliente: clientCode,
                name: col(row, 'RagioneSociale'),
                codice_fiscale: col(row, 'CodiceFiscale'),
                partita_iva: col(row, 'PartitaIva'),
                email: emailRaw ? emailRaw.toLowerCase() : null,
                pec: col(row, 'PEC')?.toLowerCase() ?? null,
                is_shadow: true,
                role: 'user',
            })
        }

        const payload: SupplyPayload = {
            codice_cliente: clientCode,
            cif,
            address: col(row, 'indirizzo'),
            city: col(row, 'comune'),
            stadio: col(row, 'stadio'),
            stato_contratto: statoContratto,
            // Each CSV row is one fornitura: its Mail belongs to the supply,
            // not to the profile (where multiple rows would overwrite it).
            email: emailRaw ? emailRaw.toLowerCase() : null,
        }

        const existing = supplyPayloads.get(cif)
        if (!existing) {
            supplyPayloads.set(cif, payload)
        } else {
            const keepNew = statoRank(payload.stato_contratto) >= statoRank(existing.stato_contratto)
            const winner = keepNew ? payload : existing
            const loser = keepNew ? existing : payload
            // Never lose contact data to a duplicate row without an email.
            supplyPayloads.set(cif, winner.email ? winner : { ...winner, email: loser.email })
            skipMessages.push(
                `CIF duplicato nel CSV (${cif}): tenuta la riga con stato ${winner.stato_contratto ?? '?'}`
                + (loser.address !== winner.address ? ` — ATTENZIONE indirizzi diversi ("${loser.address}" scartato)` : '')
            )
        }
    }

    return {
        records: records.length,
        profiles: profilePayloads.size,
        supplies: supplyPayloads.size,
        skipped,
        skipMessages,
        profilePayloads,
        supplyPayloads,
    }
}

export async function commitUsers(
    sb: SupabaseClient,
    analysis: UsersAnalysis,
    onProgress: ProgressFn,
): Promise<{ imported: number; suppliesUpserted: number; errors: string[]; link: Record<string, number> | null }> {
    const errors: string[] = []
    let imported = 0
    const profiles = [...analysis.profilePayloads.values()]
    const total = analysis.records

    let done = 0
    for (const payload of profiles) {
        try {
            const { data: existing, error: fetchErr } = await sb
                .from('profiles')
                .select('id, codice_cliente, email, name, codice_fiscale, partita_iva, pec, is_shadow')
                .eq('codice_cliente', payload.codice_cliente)
                .maybeSingle()
            if (fetchErr) throw fetchErr

            if (existing) {
                const updates: Record<string, unknown> = {}
                if (!existing.codice_cliente) updates.codice_cliente = payload.codice_cliente
                for (const f of ['name', 'codice_fiscale', 'partita_iva', 'pec'] as const) {
                    const incoming = payload[f]
                    if (incoming && incoming !== existing[f]) updates[f] = incoming
                }
                if (payload.email) {
                    const cur = (existing.email || '').toLowerCase().trim()
                    if (payload.email !== cur && (!cur || existing.is_shadow)) updates.email = payload.email
                    else if (payload.email !== cur) {
                        errors.push(`Email cambiata per utente attivo ${payload.codice_cliente}: ignorata.`)
                    }
                }
                if (Object.keys(updates).length > 0) {
                    const { error } = await sb.from('profiles').update(updates).eq('id', existing.id)
                    if (error) throw error
                }
            } else {
                const { error } = await sb.from('profiles').insert(payload)
                if (error) throw error
            }
            imported++
        } catch (err) {
            errors.push(`Profilo ${payload.codice_cliente}: ${err instanceof Error ? err.message : String(err)}`)
        }
        done++
        if (done % 50 === 0) await onProgress(`Profili ${done}/${profiles.length}…`, Math.round((done / profiles.length) * total * 0.85), total)
    }

    await onProgress('Salvataggio forniture…', Math.round(total * 0.85), total)
    let suppliesUpserted = 0
    const supplyRows = [...analysis.supplyPayloads.values()]
    await chunked(supplyRows, 1000, async (chunk) => {
        const { error, count } = await sb
            .from('user_supplies')
            .upsert(chunk, { onConflict: 'cif', ignoreDuplicates: false, count: 'exact' })
        if (error) errors.push(`Forniture: ${error.message}`)
        else suppliesUpserted += count ?? chunk.length
    })

    await onProgress('Collegamento bollette…', Math.round(total * 0.95), total)
    let link: Record<string, number> | null = null
    const { data: linkData, error: linkErr } = await sb.rpc('mass_link_orphaned_data')
    if (linkErr) errors.push(`Mass-link RPC: ${linkErr.message}`)
    else if (Array.isArray(linkData) && linkData.length > 0) link = linkData[0] as Record<string, number>

    return { imported, suppliesUpserted, errors, link }
}
