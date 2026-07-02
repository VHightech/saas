import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GDPR Art. 15/20 — Right of access & data portability.
// Returns the authenticated user's own data as a downloadable JSON file.
// Strictly ownership-scoped; internal columns (pdf_url, role, is_shadow) are
// excluded — PDFs remain accessible only via the signed-URL route.
export async function GET() {
    const supabase = await createClient()

    // 1. Authenticate and resolve the caller's own profile (auth_user_id pointer).
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('id, name, email, phone, codice_fiscale, partita_iva, pec, codice_cliente, created_at')
        .eq('auth_user_id', user.id)
        .maybeSingle()

    if (!profile) {
        return NextResponse.json({ error: 'Profilo non disponibile.' }, { status: 404 })
    }

    const profileId = profile.id

    // 2. Fetch child rows with the service-role client, filtered EXPLICITLY by the
    //    just-verified ownership keys (profileId / user.id). In a Route Handler the
    //    user session does not propagate auth.uid() to PostgREST, so RLS-scoped
    //    selects return nothing; manual ownership filtering is the documented
    //    pattern for admin-client use inside a user flow.
    const admin = createAdminClient()

    const [{ data: bills }, { data: supplies }, { data: payments }] = await Promise.all([
        admin
            .from('bills')
            .select('idboll, data_emissione, scadenza, importo, consumo, tipo_servizio, billing_type, ulm, cif')
            .eq('user_id', profileId)
            .order('data_emissione', { ascending: false }),
        admin
            .from('user_supplies')
            .select('cif, address, city, codice_cliente, stadio, stato_contratto, created_at')
            .eq('user_id', profileId)
            .order('created_at', { ascending: true }),
        admin
            .from('payments')
            .select('bill_id, amount, status, created_at')
            .eq('user_id', profileId)
            .order('created_at', { ascending: false }),
    ])

    const exportPayload = {
        export_info: {
            generated_at: new Date().toISOString(),
            description: 'Export dei dati personali ai sensi degli artt. 15 e 20 del GDPR (Regolamento UE 2016/679).',
            subject_id: profileId,
        },
        profile: { ...profile, id: undefined },
        supplies: supplies ?? [],
        bills: bills ?? [],
        payments: payments ?? [],
    }

    const filename = `acquambiente-dati-${profile.codice_cliente || profileId}-${new Date().toISOString().slice(0, 10)}.json`

    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
        status: 200,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store',
        },
    })
}
