# Security Review — Area Utente ACQDASH (2026-05-06)

**Scope:** tutto ciò che è raggiungibile da un cliente finale autenticato o anonimo. Esclude `/admin/**`.

**Superfici analizzate:**
- `src/middleware.ts`
- `src/app/login/{page,actions}.tsx`
- `src/app/register/{page,actions}.tsx`
- `src/app/forgot-password/{page,actions}.tsx`
- `src/app/profile/{page,change-password,complete}.tsx`
- `src/app/auth/{callback,confirm-invite,verify-2fa}/`
- `src/app/api/bills/[id]/pdf/route.ts`
- `src/actions/{user-data,payment-actions}.ts`
- `src/lib/supabase/{client,server}.ts`

---

## Riepilogo

L'area utente è **complessivamente solida** sui controlli core (RLS, ownership su pagamenti, PDF via signed URL, captcha Turnstile, password complexity in register/forgot, anti-injection PostgREST). Restano però **2 falle critiche** sul flusso di registrazione e sul cambio password, **3 falle High** su redirect/enumeration, e diverse aree di hardening.

---

## CRITICAL

### C-1 — Account takeover via fallback registrazione su `bills`/`user_supplies`

**File:** [register/actions.ts:72-95](acqdash/src/app/register/actions.ts#L72-L95)

**Problema:** quando non esiste un profilo shadow per il `clientCode` ma esistono righe in `bills` o `user_supplies`, il check di identità è solo `row.cif?.toUpperCase() === fiscalCode`. **`bills.cif` è il Codice Identificativo Fornitura** (numero stampato sulla bolletta — 12 cifre tipiche) — **non è il CF/PIVA dell'intestatario**. Chiunque possieda una bolletta cartacea (vicino di casa, ex-inquilino, postino, dipendente disonesto) conosce sia `codice_cliente` sia `cif` e può **registrarsi al posto del legittimo intestatario**, ottenendo accesso allo storico bollette + facoltà di pagamento.

**Exploit:**
1. L'attaccante recupera una bolletta dell'utente vittima.
2. Apre `/register` → inserisce `codice_cliente` + `cif` (al posto del CF) come "Codice Fiscale" + email/password proprie.
3. Il fallback supera il check perché `existingProfile = null` (lo shadow viene cancellato dopo il primo claim, oppure non è mai stato creato per quell'anagrafica), e `bills.cif === fiscalCode` (entrambi = CIF della fornitura).
4. La registrazione completa, le bollette vengono trasferite all'attaccante, lo shadow legittimo (se c'è) viene cancellato a riga 199.

**Impatto:** Account takeover totale + cancellazione del profilo shadow legittimo (lock-out del vero cliente).

**Fix:**
```ts
// Il fallback deve confrontare il CF/PIVA dell'utente (cfpi) — NON il cif tecnico.
// Inoltre richiede che esista un cfpi popolato sulla riga, altrimenti rifiuta.
if (!isValid && !existingProfile) {
    const { data: supplyFallback } = await supabaseAdmin
        .from('user_supplies')
        .select('id, cfpi')
        .eq('codice_cliente', clientCode)
        .not('cfpi', 'is', null)
        .limit(1)
        .maybeSingle()
    if (supplyFallback?.cfpi?.toUpperCase() === fiscalCode) { isValid = true }
    // Idem su bills, sempre filtrando .not('cfpi','is',null)
}
```

In più aggiungere un secondo fattore obbligatorio: invio OTP all'email registrata sul profilo shadow (se presente) prima di consentire il claim.

### C-2 — Cambio password senza re-autenticazione + complessità ridotta

**File:** [profile/change-password/page.tsx:13-49,73,88](acqdash/src/app/profile/change-password/page.tsx#L13-L49)

**Problemi:**
1. `minLength={6}` (sotto la soglia di 8 imposta in register).
2. **Nessuna password complexity** (manca regex maiuscola/minuscola/numero/speciale).
3. **Nessuna verifica della password attuale** prima di cambiare.
4. La pagina è interamente client-side, chiama `supabase.auth.updateUser({password})` da `@supabase/supabase-js` con anon key.

**Exploit:** un attaccante che ottenga la sessione (cookie hijack via XSS, computer condiviso non bloccato, token leak) può cambiare la password e bloccare il legittimo utente fuori dall'account, senza alcun ostacolo aggiuntivo.

**Fix:**
1. Convertire in Server Action con re-auth: chiama `signInWithPassword(currentPassword)` come verifica, poi `updateUser({password})`.
2. Stessa regex di [forgot-password/actions.ts:118](acqdash/src/app/forgot-password/actions.ts#L118) (8 caratteri + complexity).
3. Logout di tutte le altre sessioni dopo il cambio (`auth.signOut({ scope: 'others' })`).

---

## HIGH

### H-1 — Open redirect su `/auth/callback?next=...`

**File:** [auth/callback/route.ts:9,15](acqdash/src/app/auth/callback/route.ts#L9)

```ts
const next = searchParams.get('next') ?? '/profile'
return NextResponse.redirect(`${origin}${next}`)
```

Anche concatenato con `${origin}`, un `next` come `//evil.com/path` produce `https://acqdash.it//evil.com/path` che alcuni browser interpretano come `//evil.com/path` (protocol-relative). In più un attaccante può forzare `next=/admin/users` per mandare un cliente fresh-login lì (errore UX/info disclosure).

**Fix:**
```ts
const rawNext = searchParams.get('next') ?? '/profile'
const SAFE_NEXT = /^\/(?!\/)[A-Za-z0-9/_\-\.]*$/
const next = SAFE_NEXT.test(rawNext) ? rawNext : '/profile'
```

### H-2 — Pagina di errore `/auth/auth-code-error` inesistente

**File:** [auth/callback/route.ts:20](acqdash/src/app/auth/callback/route.ts#L20)

`return NextResponse.redirect(${origin}/auth/auth-code-error)` ma la pagina **non esiste** nel routing → 404. Utente che incappa in errore di scambio code (link scaduto/già usato) ottiene solo 404 → friction + nessun messaggio di errore.

**Fix:** creare `src/app/auth/auth-code-error/page.tsx` con un messaggio "Link scaduto, richiedine uno nuovo" + bottone "Torna al login". Oppure puntare a `/login?error=expired` con un toast.

### H-3 — `select('*')` espone più dati del necessario

**File:** [actions/user-data.ts:23,42,54](acqdash/src/actions/user-data.ts#L23)

Restituisce al client `profiles.role`, `profiles.is_shadow`, e `bills.pdf_url` (chiave R2 dell'oggetto). `pdf_url` non è un segreto in sé (l'oggetto non è pubblicamente accessibile, serve sempre signed URL), ma:
- è un **info disclosure** della struttura interna R2 (`{importId}/{filename}`) che facilita ricognizione;
- consente a un client malevolo di costruire payload specifici verso la API `/api/bills/[id]/pdf`.

Inoltre c'è un bug evidente — chained `.eq('id', user.id).eq('id', user.id)` (due volte la stessa clausola, riga 23-24).

**Fix:** select esplicito delle sole colonne necessarie al render del profilo/bollette. Mantenere `pdf_url` server-side e non passarlo al client.

```ts
.select('id, name, surname, email, phone, codice_cliente, cif, cfpi, address, city')
.eq('id', user.id)
.maybeSingle()
```

### H-4 — Enumeration parziale via messaggi di errore in `/register`

**File:** [register/actions.ts:164-166](acqdash/src/app/register/actions.ts#L164)

```ts
if (profileError.message.includes('username')) return { error: 'Questo Username è già stato utilizzato.' }
if (profileError.message.includes('cif')) return { error: 'Questo CIF/P.IVA risulta già registrato.' }
```

Permette a un attaccante di scoprire se un CF/PIVA è già registrato, agevolando attacchi di credential stuffing mirato.

**Fix:** un singolo messaggio generico "Dati non validi o già in uso". Mantenere granularità solo nei log server-side.

### H-5 — `lookupUser` espone se l'utenza esiste

**File:** [forgot-password/actions.ts:42-57](acqdash/src/app/forgot-password/actions.ts#L42-L57)

`lookupUser` ritorna "Utenza non trovata" o "Utenza trovata con email mascherata" → enumerazione utenti. `sendRecoveryOTP` poi è generico (bene), ma il primo step ha già rivelato l'esito.

**Fix:** rendere `lookupUser` sempre `success: true` e mostrare la maschera dell'email (fittizia se non trovata) o un messaggio uniforme tipo "Se l'utenza esiste, riceverai un'email". UX leggermente peggiore ma anti-enumerazione.

---

## MEDIUM

### M-1 — `'unsafe-inline'` su `script-src` in CSP

**File:** [middleware.ts:50](acqdash/src/middleware.ts#L50)

`script-src 'self' 'unsafe-inline'` → annulla la protezione XSS della CSP. Next 16 supporta nonce automatici in App Router; spostare a `'strict-dynamic'` con nonce.

### M-2 — Logging di errori con `JSON.stringify` di payload Supabase

**File:** [actions/user-data.ts:28](acqdash/src/actions/user-data.ts#L28)

`console.error('Detailed Profile Error:', JSON.stringify(profileError, null, 2))`. Il payload Supabase può contenere snippet di dati (PII). Su infrastrutture di logging shared espone dati personali.

**Fix:** loggare solo `error.code` + `error.message` + user_id (hash).

### M-3 — Token PagoPA esposto in URL di redirect

**File:** [actions/payment-actions.ts:113](acqdash/src/actions/payment-actions.ts#L113)

`https://checkout.pagopa.it/ui/payment?id=${data.paymentToken}` — il token finisce in browser history e referrer headers verso third party.

**Fix:** verificare specifiche PagoPA — preferibile redirect server-side via `Location` header con token in body POST, oppure token short-TTL (lo è già lato PagoPA, ma a livello applicativo conviene non logarlo).

### M-4 — `bill` query include `profiles:user_id(email, cfpi, name)`

**File:** [actions/payment-actions.ts:32](acqdash/src/actions/payment-actions.ts#L32)

L'action server-side restituisce solo `success` e `paymentUrl` — non il blob bill — quindi non c'è leak. Però è facile sbagliarsi e ritornare la query intera nel JSON: aggiungere `select` minimi (`id, user_id, importo`) e fetchare email/cfpi in una query separata.

### M-5 — Login `verify-2fa` action rotta

**File:** [auth/verify-2fa/actions.ts](acqdash/src/app/auth/verify-2fa/actions.ts)

Restituisce errore costante "non implementato". Non vulnerabile, ma se la UI redirige a questa pagina dopo signIn riuscito ed essa è raggiungibile, **un utente è bloccato** dopo login.

**Fix:** rimuovere la pagina `verify-2fa` finché non è davvero implementato.

---

## LOW / hardening

- [middleware.ts:87](acqdash/src/middleware.ts#L87) — il matcher esclude `api/upload` ma non `api/upload-users`: la route è comunque protetta da `requireAdmin()`, quindi è solo CSP che salta.
- `change-password/page.tsx:8-11` istanzia `createClient` con anon key a livello modulo: se per errore questo file viene importato lato server in un caso edge, perde il contesto cookie. Spostare dentro la funzione.
- `/auth/confirm-invite/page.tsx` — verificare che faccia ownership check sull'invito (non rivisto qui).
- Login codice_cliente di sole 6 cifre → spazio 10⁶: **rate-limit per IP** sull'endpoint login (in-memory non basta, serve Redis/Upstash).
- Cookie session: verificare `SameSite=Lax`, `Secure=true`, `HttpOnly=true` (configurati in Supabase, comunque controllarli in produzione).
- Aggiungere `Cross-Origin-Opener-Policy: same-origin` e `Cross-Origin-Resource-Policy: same-origin` al middleware.
- `register/actions.ts:184-192` — il fallback claim `bills.codice_cliente = clientCode` continua a funzionare anche dopo C-1: dopo il fix di C-1 va riarmonizzato.

---

## Cosa è blindato bene (NON regredire)

- Login: regex whitelist `[a-zA-Z0-9._@+\-]+`, lookup sequenziali `.eq()`, **mai** `.or()` interpolata.
- Register/forgot-password: password regex 8+ con mix complessità.
- Forgot-password: 4 step (lookup → OTP → verify → update) + rate-limit `429` gestito.
- Pagamenti: ownership check (`bill.user_id === user.id`) + amount match (`Math.abs < 0.01`) + INSERT su `payments` con `status='pending'` + `REVOKE UPDATE FROM authenticated` lato DB.
- PDF API: auth check (owner OR admin), `pdfExistsOnR2()` HEAD pre-check, signed URL TTL 300s, redirect 302.
- Middleware: CSP (Supabase + R2 + Turnstile allowlist), HSTS in prod, X-Content-Type-Options, frame-ancestors none, Permissions-Policy, redirect non-auth su `/profile` e `/admin`.
- Service-role key **mai** esposta al client (uso server-only via `createAdminClient()`).
- `payments` con trigger `trg_payments_sync_bill_status` come single source of truth.
