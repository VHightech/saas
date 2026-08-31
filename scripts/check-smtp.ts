/**
 * Verifica la configurazione SMTP del portale, e opzionalmente invia una mail di
 * prova con il template reale.
 *
 * Uso:
 *   npm run mail:check                              # solo connessione + auth, non spedisce
 *   npm run mail:check -- --to me@example.com       # invia anche la notifica di prova
 *   npm run mail:check -- --to me@example.com --mode updated
 *
 * `--mode added` (default) mostra la variante "indirizzo associato" (utenza che
 * non aveva email); `--mode updated` quella "indirizzo aggiornato".
 *
 * Non stampa mai password o utenza SMTP: solo host, porta e se i campi ci sono.
 * Env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM (.env / .env.local)
 */
import dotenv from 'dotenv'
import path from 'node:path'

dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

interface Args { to?: string; mode: 'added' | 'updated' }

function parseArgs(argv: string[]): Args {
    const a: Args = { mode: 'added' }
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--to') a.to = argv[++i]
        else if (argv[i] === '--mode') {
            const m = argv[++i]
            if (m !== 'added' && m !== 'updated') {
                console.error("--mode accetta solo 'added' o 'updated'")
                process.exit(1)
            }
            a.mode = m
        }
    }
    return a
}

async function main() {
    const args = parseArgs(process.argv.slice(2))
    const { resolveSmtpConfig } = await import('../src/lib/mailer')

    const cfg = resolveSmtpConfig()
    if (!cfg) {
        console.error('Configurazione SMTP incompleta. Servono SMTP_HOST, SMTP_USER, SMTP_PASS, MAIL_FROM.')
        for (const k of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'] as const) {
            console.error(`  ${k.padEnd(10)} ${process.env[k] ? 'presente' : 'MANCANTE'}`)
        }
        process.exit(1)
    }

    console.log('— Configurazione —')
    console.log(`  host:   ${cfg.host}`)
    console.log(`  porta:  ${cfg.port}  (secure: ${cfg.secure} → ${cfg.secure ? 'TLS implicito' : 'STARTTLS'})`)
    console.log(`  utente: presente`)
    console.log(`  from:   ${cfg.from}`)

    // 1. Handshake + autenticazione, senza spedire.
    const nodemailer = await import('nodemailer')
    const transporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: { user: cfg.user, pass: cfg.pass },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 10000,
    })

    console.log('\nVerifica connessione e autenticazione…')
    try {
        await transporter.verify()
        console.log('  OK: il server accetta le credenziali.')
    } catch (e) {
        console.error(`  FALLITA: ${e instanceof Error ? e.message : String(e)}`)
        console.error('\n  Cose da controllare, in ordine:')
        console.error('   - porta e cifratura (465 = TLS implicito, 587 = STARTTLS)')
        console.error('   - utente/password: spesso sono diversi da quelli del pannello del provider')
        console.error('   - il provider potrebbe bloccare le connessioni da questo IP')
        process.exit(1)
    } finally {
        transporter.close()
    }

    if (!args.to) {
        console.log('\nNessun invio eseguito. Aggiungi --to <indirizzo> per ricevere la notifica di prova.')
        return
    }

    // 2. Invio della notifica reale, così si vede quello che vedrà il cliente.
    const { notifyEmailAssociated } = await import('../src/lib/emails/notify-email-associated')
    console.log(`\nInvio della notifica di prova (mode: ${args.mode})…`)
    const res = await notifyEmailAssociated({ to: args.to, name: 'Mario Rossi', mode: args.mode })
    if (res.sent) {
        console.log('  Inviata. Controlla la casella, e anche lo spam.')
    } else {
        console.error(`  NON inviata: ${res.reason}${res.detail ? ` — ${res.detail}` : ''}`)
        process.exit(1)
    }
}

main().catch((e) => { console.error('\nFallito:', e instanceof Error ? e.message : e); process.exit(1) })
