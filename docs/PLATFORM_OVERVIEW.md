---
name: acqdash-platform-overview
description: Documentazione tecnica completa della piattaforma ACQDASH — architettura Next.js 16 + Supabase (EU) + Cloudflare R2, modello dati, flussi applicativi (login/registrazione/recupero/upload/pagamento), sicurezza e RLS, variabili d'ambiente, ruoli operativi. Da usare come fonte di verità unica per onboarding tecnico, audit e roadmap.
type: project
owner: Grafiche Valdelsa S.r.l.
contact: matteo.volterrani@valdelsahightech.com
last_updated: 2026-05-06
---

# ACQDASH — Documentazione Tecnica Ufficiale di Piattaforma

> Piattaforma web di gestione anagrafica clienti, bollette utility (acqua/energia), pagamenti PagoPA e archiviazione documentale.
> Sviluppata da **Grafiche Valdelsa S.r.l.** per uso interno e per la clientela del gestore servizi idrici.

---

## 1. Identificazione del prodotto

| Voce | Valore |
|------|--------|
| Nome prodotto | ACQDASH |
| Versione applicativa | 0.1.0 (Next.js app) |
| Titolare del trattamento | Grafiche Valdelsa S.r.l. |
| Referente tecnico | Matteo Volterrani — matteo.volterrani@valdelsahightech.com |
| Ambito | Gestione clienti utility italiani (acqua/energia), portale self-service bollette + pannello amministrativo |
| Ultimo aggiornamento documento | 2026-05-06 |

---

## 2. Architettura tecnologica

### 2.1 Stack applicativo

| Layer | Tecnologia | Note |
|-------|------------|------|
| Frontend / Backend | **Next.js 16.1.2** (App Router) + **React 19.2** + React Compiler + Turbopack | Server Components, Server Actions, API Routes |
| Linguaggio | TypeScript 5 | Strict mode |
| Styling | Tailwind CSS 4 + `next-themes` (dark/light) | Tailwind merge + clsx |
| Database & Auth | **Supabase** (Postgres 15 gestito) | Hosting EU (vedi §10) — istanza `uqeqfopaztvcgipwuiqr.supabase.co` |
| Storage file PDF | **Cloudflare R2** (bucket `acquambiente`) | S3-compatible, accesso via signed URL |
| Email transazionali | **Resend** + React Email templates | Invito utenti, recupero password, conferme |
| Anti-bot | **Cloudflare Turnstile** | Login e registrazione (managed mode) |
| Pagamenti | **PagoPA** (integrazione nodo dei pagamenti) | Tabella `payments` separata + trigger di sync |
| Archive ingestion | `7zip-bin` + `node-7z` + `csv-parse` | Ingestione bulk di archivi 7z + CSV |
| Tunnel dev | `cloudflared` (`npm run dev:tunnel`) | Esposizione locale per test |

### 2.2 Diagramma logico (alto livello)

```
┌─────────────┐   HTTPS   ┌────────────────────┐
│  Browser    │──────────▶│  Next.js 16        │
│  (utente /  │           │  (App Router)      │
│   admin)    │◀──────────│  Server Actions +  │
└─────────────┘           │  API Routes        │
                          └────────┬───────────┘
                                   │
                ┌──────────────────┼──────────────────┐
                ▼                  ▼                  ▼
        ┌──────────────┐  ┌────────────────┐  ┌──────────────┐
        │  Supabase    │  │  Cloudflare R2 │  │   Resend     │
        │  (Postgres + │  │  bucket        │  │  (email      │
        │   Auth, EU)  │  │  acquambiente  │  │   transazion)│
        └──────────────┘  └────────────────┘  └──────────────┘
                ▲
                │
        ┌──────────────────┐
        │ PagoPA Nodo      │
        │ (payments)       │
        └──────────────────┘
```

### 2.3 Hosting e regione dati

- **Database & Auth Supabase**: progetto creato in regione **Europa (EU)** — i dati personali non escono dallo Spazio Economico Europeo per le operazioni primarie di lettura/scrittura.
- **Cloudflare R2**: bucket impostato per servizio in EU; oggetti serviti tramite URL firmati a TTL breve (5 minuti).
- **Resend**: provider email con sub-processor; vengono trasmessi solo email destinatario + payload del template.
- **PagoPA**: traffico verso il nodo nazionale dei pagamenti (Italia).

---

## 3. Struttura del repository

Root del progetto: `c:\Users\pc2\Desktop\ACQDASH\acqdash\`

```
acqdash/
├── .env.local                      # Chiavi (gitignored)
├── next.config.ts                  # bodySizeLimit '500mb' upload, reactCompiler
├── package.json                    # Next 16.1.2 / React 19.2 / Supabase / R2 / Resend
├── supabase/
│   ├── schema.sql                  # Bootstrap legacy (obsoleto)
│   └── migrations/                 # Schema canonico in ordine cronologico
├── scripts/
│   ├── create-admin-user.ts
│   └── archive/                    # dump-all.ts / dump-user.ts (SERVICE_ROLE)
├── public/invoices/                # PDF legacy pre-R2 (gitignored)
├── tmp/                            # Estrazione archivi (gitignored)
├── docs/
│   ├── PLATFORM_OVERVIEW.md        # questo file
│   ├── PRIVACY_POLICY.md
│   ├── TERMS_OF_SERVICE.md
│   └── PRESENTATION.md
└── src/
    ├── middleware.ts               # Refresh sessione + CSP + auth gate /dashboard /admin
    ├── lib/
    │   ├── supabase/{client,server,admin}.ts
    │   ├── r2.ts                   # Client S3 R2
    │   ├── auth.ts / auth-checks.ts
    │   └── admin/{file-parser, adapters}
    ├── actions/
    │   ├── user-data.ts
    │   └── payment-actions.ts
    ├── app/
    │   ├── login/, register/, forgot-password/, profile/
    │   ├── auth/{callback, confirm-invite, verify-2fa}
    │   ├── dashboard/              # Area utente
    │   ├── admin/                  # Area admin (desktop only)
    │   │   ├── users/, invite/, update-password/, upload/
    │   │   ├── invoices/           # Vista bollette amministrativa
    │   │   ├── pdf/                # Batch import PDF
    │   │   └── settings/
    │   └── api/
    │       ├── upload/             # POST CSV+7z → R2; DELETE batch
    │       ├── upload-users/       # CSV master-data
    │       └── bills/[id]/pdf/     # Streaming autenticato PDF
    ├── components/{admin, dashboard, emails, ui, providers}/
    ├── hooks/
    └── types/dashboard.ts
```

---

## 4. Modello dati (Supabase / Postgres)

Tutti i RLS sono **abilitati**. Ogni tabella ha policy proprietario + bypass per `is_admin()`.

### 4.1 `public.profiles` — anagrafica unificata

| Colonna | Tipo | Note |
|---------|------|------|
| `id` | `uuid` PK | = `auth.uid()` |
| `name`, `surname` | `text` | |
| `email`, `phone` | `text` | sync da `auth.users` via trigger |
| `cfpi` | `text` | Codice Fiscale o Partita IVA |
| `cif` | `text` | Codice Identificativo Fornitura |
| `codice_cliente` | `text` UNIQUE | |
| `username` | `text` | Login alternativo |
| `is_shadow` | `boolean` | Pre-caricato da CSV, in attesa di claim |
| `address`, `city` | `text` | |
| `stadio` | `text` | NEW (2026-05-05) — stato di lavorazione contratto |
| `stato_contratto` | `text` | NEW (2026-05-05) — stato giuridico contratto |
| `role` | `text` | `admin` / `user` / `super_admin` |
| `created_at` | `timestamptz` | |

**GRANT colonnari**: l'utente `authenticated` può **UPDATE** solo `name`, `address`, `city`. Tutte le altre richiedono service-role / admin server action.

### 4.2 `public.bills` — bollette

| Colonna | Tipo | Note |
|---------|------|------|
| `id` | `bigint` PK identity | |
| `idboll` | `bigint` UNIQUE | Numero bolletta (dal nome PDF) |
| `user_id` | `uuid → profiles.id` | Nullable (orphan claim flow) |
| `import_log_id` | `text → import_logs.r2_path ON DELETE CASCADE` | |
| `cfpi`, `cif`, `codice_cliente` | `text` | |
| `nome_pdf` | `text` | |
| `pdf_url` | `text` | Object key R2 `{importId}/{filename}` |
| `tipo_servizio` | `text` | acqua / energia / … |
| `data_emissione`, `scadenza` | `date` | |
| `importo`, `consumo` | `numeric` | |
| `ulm` | `text` GENERATED `right(cif, 6)` | |
| `status` | `text` | `paid`/`unpaid`/`pending`/`failed` |
| `billing_type` | `text` | `S` / `A` (dal CSV) |
| `expected_method` | `text` | `MP01` / `MP23` (dal CSV) |
| `created_at` | `timestamptz` | |

### 4.3 `public.user_supplies` — forniture

`id uuid PK`, `user_id → profiles.id`, `codice_cliente`, `cif`, `address`, `city`, `created_at`.
RLS: SELECT proprio + `is_admin()` per tutte le ops.

### 4.4 `public.import_logs` — batch ingestion

`id uuid PK`, `r2_path text UNIQUE NOT NULL` (chiave per `bills.import_log_id` e prefisso R2), `status`, `current_file`, `errors jsonb`, `archive_name`, `created_at`.

### 4.5 `public.payments` — pagamenti

`id uuid PK`, `bill_id bigint → bills.id ON DELETE CASCADE`, `user_id uuid → profiles.id ON DELETE CASCADE`, `amount numeric(10,2) > 0`, `method` (`pagopa|bonifico|contanti|carta|altro`), `type` (`saldo|acconto`), `status` (`pending|paid|failed|refunded`), `pagopa_notice_code`, `pagopa_token`, `paid_at`.

**RLS**: SELECT/INSERT proprio (solo `status='pending'`), tutto admin. **REVOKE UPDATE FROM authenticated** (l'utente non può manomettere lo stato). Trigger `trg_payments_sync_bill_status` riflette `paid` su `bills.status`.

### 4.6 Helpers e RPC notevoli

- `is_admin(uuid) SECURITY DEFINER`
- `search_users(text, int, int, text)` — versione v5 (2026-05-05): filtro per `stadio` con guardia admin interna; combina ricerca tokenizzata su nome/email/cif/cfpi/codice_cliente/address/city/stadio/stato_contratto + `nome_pdf`.
- `mass_link_bills_to_profiles()` — RPC (2026-05-05): collega bollette/forniture orfane ai profili tramite CIF / codice_cliente.
- `handle_auth_user_update` — sincronizza `auth.users.email → profiles.email`.

---

## 5. Flussi applicativi

### 5.1 Login (`/login`)

1. Identificativo: email **oppure** username **oppure** CIF (regex whitelist `[a-zA-Z0-9._@+\-]+`).
2. Lookup sequenziali `.eq()` su `username`, poi `cif` (mai `.or()` con interpolazione).
3. Captcha **Turnstile** obbligatorio.
4. `signInWithPassword` Supabase → cookie HTTP-only, refresh in middleware.
5. Redirect: admin → `/admin/upload`, user → `/dashboard`.

### 5.2 Registrazione (`/register`) — claim shadow profile

1. L'utente inserisce `codice_cliente` + CFPI/CIF + email + password.
2. Server cerca un **profilo shadow** corrispondente (pre-caricato da CSV admin).
3. In assenza di shadow, fallback su match su `user_supplies` o `bills`.
4. Su match: `signUp` Supabase → upsert profile reale → claim bollette/forniture orfane → eliminazione shadow → set `codice_cliente`.

### 5.3 Recupero password (`/forgot-password`) — 4 step

1. `lookupUser`: email mascherata in base a CIF / codice cliente / username.
2. `sendRecoveryOTP`: invio OTP via Resend.
3. `verifyRecoveryOTP`.
4. `updatePassword`.

### 5.4 Upload massivo bollette (`/admin/upload` → `POST /api/upload`)

- Gate: `requireAdmin()`.
- Input: CSV dati bollette + archivio 7z con i PDF.
- `importId` UUID lato client (con polyfill per ambienti senza `crypto.randomUUID`).
- Parser CSV produce `idboll` (null se non numerico), `billing_type`, `expected_method`.
- Dedup interno al batch su `idboll`.
- PDF caricati su R2 sotto `{importId}/<filename>` con sanitize + path-resolve guard.
- Riga `bills` con `pdf_url={importId}/<filename>` e `import_log_id=importId`.

### 5.5 Cancellazione batch (`DELETE /api/upload/[id]`)

- Gate: `requireSuperadmin()`. Service-role client.
- Wipe prefisso R2 + DELETE row `import_logs` → CASCADE elimina `bills` collegate.

### 5.6 Streaming PDF autenticato (`GET /api/bills/[id]/pdf`)

- Lookup `bills.id` → fallback `bills.idboll` (sequenziale `.eq()`).
- Auth check: proprietario **oppure** admin.
- `HeadObject` su R2 (verifica esistenza).
- Risposta `302` verso URL firmato R2 (TTL **5 minuti**).

### 5.7 Pagamenti PagoPA (`initiatePagoPAPayment`)

- Verifica ownership e match importo.
- INSERT `payments` con `status='pending'`.
- In simulazione (`PAGO_PA_API_KEY` assente): nessun avanzamento a `paid` (atteso webhook).
- Trigger `trg_payments_sync_bill_status` riflette stato sulla bolletta.

---

## 6. Ruoli e gating

| Ruolo | Ambito | Esempi privilegi |
|-------|--------|------------------|
| `user` | Self-service | Vede solo proprie bollette, profilo, paga |
| `admin` | Operatori back-office | Crea inviti, ricerca utenti, upload CSV/PDF |
| `super_admin` | DPO / IT | Cancellazione batch, accessi service-role |

Helper:
- `requireAdmin()` (form redirect, server components / actions)
- `requireSuperadmin()` (form API: `{error,status}`)

L'area `/admin` è **desktop-only** (mobile gate in `admin/layout.tsx`).

---

## 7. Sicurezza

### 7.1 Hardening attivo

- **CSP** stretta in `middleware.ts`: allowlist Supabase + R2 + Cloudflare Turnstile, `frame-ancestors 'none'`, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- **`unsafe-eval`** consentito solo in dev.
- **PDF privati**: nessuna directory pubblica espone bollette; signed URL TTL 5 min.
- **Path traversal**: filename sanificati + `path.resolve` con prefix check su `invoicesRoot`.
- **Iniezione filtri PostgREST**: vietato `.or()` con interpolazione di input utente — sequenziali `.eq()` con regex whitelist.
- **Pagamenti**: `REVOKE UPDATE FROM authenticated` su `payments` + trigger trusted.
- **PII logging**: rimozione `console.log` con CF/CIF/email/codice_cliente; preferito hashing/redaction.

### 7.2 Open items tracciati

1. Purge git-history di vecchi dump PII (operazione distruttiva — autorizzazione utente richiesta).
2. Rotazione `SUPABASE_SERVICE_ROLE_KEY` post-esposizione su workstation condivisa.
3. Sostituzione **chiave Turnstile di test** con coppia produzione (lato Cloudflare + Supabase Attack Protection).
4. Hardening flusso registrazione su match-only-bills (richiede secondo fattore email pre-caricata).
5. `bodySizeLimit '500mb'` da scopare sulla sola route di upload.
6. Rate-limit upload da memoria → Redis/Upstash.
7. Webhook PagoPA reale (oggi simulazione).

---

## 8. Variabili d'ambiente

**Obbligatorie**

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_TURNSTILE_SITE_KEY
RESEND_API_KEY
ADMIN_EMAIL
R2_ACCOUNT_ENDPOINT
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET                   # = acquambiente
R2_PUBLIC_BASE_URL
```

**Opzionali**

```
PAGO_PA_NODE_URL
PAGO_PA_API_KEY
NEXT_PUBLIC_COMPANY_CF
NEXT_PUBLIC_SITE_URL
```

Il **Secret Turnstile** non vive in `.env`: è configurato lato Supabase (Authentication → Settings → Attack Protection → Captcha Provider).

---

## 9. Operatività

| Comando | Effetto |
|---------|---------|
| `npm run dev` | Dev server Next.js su porta 3000 |
| `npm run dev:tunnel` | Dev + cloudflared tunnel (trattare come pubblico) |
| `npm run build` | Build produzione |
| `npm start` | Avvio produzione |
| `npm run lint` | ESLint |

**Migrazioni**: aggiungere file in `supabase/migrations/` con prefix `YYYYMMDDhhmmss_*.sql`. Applicare via Supabase SQL Editor in ordine. Dopo DDL: `NOTIFY pgrst, 'reload schema';`.

**Naming DB**: identifier minuscoli non-quotati (PostgREST case folding). `idBoll` storico → rinominato `idboll`.

---

## 10. Conformità GDPR e residenza dati

- **Titolare del trattamento**: Grafiche Valdelsa S.r.l.
- **Base giuridica**: esecuzione del contratto (gestione bollette) e obbligo legale (fatturazione, PagoPA).
- **Categorie di dati personali trattati**: anagrafica, dati di contatto, codici identificativi (CF/PI, CIF, codice cliente), indirizzo, dati di consumo idrico/energetico, copie PDF delle bollette, log di pagamento.
- **Categorie particolari (art. 9 GDPR)**: nessuna trattata.
- **Residenza dati**:
  - Database & Auth: Supabase regione **EU**.
  - Storage PDF: Cloudflare R2 con regione di servizio EU (configurazione bucket).
  - Email: Resend (sub-processor; trasferimento di indirizzo email + contenuto template).
- **Trasferimenti extra-UE**: non previsti per il database principale; eventuali sub-processor (Resend, Cloudflare) operano sotto SCC + meccanismi di garanzia adeguatezza.
- **Conservazione**: i dati di fatturazione sono conservati per **10 anni** (obblighi fiscali italiani — D.P.R. 600/1973, art. 22). I dati di accesso/log per 12 mesi.
- **Diritti dell'interessato**: accesso, rettifica, cancellazione, portabilità, limitazione, opposizione (vedi `PRIVACY_POLICY.md`).
- **DPO / contatto privacy**: matteo.volterrani@valdelsahightech.com.
- **Misure tecniche**: RLS, cifratura at-rest (Supabase + R2), cifratura in transito (TLS 1.2+), MFA admin (in roadmap), captcha Turnstile, signed URL a tempo, principio del minimo privilegio, audit log su Supabase.

---

## 11. Roadmap tecnica

- [ ] Webhook PagoPA produttivo (chiusura ciclo `payments.status → paid`).
- [ ] MFA TOTP per ruoli admin / super_admin.
- [ ] Dashboard analitica admin (consumi medi, scaduti, conversion paid).
- [ ] Export CSV / PDF report per cliente.
- [ ] Notifiche transazionali (email + opzionale SMS) su scadenza bolletta.
- [ ] Cestino retention 30 giorni su delete batch (ora hard-delete).
- [ ] Migrazione storage definitiva da `public/invoices` (legacy) a R2.
- [ ] Pipeline CI: lint + typecheck + test su PR.

---

## 12. Riferimenti interni

- `acqdash/SECURITY_REVIEW_2026-04-20.md` — revisione di sicurezza che ha guidato il refactor 2026-04-20/21.
- `acqdash/PAGOPA_INTEGRATION_GUIDE.md` — piano integrazione PagoPA.
- Skill globale: `~/.claude/skills/acqdash-project/SKILL.md`.
- File chiave: `src/middleware.ts`, `src/lib/auth.ts`, `src/lib/auth-checks.ts`, `src/lib/r2.ts`, `src/lib/supabase/`, `src/actions/payment-actions.ts`.
