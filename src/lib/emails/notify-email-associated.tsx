/**
 * Render + invio della notifica "indirizzo email associato".
 *
 * Sta in un file separato dal Server Action perché `actions.ts` è `.ts` e non può
 * contenere JSX, e separato dal template perché quello resta puramente
 * presentazionale.
 */
import { render } from '@react-email/render'
import EmailAssociatedEmail from '@/components/emails/email-associated'
import { sendMail, type MailResult } from '@/lib/mailer'

const SUBJECT = 'Il tuo indirizzo email è stato associato all’utenza'

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
}): Promise<MailResult> {
    const element = <EmailAssociatedEmail name={input.name} portalUrl={portalUrl()} />

    const [html, text] = await Promise.all([
        render(element),
        render(element, { plainText: true }),
    ])

    return sendMail({ to: input.to, subject: SUBJECT, html, text })
}
