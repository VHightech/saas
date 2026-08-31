/**
 * Invio email transazionali via SMTP.
 *
 * Perché esiste: le mail di autenticazione (invito, set-password, reset) le manda
 * Supabase Auth, ma solo come effetto collaterale di un'operazione auth. Per una
 * notifica che non appartiene a nessun flusso di autenticazione serve un canale
 * nostro — verificato il 2026-08-31 che la security notification "Email address
 * changed" NON scatta per le modifiche fatte via admin API.
 *
 * Perché SMTP e non un'API HTTP: usiamo le stesse credenziali SMTP già
 * configurate su Supabase, che consegnano regolarmente invito e set-password.
 * Nessun provider nuovo, nessun dominio da verificare, deliverability già nota.
 *
 * Regole di progetto rispettate qui:
 *   - non fallisce mai in modo rumoroso: chi la chiama sta già completando
 *     un'operazione riuscita, la notifica è best-effort;
 *   - non logga mai il destinatario né le credenziali (§1.9 delle regole area
 *     utente): solo l'esito e il messaggio d'errore del server SMTP;
 *   - timeout espliciti: il salvataggio dell'operatore attende questo invio, un
 *     SMTP lento non deve trasformarsi in un'interfaccia che sembra bloccata;
 *   - se la configurazione manca non tenta l'invio e lo dichiara, così il
 *     chiamante non fa credere che la mail sia partita.
 */
import type { Transporter } from 'nodemailer'

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

export interface SmtpConfig {
    host: string
    port: number
    secure: boolean
    user: string
    pass: string
    from: string
}

/** Timeout in ms. Tenuti bassi: un salvataggio admin attende questo invio. */
const CONNECTION_TIMEOUT = 8000
const GREETING_TIMEOUT = 8000
const SOCKET_TIMEOUT = 10000

/**
 * Legge la configurazione SMTP dall'ambiente. Esportata per poter essere testata:
 * la derivazione di `secure` dalla porta è la parte che più facilmente si sbaglia
 * (465 = TLS implicito, 587/25 = STARTTLS su connessione in chiaro).
 */
export function resolveSmtpConfig(
    env: Record<string, string | undefined> = process.env,
): SmtpConfig | null {
    const host = env.SMTP_HOST?.trim()
    const user = env.SMTP_USER?.trim()
    const pass = env.SMTP_PASS
    const from = env.MAIL_FROM?.trim()
    if (!host || !user || !pass || !from) return null

    const port = Number.parseInt(env.SMTP_PORT?.trim() || '587', 10)
    if (!Number.isInteger(port) || port <= 0 || port > 65535) return null

    // SMTP_SECURE sovrascrive la derivazione automatica, per i server fuori standard.
    const override = env.SMTP_SECURE?.trim().toLowerCase()
    const secure = override === 'true' ? true : override === 'false' ? false : port === 465

    return { host, port, secure, user, pass, from }
}

export function isMailerConfigured(): boolean {
    return resolveSmtpConfig() !== null
}

/**
 * Transporter riusato fra invocazioni: su Fluid Compute l'istanza sopravvive alle
 * richieste, quindi ricrearlo ogni volta significherebbe rifare handshake TLS e
 * autenticazione a ogni mail. La chiave contiene host/porta/utente così un cambio
 * di configurazione lo invalida da sé.
 */
let cached: { key: string; transporter: Transporter } | null = null

async function getTransporter(cfg: SmtpConfig): Promise<Transporter> {
    const key = `${cfg.host}:${cfg.port}:${cfg.secure}:${cfg.user}`
    if (cached?.key === key) return cached.transporter

    // Import dinamico: senza configurazione SMTP il modulo non viene caricato.
    const nodemailer = await import('nodemailer')
    const transporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: { user: cfg.user, pass: cfg.pass },
        connectionTimeout: CONNECTION_TIMEOUT,
        greetingTimeout: GREETING_TIMEOUT,
        socketTimeout: SOCKET_TIMEOUT,
    })
    cached = { key, transporter }
    return transporter
}

export async function sendMail({ to, subject, html, text }: SendMailInput): Promise<MailResult> {
    const cfg = resolveSmtpConfig()
    if (!cfg) {
        console.warn('[mailer] invio saltato: configurazione SMTP incompleta (SMTP_HOST/SMTP_USER/SMTP_PASS/MAIL_FROM)')
        return { sent: false, reason: 'not_configured' }
    }

    try {
        const transporter = await getTransporter(cfg)
        await transporter.sendMail({ from: cfg.from, to, subject, html, text })
        return { sent: true }
    } catch (e) {
        // Solo il messaggio del server: nessun indirizzo e nessuna credenziale.
        const detail = e instanceof Error ? e.message : String(e)
        console.error(`[mailer] invio fallito: ${detail}`)
        // Una connessione morta resta in cache e farebbe fallire anche i prossimi
        // invii: la si butta e il prossimo tentativo ne apre una nuova.
        cached = null
        return { sent: false, reason: 'send_failed', detail }
    }
}
