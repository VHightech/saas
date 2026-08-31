/**
 * Render + invio della notifica "indirizzo email associato".
 *
 * Sta in un file separato dal Server Action perché `actions.ts` è `.ts` e non può
 * contenere JSX, e separato dal template perché quello resta puramente
 * presentazionale.
 */
import { render } from '@react-email/render'
import EmailAssociatedEmail, { type EmailAssociatedMode } from '@/components/emails/email-associated'
import { sendMail, type MailResult } from '@/lib/mailer'
import { CED_EMAIL } from '@/lib/support-contacts'

const SUBJECT: Record<EmailAssociatedMode, string> = {
    added: 'Il tuo indirizzo email è stato associato all’utenza',
    updated: 'L’indirizzo email della tua utenza è stato aggiornato',
}

function portalUrl(): string {
    return process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://portaleacq.vercel.app'
}

/**
 * Avvisa il cliente che il suo indirizzo è stato associato all'utenza.
 * Non lancia: l'esito torna al chiamante, che ha già salvato il dato.
 */
export async function notifyEmailAssociated(input: {
    to: string
    name?: string | null
    /** 'added' se l'utenza non aveva email, 'updated' se e' stata cambiata. */
    mode: EmailAssociatedMode
}): Promise<MailResult> {
    const element = (
        <EmailAssociatedEmail name={input.name} portalUrl={portalUrl()} mode={input.mode} />
    )

    const [html, text] = await Promise.all([
        render(element),
        render(element, { plainText: true }),
    ])

    // replyTo esplicito: MAIL_FROM è un noreply@, quindi una risposta del cliente
    // andrebbe persa. Così arriva a chi può effettivamente correggere l'indirizzo.
    return sendMail({ to: input.to, subject: SUBJECT[input.mode], html, text, replyTo: CED_EMAIL })
}
