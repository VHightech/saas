# ACQDASH — Security Review
**Data:** 2026-04-20
**Revisione:** revisione completa codebase (frontend Next.js 16 + backend Supabase)
**Scope:** autenticazione, autorizzazione, RLS Supabase, endpoint API, Server Actions, gestione segreti, esposizione dati.

---

## Tabella riassuntiva

| # | Severity | Titolo | File principali |
|---|----------|--------|-----------------|
| 1 | CRITICAL | Server Actions admin `deleteUser` / `updateUser` senza auth check | `src/app/admin/users/actions.ts` |
| 2 | CRITICAL | 2FA mock — `verifyOtp` sempre success | `src/app/auth/verify-2fa/actions.ts` |
| 3 | CRITICAL | PagoPA fallback segna qualsiasi `billId` come `paid` senza verifica proprietà | `src/actions/payment-actions.ts` |
| 4 | HIGH | PostgREST `.or()` con input utente non sanitizzato (filter injection / account enumeration) | `src/app/login/actions.ts`, `src/app/forgot-password/actions.ts` |
| 5 | HIGH | Cartella `public/invoices/acq/` servita pubblicamente — niente auth sui PDF | `src/app/api/upload/route.ts` |
| 6 | HIGH | Path traversal: estrazione archivio usa filename grezzo nel `path.join` | `src/app/api/upload/route.ts` |
| 7 | HIGH | CSP debole: `'unsafe-inline' 'unsafe-eval'` + `img-src * ` | `src/middleware.ts` |
| 8 | HIGH | Dump PII committati in git (`all_profiles_dump.json`, `profile_dump.json`, log vari) | repo root |
| 9 | HIGH | PII loggati in console (CF / CIF / email) | `src/app/login/actions.ts`, `src/app/register/actions.ts`, `src/app/admin/users/[id]/page.tsx` |
| 10 | MEDIUM | RLS `user_supplies` — `USING (true)` permette a qualsiasi utente autenticato di leggere CIF/indirizzi altrui | `supabase/migrations/20260218_fix_rls_user_supplies.sql` |
| 11 | MEDIUM | Registrazione: fallback su `bills`/`user_supplies` permette claim di qualsiasi `codice_cliente` con nome/CFPI auto-dichiarati | `src/app/register/actions.ts` |
| 12 | MEDIUM | `bodySizeLimit: '500mb'` sulle Server Actions | `next.config.ts` |
| 13 | MEDIUM | `requireAdmin()` con codice morto dopo il return | `src/lib/auth-checks.ts` |
| 14 | MEDIUM | Rate-limit in-memory — non cluster-safe | `src/app/api/upload/route.ts` |
| 15 | MEDIUM | `update-password/actions.ts` (contesto admin) senza `requireAdmin()` | `src/app/admin/update-password/actions.ts` |
| 16 | LOW | `SERVICE_ROLE_KEY` presente in `.env.local` — nessun piano di rotazione documentato | `.env.local` |
| 17 | LOW | `api/upload` restituisce `error.stack` su 500 | `src/app/api/upload/route.ts` |
| 18 | LOW | `user-data.ts` ha `.eq('id', user.id)` duplicato (smell) | `src/actions/user-data.ts` |

---

## 1. CRITICAL — Server Actions admin senza auth check

**File:** `src/app/admin/users/actions.ts`

Le funzioni `deleteUser(userId)` e `updateUser(userId, data)` sono marcate `'use server'`, creano un client Supabase con `SERVICE_ROLE_KEY` (bypassa RLS) e **non verificano mai il ruolo del chiamante**.

```ts
// src/app/admin/users/actions.ts
export async function deleteUser(userId: string) {
    const supabaseAdmin = createClient(... SERVICE_ROLE_KEY ...)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    // ...nessun requireAdmin(), nessun getUser()
}
```

**Impatto:** qualsiasi utente autenticato (o attaccante con CSRF valido + sessione rubata) può invocare l'action via POST e cancellare / modificare qualunque profilo del sistema, inclusi gli admin.

**Fix:**
```ts
import { requireAdmin } from '@/lib/auth-checks'
export async function deleteUser(userId: string) {
    const check = await requireAdmin()
    if (check.error) return { error: check.error }
    // ... continue
}
```
Da applicare sia a `deleteUser` che a `updateUser`. Idem `admin/update-password/actions.ts`.

---

## 2. CRITICAL — 2FA mock

**File:** `src/app/auth/verify-2fa/actions.ts`

```ts
export async function verifyOtp(formData: FormData) {
    const token = formData.get('token') as string
    console.log('Verifying token:', token)
    // Mock success for now
    redirect('/dashboard')
}
```

Qualsiasi POST a questa action entra in dashboard, indipendentemente dal token. Se la UI 2FA è esposta in produzione **il secondo fattore è completamente aggirabile**.

**Fix:** rimuovere la pagina finché non implementata, oppure chiamare `supabase.auth.verifyOtp({ email, token, type: 'email' })` e gestire gli errori. Non lasciare mai mock che fanno redirect a risorse protette.

---

## 3. CRITICAL — PagoPA segna come pagata qualsiasi bolletta

**File:** `src/actions/payment-actions.ts`

```ts
export async function initiatePagoPAPayment(billId: number, amount: number) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }
    // ... fetch bill ...
    // SIMULATION FALLBACK
    const adminSupabase = createAdminClient()
    await adminSupabase.from('bills').update({ status: 'paid' }).eq('id', billId)
}
```

L'utente deve essere autenticato, ma **non viene verificato che `bill.user_id === user.id`**. Qualsiasi utente può chiamare `initiatePagoPAPayment(123, 0)` per qualunque `billId` e forzare `status='paid'` via admin client (RLS bypass).

**Fix:** caricare la bolletta con RLS attivo (client server normale) e rifiutare se non posseduta; oppure confrontare `bill.user_id` con `user.id` prima dell'update. Non usare mai il client admin per operazioni scatenate dall'utente senza verifica di ownership.

---

## 4. HIGH — PostgREST filter injection su `.or()`

**File:** `src/app/login/actions.ts:28`, `src/app/forgot-password/actions.ts:41,80,127`

```ts
.or(`username.eq.${identifier},cif.eq.${identifier}`)
```

`identifier` arriva dal form senza sanificazione. Caratteri come `,`, `)`, o altri operatori PostgREST modificano la forma della query. Un attaccante può:
- Rilevare l'esistenza di account (`timing + errore differenziato`).
- Inserire clausole aggiuntive tipo `role.eq.admin,is_shadow.eq.true` per filtrare risultati specifici.
- Rompere la query e sfruttare eventuali fallback.

**Fix:**
```ts
const clean = identifier.trim()
// due query separate, niente string templating:
const byEmail = await supabase.from('profiles').select('email').eq('username', clean).maybeSingle()
if (!byEmail.data) {
    const byCif = await supabase.from('profiles').select('email').eq('cif', clean).maybeSingle()
    // ...
}
```
Oppure, se proprio serve `.or()`, usare `PostgrestFilterBuilder.or()` passando valori che non contengano operatori PostgREST, o escapare manualmente `,` e `.`.

---

## 5. HIGH — PDF accessibili senza autenticazione

**File:** `src/app/api/upload/route.ts` + `public/invoices/acq/`

Gli archivi 7z vengono estratti e i PDF scritti in `public/invoices/acq/{filename}` → Next serve `public/` staticamente. Chiunque conosca `nome_pdf` può scaricare la bolletta anche senza login. I nomi file spesso sono prevedibili (`BOLL_0012345_2024_03.pdf`).

**Fix prioritario:**
- Spostare i PDF in Supabase Storage privato (`bills` bucket non-public).
- Generare URL firmati temporanei (`createSignedUrl`) in un'API route server-side che verifica `auth.uid()` ownership sulla bolletta.
- Rimuovere la cartella da `public/` e aggiornare `bills.pdf_url` di conseguenza.

**Mitigazione temporanea:** spostare i PDF fuori da `public/` e aggiungere una route `/api/bills/[id]/pdf` che valida ownership e poi effettua stream del file dal filesystem.

---

## 6. HIGH — Possibile path traversal in estrazione archivio

**File:** `src/app/api/upload/route.ts` (blocco extractFull)

`safeName` è applicato solo al nome dell'archivio, ma i file estratti dal 7z vengono letti con `path.basename(filePath)` (OK) e poi copiati con `path.join(localInvoicesDir, filename)`. `filename` proviene dal contenuto dell'archivio controllato dall'admin; se un admin compromesso carica un archivio con entry tipo `..\..\secret.pdf`, `path.basename()` protegge la scrittura principale, **ma**:

- Il codice usa anche `path.join(localInvoicesDir, filename)` senza normalizzazione esplicita.
- La stringa `filename` viene inserita anche in `pdf_url` e nel DB senza validazione di charset.

**Fix:**
```ts
const clean = path.basename(filename).replace(/[^A-Za-z0-9._-]/g, '_')
const targetPath = path.resolve(localInvoicesDir, clean)
if (!targetPath.startsWith(path.resolve(localInvoicesDir) + path.sep)) {
    throw new Error('Invalid filename')
}
```
Applicare lo stesso controllo al valore che finisce in `pdf_url`.

---

## 7. HIGH — Content Security Policy troppo permissiva

**File:** `src/middleware.ts`

```
script-src 'self' 'unsafe-inline' 'unsafe-eval' *.hcaptcha.com
img-src 'self' data: blob: {supabase} *.hcaptcha.com *
```

`unsafe-inline` + `unsafe-eval` neutralizzano la difesa XSS. `img-src ... *` permette qualsiasi host (tracking pixel / beacon exfiltration).

**Fix:**
- Rimuovere `'unsafe-eval'`. Next 16 + React Compiler non lo richiedono.
- Sostituire `'unsafe-inline'` con nonces (Next fornisce `next/headers` + `nonce`).
- Restringere `img-src` a host espliciti (Supabase storage, hCaptcha).
- Aggiungere `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, header `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`.

---

## 8. HIGH — Dump PII e log nel repository git

Committati in git (verifica `git ls-files`):
- `all_profiles_dump.json` — include nomi reali (es. "Matteo …")
- `profile_dump.json`
- `cloudflare.log`, `tunnel.log`, `tunnel_cf.log`, `tunnel_final.log`, `diagnosis.log`
- `output.txt`

**Fix:**
1. `git rm --cached` di questi file + aggiornamento `.gitignore` (aggiungere `*.log`, `*.dump.json`, `*_dump.json`, `output.txt`).
2. Purgare la storia git con `git filter-repo` (o `git filter-branch`) — **i dati devono considerarsi compromessi**.
3. Force-push coordinato e notifica al team.
4. Se il repo remoto è pubblico o semi-pubblico → rotazione immediata dei segreti (anche di chi ha accesso a quei dump).

---

## 9. HIGH — PII nei `console.log`

`src/app/login/actions.ts`:
```ts
console.log('Identifier provided:', identifier)
console.log('Profile found, mapping to email:', profile.email)
```
`src/app/register/actions.ts`:
```ts
console.warn(`[SECURITY] Registration blocked for mismatch. Client: ${clientCode}, Provided FC: ${fiscalCode}`)
console.warn(`[SECURITY] Mismatch details - DB CIF: ..., DB CFPI: ...`)
```
`src/app/admin/users/[id]/page.tsx`:
```ts
console.log('Fetched Supplies Data:', suppliesData)
```

I log finiscono in Vercel / Cloudflare → terze parti + conservazione possibile.

**Fix:** sostituire con log strutturati e redatti (`userId` solo, hash dei CF). Rimuovere completamente dai code-path di successo in produzione.

---

## 10. MEDIUM — RLS `user_supplies` troppo aperta

**File:** `supabase/migrations/20260218_fix_rls_user_supplies.sql`

```sql
CREATE POLICY "Enable read access for authenticated users"
    ON public.user_supplies FOR SELECT TO authenticated USING (true);
```

Il commento nel file riconosce il problema. Qualsiasi utente loggato può `SELECT *` su `user_supplies` → esfiltrazione di CIF + indirizzi + città di tutti.

**Fix (migrazione nuova):**
```sql
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.user_supplies;
CREATE POLICY "Users view own supplies"
    ON public.user_supplies FOR SELECT TO authenticated
    USING (user_id = auth.uid());
CREATE POLICY "Admins view all supplies"
    ON public.user_supplies FOR SELECT TO authenticated
    USING (public.is_admin(auth.uid()));
```

---

## 11. MEDIUM — Registrazione: claim troppo facile

**File:** `src/app/register/actions.ts`

Se il `codice_cliente` non ha un `profiles` shadow ma esiste una riga in `bills` o `user_supplies`, la registrazione viene accettata **con nome e CFPI forniti dall'utente**:

```ts
if (!isValid && !existingProfile) {
    const { data: supplyFallback } = await supabaseAdmin
        .from('user_supplies')
        .select('id, codice_cliente')
        .eq('codice_cliente', clientCode)
        .limit(1).maybeSingle()
    if (supplyFallback) {
        isValid = true
        name = fullNameInput
    }
    // ... idem per bills
}
```

Chiunque conosca un `codice_cliente` valido può reclamarne le bollette registrandosi con un'email propria e dati anagrafici inventati. Poiché i `codice_cliente` derivano da CIF (primi 6 caratteri) e CIF spesso sono stampati sulle bollette cartacee, la conoscenza è tutt'altro che improbabile.

**Fix:**
- Richiedere sempre un matching CFPI con il campo presente in `bills.cif` / `user_supplies.cif` prima di accettare il claim.
- Aggiungere un secondo fattore di verifica (codice inviato via email/SMS al contatto presente nel pre-load CSV).
- Loggare (server-side) i tentativi di claim senza shadow profile e richiedere conferma admin per attivarli.

---

## 12. MEDIUM — `bodySizeLimit: '500mb'`

**File:** `next.config.ts`

```ts
experimental: { serverActions: { bodySizeLimit: '500mb' } }
```

Amplifica DoS (un client può sparare richieste da 500 MB). Anche se necessario per l'upload degli archivi 7z, dovrebbe essere limitato **solo alla route `/api/upload`** (che può configurarsi con `export const maxDuration` / `runtime` separatamente) e non alle Server Actions generiche.

**Fix:** riportare a default (~1MB), e per l'API upload limitare a un valore ragionevole (es. 100MB) + chunked upload se serve di più.

---

## 13. MEDIUM — Dead code in `requireAdmin()` per API

**File:** `src/lib/auth-checks.ts`

```ts
return { error: 'Forbidden: Admin access required', status: 403 }
return { user, profile, startServiceRole: false } // Success  <-- irraggiungibile
```

L'intento originario non è chiaro. Rischio di regressione se qualcuno sposta la return. La firma tipizzata manca → union di tipi `{error, status} | {user, profile, startServiceRole}` non esplicita.

**Fix:** rimuovere la seconda return, tipizzare esplicitamente, e aggiungere un branch `if (profile?.role === 'admin' …) return { user, profile }` prima dell'errore.

---

## 14. MEDIUM — Rate limit in-memory

`src/app/api/upload/route.ts` mantiene `uploadRateLimit = new Map()` a livello modulo. In deployment serverless / multi-instance ogni cold start resetta il contatore → il limite è solo un placeholder.

**Fix:** persistere in Redis / Upstash o in una tabella Supabase (`admin_rate_limits`) con `ON CONFLICT` + `TTL`.

---

## 15. MEDIUM — `admin/update-password/actions.ts` senza `requireAdmin()`

Il path suggerisce contesto admin, ma la funzione chiama `supabase.auth.updateUser({ password })` che agisce solo sul chiamante. Oggi non è sfruttabile, ma se in futuro si estende per impostare la password di un altro utente (es. reset password admin-initiated) senza aggiungere il check diventa una vulnerabilità grave.

**Fix:** aggiungere `await requireAdmin()` subito all'inizio e tipizzare il contratto.

---

## 16. LOW — Gestione `SUPABASE_SERVICE_ROLE_KEY`

La chiave è in `.env.local` (gitignored, confermato via `git ls-files`). Tuttavia:
- È montata su una workstation sviluppatore condivisa (path `c:\Users\pc2\...`).
- Non c'è policy di rotazione né alert Supabase (Audit Logs dashboard).
- È la stessa chiave usata lato dev e prod — nessuna separazione d'ambiente evidente.

**Fix:**
- Separare progetti Supabase prod / staging / dev.
- Ruotare la service-role key (Supabase Dashboard → Settings → API → Reset).
- Spostare la chiave in un secret manager (Vercel Environment Variables server-only scope).
- Revocare accesso ai dump file che l'hanno potenzialmente esposta.

---

## 17. LOW — `error.stack` esposto su 500

**File:** `src/app/api/upload/route.ts`

```ts
return NextResponse.json({ error: unexpectedError.message, details: unexpectedError.stack }, { status: 500 })
```

Esponere lo stack trace rivela path interni e versioni dipendenze.

**Fix:** loggare lo stack solo server-side, rispondere con messaggio generico + `requestId` per diagnosi.

---

## 18. LOW — `user-data.ts` `.eq('id', …)` duplicato

**File:** `src/actions/user-data.ts:23-24`

```ts
.eq('id', user.id)
.eq('id', user.id)
```

Non è una vulnerabilità, ma un code smell che indica revisione superficiale. Rimuovere.

---

## Checklist azioni immediate (priorità)

1. [ ] Aggiungere `requireAdmin()` a `admin/users/actions.ts`, `admin/update-password/actions.ts` e qualsiasi Server Action che tocchi `createAdminClient()`.
2. [ ] Disabilitare o implementare correttamente la pagina `/auth/verify-2fa`.
3. [ ] Verificare ownership di `billId` in `initiatePagoPAPayment`.
4. [ ] Sostituire `.or(\`...\${identifier}...\`)` con query parametrizzate in login e forgot-password.
5. [ ] Migrare PDF da `public/invoices/` a Supabase Storage privato + signed URL.
6. [ ] `git rm --cached` dei dump/log + filter-repo sulla storia + rotazione service-role key.
7. [ ] Nuova migrazione per chiudere RLS `user_supplies`.
8. [ ] Hardening CSP in `middleware.ts` (rimuovere `unsafe-eval`, ristrutturare con nonces, restringere `img-src`).
9. [ ] Rimuovere tutti i `console.log` di PII dai code-path di produzione.
10. [ ] Rafforzare la verifica in registrazione (richiedere CFPI anche nel fallback bills/supplies, o secondo fattore email).

## Checklist medio termine

- [ ] Rate-limit distribuito (Redis/Upstash).
- [ ] Separare ambienti Supabase (dev / staging / prod) + rotation schedule.
- [ ] `helmet`-style headers completi.
- [ ] Test e2e (Playwright) per i flussi di autenticazione e autorizzazione.
- [ ] Audit logging delle operazioni admin sensibili (delete user, role change, bulk upload) in tabella `admin_audit_logs`.
- [ ] Dipendenze: `npm audit` periodico, Dependabot / Renovate.

## Note finali

Le correzioni 1-3 vanno applicate **prima di qualunque deploy ulteriore in produzione**. Le altre possono essere schedulate in sprint dedicato.
Il commit dei dump JSON è un problema di data breach potenziale: a seconda del regime GDPR in vigore sull'azienda, può richiedere notifica al Garante Privacy entro 72 ore dalla presa di coscienza, se si conferma che il repo git è stato accessibile a soggetti non autorizzati.
