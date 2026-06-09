
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

    let importId: string | null = null
    try {
        const formData = await req.formData()
        const file = formData.get('file') as File
        importId = (formData.get('importId') as string) || null

        if (!file) {
            return NextResponse.json({ error: 'Nessun file fornito' }, { status: 400 })
        }

        const text = await file.text()

        // Header: CIF;RagioneSociale;CodiceFiscale;PartitaIva;stadio;statoContratto;Mail;PEC;indirizzo;comune
        const records = parse(text, {
            columns: true,
            delimiter: ';',
            skip_empty_lines: true,
            trim: true,
            relax_quotes: true
        })

        console.log(`[API] Parsed ${records.length} records.`)

        // Persist progress in import_logs so the GlobalProgressBar can poll and
        // resume after a page reload. r2_path = importId (provided by the client).
        if (importId) {
            await supabase.from('import_logs').upsert({
                r2_path: importId,
                kind: 'users',
                archive_name: file.name,
                status: 'processing',
                total_files: records.length,
                processed_files: 0,
                current_file: 'Parsing CSV...'
            }, { onConflict: 'r2_path' })
        }

        const updateProgress = async (processed: number, currentFile: string) => {
            if (!importId) return
            await supabase
                .from('import_logs')
                .update({ processed_files: processed, current_file: currentFile })
                .eq('r2_path', importId)
        }

        let successCount = 0
        let errorCount = 0
        const errors: string[] = []

        // profilePayloads — una riga per codice_cliente (un cliente ha N forniture)
        // supplyPayloads  — una riga per cif (ogni cif = una fornitura)
        const profilePayloads = new Map<string, any>()
        const supplyPayloads = new Map<string, any>()

        let skippedAnnullato = 0
        let skippedNoCif = 0
        let skippedShortCif = 0

        const clean = (v: unknown) => (v == null ? null : String(v).trim() || null)

        for (const row of records as any[]) {
            const cif = clean(row['CIF'])
            const name = clean(row['RagioneSociale'])
            const codiceFiscale = clean(row['CodiceFiscale'])
            const partitaIva = clean(row['PartitaIva'])
            const stadio = clean(row['stadio'])
            const statoContratto = clean(row['statoContratto'])
            const pec = clean(row['PEC'])?.toLowerCase() ?? null
            const emailRaw = clean(row['Mail'])
            const email = emailRaw ? emailRaw.toLowerCase() : null
            const address = clean(row['indirizzo'])
            const city = clean(row['comune'])

            // 08 = contratto annullato: aggiorniamo la fornitura ma non creiamo
            // un profilo nuovo solo per un contratto annullato.
            const isAnnullato = statoContratto === '08'
            if (isAnnullato) skippedAnnullato++

            if (!cif) { skippedNoCif++; continue }

            // Nessun codice_cliente nell'header → si deriva dai primi 6 del CIF.
            let clientCode: string | null = null
            if (cif.length >= 6) clientCode = cif.substring(0, 6)
            if (!clientCode) {
                skippedShortCif++
                errors.push(`Excluded: CIF troppo corto: ${cif}`)
                errorCount++
                continue
            }

            if (!isAnnullato) {
                profilePayloads.set(clientCode, {
                    codice_cliente: clientCode,
                    name,
                    codice_fiscale: codiceFiscale,
                    partita_iva: partitaIva,
                    email,
                    pec,
                    is_shadow: true,
                    role: 'user',
                })
            }

            supplyPayloads.set(cif, {
                codice_cliente: clientCode,
                cif,
                address,
                city,
                stadio,
                stato_contratto: statoContratto,
            })
        }

        console.log(
            `[API] Parsed ${records.length} → ${profilePayloads.size} profiles, ${supplyPayloads.size} supplies. ` +
            `Skipped: annullati=${skippedAnnullato}, noCif=${skippedNoCif}, shortCif=${skippedShortCif}`
        )

        let processedSoFar = 0
        let lastProgressFlush = 0
        for (const payload of profilePayloads.values()) {
            try {
                const { data: existing, error: fetchError } = await supabase
                    .from('profiles')
                    .select('id, codice_cliente, email, name, codice_fiscale, partita_iva, pec, is_shadow')
                    .eq('codice_cliente', payload.codice_cliente)
                    .maybeSingle()

                if (fetchError) throw fetchError

                if (existing) {
                    const updates: any = {}
                    if (!existing.codice_cliente) updates.codice_cliente = payload.codice_cliente

                    // "Il file vince": sovrascrivi se il file porta un valore non vuoto e diverso.
                    // Un valore vuoto nel file NON cancella il dato a sistema.
                    for (const field of ['name', 'codice_fiscale', 'partita_iva', 'pec'] as const) {
                        const incoming = payload[field]
                        if (incoming && incoming !== existing[field]) updates[field] = incoming
                    }

                    // Email: shadow o vuota → aggiorna; utente attivo con mail diversa → SOLO segnalazione.
                    if (payload.email) {
                        const currentEmail = (existing.email || '').toLowerCase().trim()
                        if (payload.email !== currentEmail) {
                            if (!currentEmail || existing.is_shadow) {
                                updates.email = payload.email
                            } else {
                                errors.push(
                                    `Email cambiata per utente attivo ${payload.codice_cliente}: ignorata (la mail di login non si aggiorna da CSV).`
                                )
                            }
                        }
                    }

                    if (Object.keys(updates).length > 0) {
                        const { error } = await supabase
                            .from('profiles')
                            .update(updates)
                            .eq('id', existing.id)
                        if (error) throw error
                    }
                    successCount++
                } else {
                    const { error } = await supabase.from('profiles').insert(payload)
                    if (error) throw error
                    successCount++
                }
            } catch (err: any) {
                console.error(`[API] Profile Error for ${payload.codice_cliente}:`, err?.message)
                errors.push(`Err ${payload.codice_cliente}: ${err.message}`)
                errorCount++
            }

            processedSoFar++
            if (processedSoFar - lastProgressFlush >= 50) {
                lastProgressFlush = processedSoFar
                const reportProcessed = Math.round((processedSoFar / profilePayloads.size) * records.length * 0.85)
                await updateProgress(reportProcessed, `Profili ${processedSoFar}/${profilePayloads.size}`)
            }
        }

        console.log(`[API] Finished processing ${profilePayloads.size} users. Success: ${successCount}`)
        await updateProgress(Math.round(records.length * 0.85), 'Salvataggio forniture...')

        // Persist EVERY fornitura: a customer with N CIFs must have N rows in
        // user_supplies, even though they collapse into a single profile.
        // Upsert on cif (unique constraint added in migration 20260506000000).
        let suppliesInserted = 0
        let suppliesError = 0
        const supplyRows = Array.from(supplyPayloads.values())
        const CHUNK = 1000
        for (let i = 0; i < supplyRows.length; i += CHUNK) {
            const chunk = supplyRows.slice(i, i + CHUNK)
            const { error: supErr, count } = await supabase
                .from('user_supplies')
                .upsert(chunk, { onConflict: 'cif', ignoreDuplicates: false, count: 'exact' })
            if (supErr) {
                suppliesError += chunk.length
                console.error('[API] user_supplies upsert error:', supErr.message)
                errors.push(`Supplies chunk ${i}: ${supErr.message}`)
            } else {
                suppliesInserted += count ?? chunk.length
            }
        }
        console.log(`[API] user_supplies upserted: ${suppliesInserted} ok, ${suppliesError} failed.`)
        await updateProgress(Math.round(records.length * 0.95), 'Collegamento bollette...')

        // Mass-link orphaned bills/supplies to the freshly-imported profiles.
        // The RPC matches by CIF and by codice_cliente (see migration
        // 20260506000000_fix_mass_link_and_default_role.sql).
        let linkSummary: Record<string, number> | null = null
        const { data: linkData, error: linkError } = await supabase.rpc('mass_link_orphaned_data')
        if (linkError) {
            console.error('[API] mass_link_orphaned_data RPC failed:', linkError.message)
            errors.push(`Mass-link RPC failed: ${linkError.message}`)
        } else if (Array.isArray(linkData) && linkData.length > 0) {
            linkSummary = linkData[0] as Record<string, number>
            console.log('[API] Mass-link summary:', linkSummary)
        }

        const summary = {
            success: true,
            processed: records.length,
            imported: successCount,
            profiles: profilePayloads.size,
            supplies: { upserted: suppliesInserted, failed: suppliesError, total: supplyRows.length },
            skipped: {
                contrattoAnnullato: skippedAnnullato,
                noCif: skippedNoCif,
                shortCif: skippedShortCif
            },
            errors: errors,
            errorCount: errorCount,
            link: linkSummary
        }

        if (importId) {
            await supabase
                .from('import_logs')
                .update({
                    status: 'completed',
                    processed_files: records.length,
                    current_file: 'Importazione completata',
                    errors: { summary, list: errors }
                })
                .eq('r2_path', importId)
        }

        return NextResponse.json(summary)

    } catch (err: any) {
        console.error('[API] Upload Error:', err)
        if (importId) {
            await supabase
                .from('import_logs')
                .update({
                    status: 'error',
                    current_file: err.message?.slice(0, 200) ?? 'Errore',
                    errors: { message: err.message }
                })
                .eq('r2_path', importId)
        }
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
