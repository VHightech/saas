/**
 * Invio email transazionali via Resend.
 *
 * Perché esiste: oggi tutte le mail del portale (invito admin, reset password)
 * le manda Supabase Auth col suo provider. Per notifiche che non appartengono a
 * un flusso di autenticazione serve un canale nostro.
 *
 * Regole di progetto rispettate qui:
 *   - non fallisce mai in modo rumoroso: chi la chiama sta già completando
 *     un'operazione riuscita, la notifica è best-effort;
 *   - non logga mai l'indirizzo del destinatario (§1.9 delle regole area utente):
 *     solo l'esito e, se serve, il messaggio d'errore del provider;
 *   - se `RESEND_API_KEY` o `MAIL_FROM` non sono configurate non tenta l'invio e
 *     lo dichiara, così il chiamante può dirlo all'operatore invece di far
 *     credere che la mail sia partita.
 */

export type MailResult =
    | { sent: true }
    | { sent: false; reason: 'not_configured' | 'send_failed'; detail?: string }

interface SendMailInput {
    to: string
    subject: string
    html: string
    /** Fallback testuale per i client che non renderizzano HTML. */
    text: string
}

/** Indirizzo mittente. Deve essere su un dominio verificato su Resend. */
function resolveFrom(): string | null {
    const from = process.env.MAIL_FROM?.trim()
    return from && from.length > 0 ? from : null
}

export function isMailerConfigured(): boolean {
    return Boolean(process.env.RESEND_API_KEY?.trim()) && resolveFrom() !== null
}

export async function sendMail({ to, subject, html, text }: SendMailInput): Promise<MailResult> {
    const apiKey = process.env.RESEND_API_KEY?.trim()
    const from = resolveFrom()

    if (!apiKey || !from) {
        console.warn(
            `[mailer] invio saltato: ${!apiKey ? 'RESEND_API_KEY' : 'MAIL_FROM'} non configurata`,
        )
        return { sent: false, reason: 'not_configured' }
    }

    try {
        // Import dinamico: senza chiave il modulo non viene nemmeno caricato.
        const { Resend } = await import('resend')
        const resend = new Resend(apiKey)
        const { error } = await resend.emails.send({ from, to, subject, html, text })

        if (error) {
            // Solo il messaggio del provider: nessun indirizzo nei log.
            console.error(`[mailer] invio fallito: ${error.message}`)
            return { sent: false, reason: 'send_failed', detail: error.message }
        }
        return { sent: true }
    } catch (e) {
        const detail = e instanceof Error ? e.message : String(e)
        console.error(`[mailer] eccezione durante l'invio: ${detail}`)
        return { sent: false, reason: 'send_failed', detail }
    }
}
