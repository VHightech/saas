# Template email Supabase Auth

Questi file sono la **copia versionata** dei template configurati su
Supabase → *Authentication → Emails*. Sul dashboard non c'è storico: se qualcuno
li sovrascrive, senza questa cartella non si torna indietro.

**Non vengono letti dall'applicazione.** Si modificano qui, si incollano lì, e la
modifica va committata. Se cambi un template sul dashboard senza aggiornare
questi file, la copia diventa una bugia.

## File

| file | template sul dashboard | famiglia |
|------|------------------------|----------|
| `invite-user.html` | Invite user | Auth |
| `email-address-changed.html` | Email address changed | Security notification |

Le *security notification* partono **solo se abilitate a livello di progetto**
(la voce si trova nella stessa pagina). "Email address changed" è stata abilitata
il 2026-08-31.

### ⚠ "Email address changed" non scatta per le modifiche via admin API

Verificato il 2026-08-31: con la notifica abilitata, cambiando l'email di
un'utenza dal pannello admin **non arriva niente**, né su un profilo shadow né su
un'utenza attivata. Il canale email funziona (invito e set-password arrivano
regolarmente), quindi non è un problema di consegna: l'evento non viene emesso.

Il motivo: `admin.updateUserById(..., { email_confirm: true })` è una scrittura
amministrativa e marca il nuovo indirizzo come già confermato, quindi non esiste
il flusso di cambio email da cui la notifica nascerebbe. Le security notification
nascono dai flussi iniziati dall'utente.

Conseguenza: per avvisare il cliente serve un trasporto nostro
(`src/lib/mailer.ts`), che copre entrambi i casi. Il template resta comunque
configurato: se un giorno un cliente cambiasse l'email dalla propria area, la
notifica partirebbe da sé.

## Variabili disponibili

`{{ .ConfirmationURL }}` · `{{ .Token }}` · `{{ .TokenHash }}` · `{{ .SiteURL }}`
· `{{ .RedirectTo }}` · `{{ .Data }}` (= `auth.users.user_metadata`) ·
`{{ .Email }}` · `{{ .NewEmail }}` (solo cambio email) · `{{ .OldEmail }}` (solo
notifica cambio email).

⚠ Su "Email address changed" non è documentato **quale** fra `.Email` e
`.OldEmail` contenga il nuovo indirizzo, né a quale indirizzo venga consegnata la
notifica. Verificare con una modifica di prova prima di mostrare gli indirizzi
nel testo: il blocco relativo è commentato dentro il file.

## Due destinatari, un solo template: "Invite user"

`inviteUserByEmail` è chiamato da due punti con scopi diversi:

| chiamante | metadata passati | destinatario |
|-----------|------------------|--------------|
| `admin/invite/actions.ts` | `full_name`, `is_admin: true` | amministratore |
| `login/actions.ts` (primo accesso) | `codice_cliente` | **cliente** |

Supabase ha un solo template, quindi il testo attuale
("Sei stato invitato a unirti al team") arriva anche ai clienti — ed è la mail
che il portale invia più spesso, dato che ~26.700 utenze devono ancora fare il
primo accesso.

Due strade, in ordine di preferenza:

1. **Testo neutro** che funzioni per entrambi ("Attiva il tuo accesso al
   Portale Acquambiente"): sicuro, nessuna dipendenza da funzionalità non
   documentate.
2. **Ramo condizionale** su `{{ if .Data.is_admin }}`: i template Supabase sono
   Go template, quindi in teoria i costrutti di controllo funzionano, ma non è
   documentato. Da verificare con un invito di prova per tipo prima di affidarci.

## Nota sul rendering

Le regole per classe in `<style>` e le media query **non** sopravvivono a Outlook
(motore Word) e la dark mode via `prefers-color-scheme` è ignorata da Gmail, che
applica una propria inversione. Per questo in `email-address-changed.html` le
proprietà critiche (sfondi, spaziature, colori) sono ripetute **anche inline**:
il layout regge anche dove il blocco `<style>` viene scartato.

## Il canale nostro (notifiche fuori dai flussi auth)

Le mail che non nascono da un'operazione di autenticazione le manda
`src/lib/mailer.ts` via SMTP, riusando **le stesse credenziali configurate su
Supabase** (Authentication → Emails → SMTP Settings): nessun provider aggiuntivo,
deliverability già dimostrata da invito e set-password.

Variabili d'ambiente richieste, in `.env.local` **e** su Vercel:

| variabile | esempio | note |
|-----------|---------|------|
| `SMTP_HOST` | `smtp.example.com` | obbligatoria |
| `SMTP_PORT` | `587` | opzionale, default `587` |
| `SMTP_USER` | `utente` | obbligatoria |
| `SMTP_PASS` | — | obbligatoria, mai committata |
| `MAIL_FROM` | `Acquambiente Marche <noreply@acquambientemarche.it>` | obbligatoria, dominio del mittente SMTP |
| `SMTP_SECURE` | `true` / `false` | opzionale: sovrascrive la derivazione dalla porta |

`secure` si deriva dalla porta (465 = TLS implicito, tutto il resto = STARTTLS).
Finché una delle obbligatorie manca, l'invio viene saltato e resta un warning nei
log del server — nessun errore all'operatore, che su quella condizione non può
agire.

Il modulo non lancia mai: un SMTP irraggiungibile torna
`{ sent: false, reason: 'send_failed' }` (verificato: ~300 ms con host inesistente),
così un problema di consegna non annulla il salvataggio dell'operatore. I timeout
sono espliciti (8s connessione, 10s socket) perché quel salvataggio attende l'invio.
