'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const PAGO_PA_NODE_URL = process.env.PAGO_PA_NODE_URL || 'https://api.uat.platform.pagopa.it'
const PAGO_PA_API_KEY = process.env.PAGO_PA_API_KEY

interface PagoPANodeRequest {
    idPagamento: string
    fiscalCode: string
    amount: number
    email: string
}

export async function initiatePagoPAPayment(billId: number, amount: number) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    if (!Number.isFinite(billId) || billId <= 0) {
        return { error: 'Bolletta non valida.' }
    }
    if (!Number.isFinite(amount) || amount <= 0) {
        return { error: 'Importo non valido.' }
    }

    // RLS-enforced lookup: a user sees only their own bills (admins see all).
    const { data: bill, error: billError } = await supabase
        .from('bills')
        .select('id, user_id, importo, codice_cliente, profiles:user_id(email, codice_fiscale, partita_iva, name)')
        .eq('id', billId)
        .maybeSingle()

    if (billError || !bill) {
        return { error: 'Bolletta non trovata o accesso negato.' }
    }

    if (bill.user_id !== user.id) {
        return { error: 'Non sei autorizzato a pagare questa bolletta.' }
    }

    const billAmount = Number(bill.importo) || 0
    if (Math.abs(billAmount - amount) > 0.01) {
        return { error: 'Importo non corrispondente alla bolletta.' }
    }

    const profile = Array.isArray(bill.profiles) ? bill.profiles[0] : bill.profiles
    const debtorEmail = profile?.email || user.email
    const debtorFiscalCode = profile?.codice_fiscale || profile?.partita_iva
    if (!debtorEmail || !debtorFiscalCode) {
        return { error: 'Dati di fatturazione mancanti. Aggiorna il profilo.' }
    }

    const noticeCode = `30200${billId.toString().padStart(13, '0')}`

    // Create a pending payment row (RLS allows: user_id = auth.uid() AND status = 'pending').
    const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert({
            bill_id: billId,
            user_id: user.id,
            amount,
            method: 'pagopa',
            type: 'saldo',
            status: 'pending',
            pagopa_notice_code: noticeCode,
        })
        .select('id')
        .single()

    if (paymentError || !payment) {
        console.error('[PagoPA] Failed to create pending payment:', paymentError?.message)
        return { error: 'Errore creazione pagamento.' }
    }

    // Real integration path
    if (PAGO_PA_API_KEY) {
        try {
            const payload: PagoPANodeRequest = {
                idPagamento: noticeCode,
                fiscalCode: debtorFiscalCode,
                amount: Math.round(amount * 100),
                email: debtorEmail,
            }

            const response = await fetch(`${PAGO_PA_NODE_URL}/pagopa/api/v2/requests/payments`, {
                method: 'POST',
                headers: {
                    'Ocp-Apim-Subscription-Key': PAGO_PA_API_KEY,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            })

            if (!response.ok) {
                throw new Error(`PagoPA Node Error: ${response.statusText}`)
            }

            const data = await response.json()

            if (data.paymentToken) {
                // Persist token on the pending payment (service role — user can't update it).
                const adminSupabase = createAdminClient()
                await adminSupabase
                    .from('payments')
                    .update({ pagopa_token: data.paymentToken })
                    .eq('id', payment.id)

                return {
                    success: true,
                    paymentUrl: `https://checkout.pagopa.it/ui/payment?id=${data.paymentToken}`,
                    message: 'Reindirizzamento al WISP (PagoPA)...',
                }
            }
        } catch (error) {
            console.error('[PagoPA] Node Integration Failed')
            // Mark payment as failed — service role bypasses the status RLS lock.
            const adminSupabase = createAdminClient()
            await adminSupabase
                .from('payments')
                .update({ status: 'failed' })
                .eq('id', payment.id)
            return { error: 'Errore durante la comunicazione con il Nodo PagoPA.' }
        }
    }

    // Simulation fallback — payment stays 'pending'. Real settlement happens via webhook
    // (TODO: implement /api/pagopa/webhook that marks status='paid' + paid_at).
    return {
        success: true,
        paymentUrl: `https://checkout.pagopa.it/ui/mock-payment?id=${noticeCode}&amount=${amount}`,
        message: 'Reindirizzamento al sistema PagoPA (Simulazione)...',
        paymentId: payment.id,
    }
}
