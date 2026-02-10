
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse/sync'

// Use Service Role to bypass RLS for Admin Uploads
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

import { requireAdmin } from '@/lib/auth-checks'

export async function POST(req: NextRequest) {
    const authCheck = await requireAdmin()
    if (authCheck.error) {
        return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
    }

    console.log('[API] Starting Bulk User Upload...')

    try {
        const formData = await req.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'Nessun file fornito' }, { status: 400 })
        }

        const text = await file.text()

        // Header expectations: cif;nominativo;Codice Fiscale;Partita Iva;indirizzo utenza;Comune
        const records = parse(text, {
            columns: true,
            delimiter: ';',
            skip_empty_lines: true,
            trim: true,
            relax_quotes: true
        })

        console.log(`[API] Parsed ${records.length} records.`)

        let successCount = 0
        let errorCount = 0
        const errors: string[] = []

        // Batch processing could be better but loop is fine for <10k records
        // Deduplicate input by Codice Cliente
        const uniquePayloads = new Map<string, any>()

        for (const row of records as any[]) {
            const cif = row['cif'] || row['CIF']
            const nominativo = row['nominativo'] || row['Nominativo'] || row['Ragione Sociale'] || row['denominazione']
            const cf = row['Codice Fiscale'] || row['codice fiscale']
            const piva = row['Partita Iva'] || row['partita iva']
            const address = row['indirizzo utenza'] || row['inidrizzo utenza']
            const city = row['Comune'] || row['comune']

            if (!cif) continue

            // 1. Try to read Codice Cliente from CSV
            let clientCode = row['codice_cliente'] || row['Codice Cliente'] || row['CodiceCliente']

            const cleanCif = cif.trim()

            // 2. If missing, derive from CIF
            if (!clientCode && cleanCif.length >= 6) {
                clientCode = cleanCif.substring(0, 6)
            }

            if (!clientCode) {
                errors.push(`Excluded: No Codice Cliente and CIF too short: ${cleanCif}`)
                errorCount++
                continue
            }

            // Prefer last encountered or handle merging? Last wins for now.
            uniquePayloads.set(clientCode, {
                codice_cliente: clientCode,
                cif: cleanCif, // Keep full CIF for reference
                name: nominativo,
                cfpi: cf || piva,
                address: address,
                city: city,
                is_shadow: true // Mark as shadow user
            })
        }

        console.log(`[API] Processing ${uniquePayloads.size} unique client codes...`)

        for (const payload of uniquePayloads.values()) {
            try {
                // Find existing user by Codice Cliente OR CIF
                // We want to avoid duplicates and only patch missing info
                const { data: existing, error: fetchError } = await supabase
                    .from('profiles')
                    .select('id, codice_cliente, cif')
                    .or(`codice_cliente.eq.${payload.codice_cliente},cif.eq.${payload.cif}`)
                    .maybeSingle()

                if (fetchError) throw fetchError

                if (existing) {
                    // Update ONLY if missing key fields (Safe Update)
                    const updates: any = {}

                    if (!existing.codice_cliente) updates.codice_cliente = payload.codice_cliente
                    if (!existing.cif) updates.cif = payload.cif

                    if (Object.keys(updates).length > 0) {
                        const { error } = await supabase
                            .from('profiles')
                            .update(updates)
                            .eq('id', existing.id)

                        if (error) throw error
                        // console.log(`Patched User ${existing.id}: ${JSON.stringify(updates)}`)
                    }
                    successCount++
                } else {
                    // Start: Insert new Shadow User
                    // We must generate a random UUID because profiles.id is likely PK
                    // And logically, shadow users have a random ID until they register (and claim the profile)
                    // Note: This relies on profiles.id NOT being a strict FK to auth.users, or having a fallback.

                    const { error } = await supabase
                        .from('profiles')
                        .insert(payload) // Supabase should auto-gen ID if configured, else we might need `crypto.randomUUID()`

                    if (error) throw error
                    successCount++
                }
            } catch (err: any) {
                console.error(`[API] Profile Error for ${payload.codice_cliente}:`, err)
                errors.push(`Err ${payload.codice_cliente}: ${err.message}`)
                errorCount++
            }
        }

        return NextResponse.json({
            success: true,
            processed: records.length,
            imported: successCount,
            errors: errors,
            errorCount: errorCount
        })

    } catch (err: any) {
        console.error('[API] Upload Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
