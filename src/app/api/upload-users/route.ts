import { NextRequest, NextResponse } from 'next/server'
import { parse } from 'csv-parse/sync'
import { requireAdmin } from '@/lib/auth-checks'
import { createAdminClient } from '@/lib/supabase/admin'
import { createImportProgress } from '@/lib/admin/import-progress'

export async function POST(req: NextRequest) {
    // Service-role client, per request (admin-gated below) — never a module singleton.
    const supabase = createAdminClient()
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

        // Header expectations: cif;nominativo;Codice Fiscale;Partita Iva;indirizzo utenza;Comune
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
        // throttleMs: 0 — this route already paces updates by row count.
        const progress = createImportProgress(supabase, importId, {
            kind: 'users',
            archiveName: file.name,
            throttleMs: 0,
        })
        if (importId) {
            await progress.init(records.length, 'Parsing CSV...')
        }

        const updateProgress = (processed: number, currentFile: string) =>
            progress.update(currentFile, processed, records.length)

        let successCount = 0
        let errorCount = 0
        const errors: string[] = []

        // We build two maps:
        //   profilePayloads — one row per unique codice_cliente (a customer can have many forniture)
        //   supplyPayloads  — one row per unique cif (each cif = one fornitura/utenza)
        const profilePayloads = new Map<string, any>()
        const supplyPayloads = new Map<string, any>()

        let skippedAnnullato = 0
        let skippedNoCif = 0
        let skippedShortCif = 0

        for (const row of records as any[]) {
            const cif = row['cif'] || row['CIF']
            const nominativo = row['nominativo'] || row['Nominativo'] || row['Ragione Sociale'] || row['denominazione']
            const cf = row['Codice Fiscale'] || row['codice fiscale']
            const piva = row['Partita Iva'] || row['partita iva']
            const address = row['indirizzo utenza'] || row['inidrizzo utenza']
            const city = row['Comune'] || row['comune']
            const stadio = row['STADIO'] || row['stadio'] || row['Stadio']
            const statoContratto = row['STATO CONTRATTO'] || row['stato contratto'] || row['Stato Contratto'] || row['stato_contratto']
            const emailRaw = row['email'] || row['Email'] || row['EMAIL'] || row['e-mail'] || row['E-mail']
            const email = emailRaw ? String(emailRaw).trim().toLowerCase() : null

            // 08 = contratto annullato. We still upsert the supply so existing
            // rows get the fresh status reflected, but we don't create a brand
            // new profile just for an annullato contract.
            const isAnnullato = statoContratto === '08'
            if (isAnnullato) skippedAnnullato++

            if (!cif) { skippedNoCif++; continue }

            let clientCode = row['codice_cliente'] || row['Codice Cliente'] || row['CodiceCliente']
            const cleanCif = String(cif).trim()

            if (!clientCode && cleanCif.length >= 6) {
                clientCode = cleanCif.substring(0, 6)
            }

            if (!clientCode) {
                skippedShortCif++
                errors.push(`Excluded: No Codice Cliente and CIF too short: ${cleanCif}`)
                errorCount++
                continue
            }

            // Profile: dedup by codice_cliente (last wins). One profilo per cliente.
            // We store the Name and Fiscal Code (cfpi) as they are global to the user.
            // Skip profile creation for annullato-only rows; supplies are still upserted.
            if (!isAnnullato) {
                profilePayloads.set(String(clientCode).trim(), {
                    codice_cliente: String(clientCode).trim(),
                    name: nominativo,
                    cfpi: cf || piva,
                    email,
                    is_shadow: true,
                    role: 'user'
                })
            }

            // Supply: one row per cif (every fornitura must be persisted, even if the
            // customer has multiple). user_id stays null and gets attached afterwards
            // by mass_link_orphaned_data().
            supplyPayloads.set(cleanCif, {
                codice_cliente: String(clientCode).trim(),
                cif: cleanCif,
                address: address,
                city: city,
                stadio: stadio,
                stato_contratto: statoContratto
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
                // Find existing user by Codice Cliente. We patch:
                //  - codice_cliente if missing
                //  - email when the row brings a new one (always for shadow profiles
                //    still pending activation, and to fill in if previously missing).
                //    Activated profiles (is_shadow=false) keep their auth-linked
                //    email — we don't silently overwrite it from CSV.
                //  - name / cfpi if currently empty
                // Supply-level fields (stadio, stato_contratto) are not stored on
                // the profile; the user_supplies upsert below already overwrites
                // them so the "newest contract status" is kept fresh per fornitura.
                const { data: existing, error: fetchError } = await supabase
                    .from('profiles')
                    .select('id, codice_cliente, email, name, cfpi, is_shadow')
                    .eq('codice_cliente', payload.codice_cliente)
                    .maybeSingle()

                if (fetchError) throw fetchError

                if (existing) {
                    const updates: any = {}
                    if (!existing.codice_cliente) updates.codice_cliente = payload.codice_cliente
                    if (!existing.name && payload.name) updates.name = payload.name
                    if (!existing.cfpi && payload.cfpi) updates.cfpi = payload.cfpi

                    if (payload.email) {
                        const currentEmail = (existing.email || '').toLowerCase().trim()
                        const incomingEmail = payload.email
                        if (incomingEmail !== currentEmail) {
                            if (!currentEmail || existing.is_shadow) {
                                // Safe to refresh: no previous email, or user has not
                                // activated yet (no auth.users record bound to it).
                                updates.email = incomingEmail
                            } else {
                                errors.push(
                                    `Email change for activated user ${payload.codice_cliente} ignored (CSV "${incomingEmail}" vs auth-linked "${currentEmail}"). Update auth.users separately.`
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

            processedSoFar++
            // Throttle: flush progress every 50 records to avoid hammering DB
            if (processedSoFar - lastProgressFlush >= 50) {
                lastProgressFlush = processedSoFar
                // Use total records count (not just profile dedup count) so the bar reflects CSV reality
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
