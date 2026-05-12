# ACQDASH

### Piattaforma di gestione bollette utility per gestori idrici ed energetici

**Una soluzione di Grafiche Valdelsa S.r.l.**
*Maggio 2026*

---

## Executive Summary

**ACQDASH** è la piattaforma web cloud-native progettata da **Grafiche Valdelsa** per digitalizzare il rapporto tra gestori utility (acqua, energia) e i loro clienti finali.

Una soluzione **all-in-one** che unifica:

- 🗂  **Anagrafica clienti** unificata e ricercabile
- 📄  **Archivio bollette** sicuro con accesso self-service
- 💳  **Pagamenti elettronici** integrati con il nodo nazionale **PagoPA**
- ⚙️  **Pannello amministrativo** per ingestion massiva, audit e operatività
- 🛡  **Sicurezza by design** e conformità **GDPR** (hosting EU)

> *"Un'unica dashboard, conformità garantita, costi infrastrutturali ridotti."*

---

## 1. Il problema

I gestori del servizio idrico ed energetico si confrontano oggi con:

- **Frammentazione documentale**: bollette in PDF su file-server o e-mail, difficili da reperire e da consegnare al cliente.
- **Customer care saturo**: il 40-60% delle richieste in front-office riguardano *"vorrei una copia della bolletta"* o *"come pago"*.
- **Onboarding clienti lento**: anagrafiche dispersive, allineamento manuale tra ERP, gestionale e portali esterni.
- **Pressione regolatoria**: GDPR, PagoPA, SDI, conservazione decennale dei documenti fiscali.
- **Costi cloud crescenti** per piattaforme proprietarie poco modulari.

ACQDASH risponde a tutto questo con un'**unica applicazione web**, accessibile da browser, integrabile con i flussi esistenti.

---

## 2. La soluzione

### 2.1 Per il cliente finale

Un portale **self-service** semplice:

| Funzione | Beneficio |
|----------|-----------|
| Consultazione bollette in PDF | Storico completo sempre disponibile |
| Download protetto (URL firmati 5 min) | Sicurezza enterprise senza barriere |
| Pagamento PagoPA in pochi click | Ricevuta immediata, status in tempo reale |
| Recupero password OTP a 4 step | Identificazione robusta su CIF / codice cliente |
| Modifica dati di contatto | Riduzione richieste al call-center |

### 2.2 Per il gestore (admin)

Un pannello **operativo** desktop-first:

| Funzione | Beneficio |
|----------|-----------|
| **Bulk upload** bollette: archivio ZIP/7z + CSV | Migliaia di documenti caricati in pochi minuti |
| **Profili shadow**: pre-caricamento clienti da CSV | Onboarding fluido — il cliente "rivendica" il proprio profilo |
| **Ricerca tokenizzata** (nome, CF, CIF, indirizzo, stato contratto) | Operatori più rapidi del 5-10× |
| **Mass-link** automatico bollette → profili (RPC dedicato) | Riconciliazione massiva con un click |
| **Cancellazione batch** (cascade DB + storage) | Operazioni reversibili tracciate |
| **Inviti via e-mail** (Resend + React Email) | Branding curato, deliverability alta |
| Filtri per **stadio** e **stato contratto** | Workflow conformi al ciclo di vita reale del contratto |

---

## 3. Architettura

```
┌─────────────────────────────────────────────────────────────┐
│              Browser (utente / amministratore)              │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS + CSP stretta
                           ▼
┌─────────────────────────────────────────────────────────────┐
│        Next.js 16 App Router  •  React 19  •  Edge          │
│      Server Actions  •  API Routes  •  React Compiler       │
└────────┬───────────────────┬────────────────────┬───────────┘
         │                   │                    │
         ▼                   ▼                    ▼
┌──────────────┐    ┌────────────────┐    ┌──────────────────┐
│   Supabase   │    │  Cloudflare R2 │    │   PagoPA Node    │
│  (Postgres + │    │   (PDF store)  │    │   (pagamenti)    │
│   Auth, EU)  │    └────────────────┘    └──────────────────┘
│  RLS attive  │              ▲
└──────┬───────┘              │
       │                      │
       ▼                Resend (e-mail)
  Backups giornalieri        │
                       Cloudflare Turnstile (anti-bot)
```

### Stack chiave

- **Next.js 16.1.2** + **React 19.2** + Turbopack
- **Supabase** (Postgres 15 gestito + Auth) — **regione EU**
- **Cloudflare R2** — storage S3-compatible — **regione EU**
- **Cloudflare Turnstile** — protezione anti-bot
- **Resend** + React Email — comunicazioni transazionali
- **PagoPA** — nodo nazionale dei pagamenti

---

## 4. Sicurezza & Compliance

ACQDASH è stato sottoposto a una **revisione di sicurezza completa** (aprile 2026) con remediation tracciate. Le misure attive:

### 4.1 Protezione dei dati

| Misura | Implementazione |
|--------|-----------------|
| **Row-Level Security** Postgres su 100% delle tabelle | Ogni utente vede solo i propri dati |
| **Cifratura at-rest** | Supabase + R2 |
| **Cifratura in transito** | TLS 1.2+ obbligatoria |
| **Signed URL TTL 5 min** | I PDF non sono mai pubblici |
| **Captcha** Cloudflare Turnstile | Login + registrazione |
| **Content Security Policy** stretta | XSS, clickjacking, data exfiltration |
| **HSTS, X-Content-Type-Options, Referrer-Policy** | Headers difensivi attivi |
| **Path traversal guard** | Sanitize archivio + `path.resolve` check |
| **Anti SQL/Filter injection** | Whitelist regex + sequential `.eq()` PostgREST |
| **Pagamenti sigillati** | `REVOKE UPDATE FROM authenticated` + trigger trusted |
| **Service-role key** | Mai esposta lato client; uso solo dietro `requireAdmin()` |
| **Audit log** delle operazioni amministrative | Tabella `import_logs` + log Supabase |

### 4.2 GDPR — conformità

- **Titolare**: Grafiche Valdelsa S.r.l.
- **Hosting dati primario**: **Unione Europea** (Supabase EU + R2 EU)
- **Sub-processor**: tutti coperti da DPA art. 28 GDPR + SCC + Data Privacy Framework
- **Conservazione**: 10 anni per dati fiscali (obblighi italiani), 12 mesi per log tecnici, anonimizzazione account inattivi 24 mesi
- **Diritti dell'interessato**: portale di richiesta tramite e-mail al Titolare, evasione entro 30 giorni
- **Decisioni automatizzate / profilazione**: **non effettuate**
- **Cookie**: solo tecnici di sessione + sicurezza (esenti da consenso ex art. 122 Codice Privacy)

📄 *Vedi documenti: [PRIVACY_POLICY.md](./PRIVACY_POLICY.md), [TERMS_OF_SERVICE.md](./TERMS_OF_SERVICE.md)*

### 4.3 Modello dei ruoli

| Ruolo | Privilegi |
|-------|-----------|
| `user` | Self-service: solo dati propri |
| `admin` | Operatività back-office (upload, ricerca, inviti) |
| `super_admin` | Cancellazioni distruttive (batch wipe, mass operations) |

Ogni Server Action amministrativa è gated da `requireAdmin()` o `requireSuperadmin()`.

---

## 5. Modello dati

ACQDASH si fonda su uno schema Postgres pensato per l'utility italiano:

```
profiles ─────┐         ┌───── bills (idboll, importo, scadenza, status)
              │         │
        user_id│         │import_log_id  →  import_logs (batch tracking)
              │         │
              ├─ user_supplies (forniture multiple per cliente)
              │
              └─ payments (PagoPA, status sigillato via trigger)
```

**Entità chiave**:

- `profiles`: anagrafica unificata con `cfpi`, `cif`, `codice_cliente`, `stadio`, `stato_contratto`
- `bills`: bolletta con generated column `ulm = right(cif,6)` per query rapide
- `payments`: pagamento separato che riflette stato su `bills.status` via trigger
- `import_logs`: tracciamento batch upload con cascade delete su R2 + bills
- `user_supplies`: una utenza può avere più forniture (acqua + energia)

---

## 6. Flussi distintivi

### 6.1 Onboarding "shadow profile"

```
Admin carica CSV ───▶ Crea profili shadow (is_shadow=true)
                            │
Cliente registra ──▶ Match (codice_cliente + CFPI)
                            │
                            ▼
              Claim: bollette, forniture e pagamenti esistenti
              vengono trasferiti al profilo reale
              Profilo shadow eliminato
```

**Beneficio**: il cliente al primo accesso trova **già** il proprio storico bollette caricato.

### 6.2 Bulk upload con archivio 7z

1. Operatore seleziona CSV + archivio 7z (centinaia/migliaia di PDF).
2. `importId` UUID generato lato client.
3. Server estrae 7z, sanitizza filename, carica PDF su R2 sotto `{importId}/`.
4. Inserisce righe `bills` con dedup interno su `idboll`.
5. Riga `import_logs` consente delete cascade futuro (DB + storage).

### 6.3 Pagamento PagoPA

1. Utente seleziona bolletta → PaymentModal.
2. `initiatePagoPAPayment` verifica ownership e match importo.
3. INSERT in `payments` con `status='pending'`.
4. Trigger `trg_payments_sync_bill_status` riflette su `bills.status`.
5. Webhook PagoPA chiude la transazione.

---

## 7. Vantaggi competitivi

| Aspetto | ACQDASH | Soluzioni concorrenti tipiche |
|---------|---------|-------------------------------|
| **Stack moderno** | Next.js 16, React 19, Turbopack | Stack legacy, render lato server pesanti |
| **Costi infrastrutturali** | Supabase + R2 (pay-per-use) | Hosting dedicato costoso |
| **Time-to-market** | < 30 giorni per integrazione | Mesi per personalizzazioni |
| **Hosting EU** | ✅ Supabase EU + R2 EU | Spesso US/multi-region opaco |
| **GDPR-ready** | ✅ Documentato e revisionato | Frequente assenza di DPA strutturati |
| **PagoPA nativo** | ✅ Tabella e trigger dedicati | Add-on a parte |
| **Self-service claim** | ✅ Shadow profile flow | Onboarding manuale operatore |
| **Audit di sicurezza** | ✅ Review formale 04/2026 | Spesso assente |

---

## 8. KPI attesi (post deploy 90 giorni)

- 📉  **−40%** chiamate al call-center per "richiesta copia bolletta"
- 📈  **+25%** percentuale pagamenti elettronici (PagoPA) vs bonifico/cassa
- ⏱  **<3 secondi** tempo medio di accesso a una bolletta
- 🔁  **>95%** tasso di self-claim profili shadow al primo accesso
- 🛡  **0** incidenti di sicurezza dalla messa in produzione (target)

---

## 9. Roadmap

### Q2 2026 — *In corso*
- ✅ Rinforzamento RLS e revoca privilegi su pagamenti
- ✅ Migrazione PDF da filesystem a Cloudflare R2
- ✅ Filtri per stadio / stato contratto
- ✅ Mass-link RPC bollette → profili
- 🔄 Webhook PagoPA produttivo

### Q3 2026
- MFA TOTP per ruoli admin
- Dashboard analitica admin (consumi, scaduti, conversion)
- Notifiche scadenza bolletta (e-mail + opzionale SMS)
- Cestino retention 30 giorni su delete batch

### Q4 2026
- Export CSV / PDF report cliente
- Pipeline CI con typecheck + test
- Integrazione SDI per fatturazione elettronica
- App mobile companion (PWA)

---

## 10. Il team

**Grafiche Valdelsa S.r.l.** — soluzioni digitali e documentali per la pubblica utilità e l'industria.

**Referente del progetto:**
**Matteo Volterrani**
matteo.volterrani@valdelsahightech.com

---

## 11. Documenti correlati

| Documento | Descrizione |
|-----------|-------------|
| [PLATFORM_OVERVIEW.md](./PLATFORM_OVERVIEW.md) | Documentazione tecnica completa |
| [PRIVACY_POLICY.md](./PRIVACY_POLICY.md) | Informativa GDPR |
| [TERMS_OF_SERVICE.md](./TERMS_OF_SERVICE.md) | Termini e condizioni d'uso |
| `SECURITY_REVIEW_2026-04-20.md` | Revisione di sicurezza |
| `PAGOPA_INTEGRATION_GUIDE.md` | Piano di integrazione PagoPA |

---

## 12. Contatti

**Grafiche Valdelsa S.r.l.**
✉️  matteo.volterrani@valdelsahightech.com

> *Pronti a digitalizzare il rapporto con i vostri clienti.*

---

*ACQDASH © 2026 Grafiche Valdelsa S.r.l. — Tutti i diritti riservati.*
