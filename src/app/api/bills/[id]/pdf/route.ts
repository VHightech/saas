import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getSignedPdfUrl, isR2Configured, pdfExistsOnR2 } from '@/lib/r2'

interface BillRow {
    id: number
    user_id: string | null
    pdf_url: string | null
    nome_pdf: string | null
    idboll: number | null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const billId = Number(id)

    if (!Number.isFinite(billId) || billId <= 0) {
        return NextResponse.json({ error: 'Invalid bill id' }, { status: 400 })
    }

    const serverClient = await createServerClient()
    const { data: { user } } = await serverClient.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Service-role client: admins need to fetch PDFs that are not theirs, but we enforce
    // authorization manually below (owner OR admin/super_admin).
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Two parametrised lookups — no PostgREST operator interpolation.
    let bill: BillRow | null = null
    const byId = await supabaseAdmin
        .from('bills')
        .select('id, user_id, pdf_url, nome_pdf, idboll')
        .eq('id', billId)
        .maybeSingle<BillRow>()
    if (byId.data) {
        bill = byId.data
    } else {
        const byIdBoll = await supabaseAdmin
            .from('bills')
            .select('id, user_id, pdf_url, nome_pdf, idboll')
            .eq('idboll', billId)
            .limit(1)
            .maybeSingle<BillRow>()
        bill = byIdBoll.data
    }

    if (!bill) {
        return NextResponse.json({ error: 'Bolletta non trovata' }, { status: 404 })
    }

    // Authorization: owner OR admin/super_admin.
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

    const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'
    const isOwner = bill.user_id !== null && bill.user_id === user.id

    if (!isAdmin && !isOwner) {
        return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
    }

    const rawKey = bill.pdf_url
    if (!rawKey) {
        return NextResponse.json({ error: 'PDF non disponibile' }, { status: 404 })
    }

    if (!isR2Configured()) {
        console.error('[pdf] R2 is not configured')
        return NextResponse.json({ error: 'Storage non configurato' }, { status: 500 })
    }

    const r2Key = rawKey.startsWith('/') ? rawKey.slice(1) : rawKey

    try {
        const exists = await pdfExistsOnR2(r2Key)
        if (!exists) {
            console.error(`[pdf] Object missing on R2 bill=${bill.id} key="${r2Key}"`)
            return NextResponse.json({ error: 'PDF non presente su R2' }, { status: 404 })
        }

        const signed = await getSignedPdfUrl(r2Key, 300)
        return NextResponse.redirect(signed, 302)
    } catch (e) {
        console.error(`[pdf] Failed to serve bill=${bill.id}`)
        return NextResponse.json({ error: 'Errore nel recupero del PDF' }, { status: 500 })
    }
}
