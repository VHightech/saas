
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
        for (const row of records as any[]) {
            try {
                const cif = row['cif'] || row['CIF']
                const nominativo = row['nominativo'] || row['Nominativo'] || row['Ragione Sociale']
                const cf = row['Codice Fiscale'] || row['codice fiscale']
                const piva = row['Partita Iva'] || row['partita iva']
                // Handle specific typo observed in user file 'inidrizzo utenza'
                const address = row['indirizzo utenza'] || row['inidrizzo utenza']
                const city = row['Comune'] || row['comune']

                if (!cif) {
                    // Skip or log?
                    // console.warn('Skipping row missing CIF', row)
                    continue
                }

                const cfpi = cf || piva

                const payload = {
                    cif: cif,
                    name: nominativo,

                    cfpi: cfpi,
                    address: address,
                    city: city,
                    // created_at? default
                }

                const { error } = await supabase
                    .from('profiles')
                    .upsert(payload, { onConflict: 'cif' })

                if (error) {
                    errors.push(`CIF ${cif}: ${error.message}`)
                    errorCount++
                } else {
                    successCount++
                }

            } catch (err: any) {
                errors.push(`Row Error: ${err.message}`)
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
