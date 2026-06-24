# Import contratti — CF/P.IVA separati, PEC, refresh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supportare il nuovo formato del file contratti come import di *refresh*, separando CF e P.IVA in due colonne, aggiungendo la PEC, e rimuovendo `cfpi` da `profiles`.

**Architecture:** Migration su `profiles` (add `codice_fiscale`/`partita_iva`/`pec`, backfill, recreate `search_users`, drop `cfpi`) → riscrittura del parser di `/api/upload-users` con mapping diretto sui nomi nuovi e semantica "il file vince" (mail degli utenti attivi solo segnalata) → rewiring dei consumatori di `profiles.cfpi` (register, PagoPA, export, admin, profilo) → UI admin.

**Tech Stack:** Next.js 16 (App Router, Server Actions, API routes), Supabase (Postgres + PostgREST RPC), `csv-parse`, TypeScript.

**Spec:** [docs/superpowers/specs/2026-06-09-import-contratti-cf-piva-pec-design.md](../specs/2026-06-09-import-contratti-cf-piva-pec-design.md)

---

## Pre-requisiti e vincoli

- **Niente test runner**: il progetto non ha jest/vitest. La verifica di ogni task è `npm run build` (type-check + compile) + controlli manuali/SQL indicati. ⚠️ **Non lanciare `npm run build` mentre `next dev` è attivo** (corrompe `.next`): fermare prima il dev server.
- **Sicurezza**: prima di toccare `register/actions.ts`, `payment-actions.ts`, `admin/*`, consultare la skill **acqdash-user-area-security**. Non loggare CF/P.IVA/email/codice_cliente in chiaro. Le Server Action admin restano dietro `requireAdmin()`/`requireSuperadmin()`.
- **DB drift**: i file in `supabase/migrations/` potrebbero non coincidere con il DB live (alcune migration applicate a mano). Per questo **Task 0 ispeziona il DB live** e cattura la definizione reale di `search_users` e i privilegi di colonna, che diventano la base per la migration.
- **Migration**: nuovo file in `supabase/migrations/` con prefisso data; applicare nello SQL Editor di Supabase; dopo la DDL `NOTIFY pgrst, 'reload schema';`.

## File toccati

| File | Responsabilità | Tipo |
|---|---|---|
| `supabase/migrations/20260609120000_profiles_split_cf_piva_pec.sql` | Add colonne + backfill + GRANT + recreate `search_users` + drop `cfpi` | Create |
| `src/app/api/upload-users/route.ts` | Parser nuovo header + semantica refresh | Modify |
| `src/app/register/actions.ts` | Verifica identità su `codice_fiscale`/`partita_iva`; finalize profilo | Modify |
| `src/actions/payment-actions.ts` | `debtorFiscalCode` dai nuovi campi | Modify |
| `src/app/api/me/export/route.ts` | Export include nuovi campi | Modify |
| `src/app/admin/users/actions.ts` | `updateUser` accetta nuovi campi | Modify |
| `src/app/admin/users/[id]/page.tsx` | Dettaglio: interface, edit form (CF/P.IVA/PEC), display | Modify |
| `src/app/admin/users/page.tsx` | Lista: interface, adapt, edit, export CSV, badge | Modify |
| `src/app/profile/page.tsx`, `src/app/profile/info/page.tsx` | `fiscalCode` dai nuovi campi | Modify |

---

### Task 0: Ispezione del DB live (discovery, niente codice applicativo)

**Files:** nessuno (solo query nello SQL Editor di Supabase). Annotare gli output in fondo a questo file o in un commento del PR.

- [ ] **Step 1: Colonne attuali di `profiles`**

Run (Supabase SQL Editor):
```sql
select column_name, data_type
from information_schema.columns
where table_schema='public' and table_name='profiles'
order by ordinal_position;
```
Atteso: conferma presenza di `cfpi`; verifica se esistono già `codice_fiscale`/`partita_iva`/`pec` (non dovrebbero); annota se `cif`/`address`/`city`/`stadio`/`stato_contratto` esistono su `profiles`.

- [ ] **Step 2: Definizione reale di `search_users`**

Run:
```sql
select pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='search_users';
```
**Salva l'output integrale**: è la base testuale su cui la migration applicherà le sostituzioni `cfpi → codice_fiscale/partita_iva/pec` (Task 1, Step 4).

- [ ] **Step 3: Altri oggetti DB che referenziano `profiles.cfpi`**

Run:
```sql
select dependent_view.relname as view_name
from pg_depend d
join pg_rewrite r on r.oid=d.objid
join pg_class dependent_view on dependent_view.oid=r.ev_class
join pg_attribute a on a.attrelid=d.refobjid and a.attnum=d.refobjsubid
join pg_class t on t.oid=d.refobjid
where t.relname='profiles' and a.attname='cfpi';
```
Atteso: nessuna view dipendente (la `search_users` usa SQL dinamico, quindi non risulta qui). Se compaiono view, vanno ricreate nella migration prima del drop.

- [ ] **Step 4: Privilegi di colonna su `profiles`**

Run:
```sql
select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_schema='public' and table_name='profiles' and column_name='cfpi';
```
**Salva l'output**: replicheremo gli stessi GRANT su `codice_fiscale`/`partita_iva`/`pec` (Task 1, Step 5), così l'editing admin lato client continua a funzionare.

- [ ] **Step 5: Snapshot dati per il rollback**

Run:
```sql
select count(*) filter (where cfpi ~ '^\d{11}$') as piva_count,
       count(*) filter (where cfpi is not null and cfpi !~ '^\d{11}$') as cf_count,
       count(*) filter (where cfpi is null) as null_count
from public.profiles;
```
Annota i conteggi: serviranno a validare il backfill (Task 1, Step 7).

---

### Task 1: Migration — colonne, backfill, GRANT, `search_users`, drop `cfpi`

**Files:**
- Create: `supabase/migrations/20260609120000_profiles_split_cf_piva_pec.sql`

> Eseguire gli step **in ordine** nello stesso file. Il drop di `cfpi` va **per ultimo**, dopo aver ricreato `search_users` senza `cfpi`.

- [ ] **Step 1: Aggiungi le tre colonne (idempotente)**

```sql
-- 20260609120000_profiles_split_cf_piva_pec.sql
-- Separa CF e P.IVA, aggiunge PEC, rimuove cfpi da profiles.

alter table public.profiles add column if not exists codice_fiscale text;
alter table public.profiles add column if not exists partita_iva   text;
alter table public.profiles add column if not exists pec           text;
```

- [ ] **Step 2: Backfill dai cfpi esistenti (idempotente)**

```sql
-- 11 cifre => P.IVA, altrimenti CF. Solo se le nuove colonne sono ancora vuote.
update public.profiles
set partita_iva = cfpi
where cfpi ~ '^\d{11}$' and partita_iva is null;

update public.profiles
set codice_fiscale = cfpi
where cfpi is not null and cfpi !~ '^\d{11}$' and codice_fiscale is null;
```

- [ ] **Step 3: Verifica backfill (manuale, non distruttiva)**

Run:
```sql
select
  count(*) filter (where partita_iva is not null)    as piva_filled,
  count(*) filter (where codice_fiscale is not null) as cf_filled
from public.profiles;
```
Atteso: `piva_filled` ≈ `piva_count` e `cf_filled` ≈ `cf_count` dal Task 0 Step 5. Se non torna, **fermarsi** e indagare prima del drop.

- [ ] **Step 4: Ricrea `search_users` senza `cfpi`**

Definizione live catturata in Task 0 (autoritativa). Eseguire `DROP FUNCTION` + `CREATE` con `cfpi` sostituito da `codice_fiscale, partita_iva, pec`:

```sql
drop function if exists public.search_users(text, integer, integer, text, text, text, text);

create or replace function public.search_users(search_term text, _limit integer default 10, _offset integer default 0, _status_filter text default 'all'::text, _shadow_filter text default 'all'::text, _sort_by text default 'created_at'::text, _sort_order text default 'desc'::text)
 returns table(id uuid, email text, name text, codice_fiscale text, partita_iva text, pec text, codice_cliente text, created_at timestamp with time zone, is_shadow boolean, bills_count integer, user_supplies_count integer, user_supplies jsonb, total_count bigint)
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
    search_tokens text[];
    sort_col      text;
    sort_dir      text;
begin
    if not exists (
        select 1 from public.profiles
        where profiles.id = auth.uid()
          and profiles.role in ('admin', 'super_admin', 'superadmin')
    ) then
        raise exception 'Access Denied: Admin privileges required.';
    end if;

    sort_col := case lower(_sort_by)
        when 'name'                then 'name'
        when 'bills_count'         then 'bills_count'
        when 'user_supplies_count' then 'user_supplies_count'
        else 'created_at'
    end;
    sort_dir := case lower(_sort_order)
        when 'asc' then 'asc'
        else 'desc'
    end;

    search_tokens := string_to_array(trim(coalesce(search_term, '')), ' ');

    return query execute format($q$
        with base_users as (
            select
                p.id, p.email, p.name, p.codice_fiscale, p.partita_iva, p.pec, p.codice_cliente,
                p.created_at, p.is_shadow,
                p.bills_count,
                p.user_supplies_count
            from public.profiles p
            where p.role not in ('admin', 'super_admin', 'superadmin')
              and ($1 = 'all'
                   or ($1 = 'active' and coalesce(p.is_shadow, false) = false)
                   or ($1 = 'shadow' and coalesce(p.is_shadow, false) = true))
               and (
                    coalesce(array_length($2, 1), 0) = 0
                 or (
                    select bool_and(
                        concat_ws(' ',
                            p.name, p.email, p.codice_fiscale, p.partita_iva, p.pec, p.codice_cliente
                        ) ilike '%%' || token || '%%'
                        or exists (
                            select 1 from public.user_supplies s
                            where s.codice_cliente = p.codice_cliente
                              and (s.cif ilike '%%' || token || '%%' or s.address ilike '%%' || token || '%%')
                        )
                        or exists (
                            select 1 from public.bills b
                            where b.codice_cliente = p.codice_cliente
                              and (b.idboll::text ilike '%%' || token || '%%')
                        )
                    )
                    from unnest($2) as token
                    where token <> ''
                 )
              )
        ),
        user_with_supplies as (
            select
                u.*,
                coalesce(
                    (select jsonb_agg(jsonb_build_object(
                        'cif', s.cif,
                        'address', s.address,
                        'city', s.city
                    ))
                     from public.user_supplies s
                     where s.codice_cliente = u.codice_cliente),
                    '[]'::jsonb
                ) as user_supplies
            from base_users u
        ),
        counted as (
            select *, (select count(*) from base_users)::bigint as total_count
            from user_with_supplies
        )
        select id, email, name, codice_fiscale, partita_iva, pec, codice_cliente,
               created_at, is_shadow,
               bills_count, user_supplies_count, user_supplies, total_count
        from counted
        order by %I %s nulls last, id desc
        limit $3 offset $4
    $q$, sort_col, sort_dir)
    using _shadow_filter, search_tokens, _limit, _offset;
end;
$function$;
```

- [ ] **Step 5: GRANT di colonna (allineati a quelli reali di `cfpi`)**

Task 0 ha rilevato: `cfpi` ha SELECT/INSERT per `anon`+`authenticated`, UPDATE **solo** per `service_role`/`postgres`. Replico lo stesso pattern (l'edit admin passa dalla Server Action service_role; gli utenti `authenticated` NON possono aggiornare questi campi lato client — invariante di sicurezza mantenuta):

```sql
grant select (codice_fiscale, partita_iva, pec) on public.profiles to anon, authenticated, service_role;
grant insert (codice_fiscale, partita_iva, pec) on public.profiles to anon, authenticated, service_role;
grant update (codice_fiscale, partita_iva, pec) on public.profiles to service_role;
```

- [ ] **Step 6: Drop `cfpi`**

```sql
alter table public.profiles drop column if exists cfpi;
notify pgrst, 'reload schema';
```

- [ ] **Step 7: Verifica finale schema**

Run:
```sql
select column_name from information_schema.columns
where table_schema='public' and table_name='profiles'
  and column_name in ('cfpi','codice_fiscale','partita_iva','pec');
```
Atteso: `codice_fiscale`, `partita_iva`, `pec` presenti; `cfpi` assente. Eseguire una `select search_users('', 5, 0)` (come admin) e verificare che ritorni senza errori.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260609120000_profiles_split_cf_piva_pec.sql
git commit -m "feat(db): split profiles.cfpi into codice_fiscale/partita_iva, add pec"
```

---

### Task 2: Parser import — nuovo header + semantica refresh

**Files:**
- Modify: `src/app/api/upload-users/route.ts`

- [ ] **Step 1: Sostituisci il blocco di estrazione campi (righe ~81-140)**

Sostituire l'attuale ciclo di parsing (dal commento `// We build two maps:` fino alla chiusura del `for`) con questo. Mapping **diretto** sui nomi del nuovo header (niente fallback), payload profilo con i tre nuovi campi:

```ts
        // profilePayloads — una riga per codice_cliente (un cliente ha N forniture)
        // supplyPayloads  — una riga per cif (ogni cif = una fornitura)
        const profilePayloads = new Map<string, any>()
        const supplyPayloads = new Map<string, any>()

        let skippedAnnullato = 0
        let skippedNoCif = 0
        let skippedShortCif = 0

        const clean = (v: unknown) => (v == null ? null : String(v).trim() || null)

        for (const row of records as any[]) {
            const cif = clean(row['CIF'])
            const name = clean(row['RagioneSociale'])
            const codiceFiscale = clean(row['CodiceFiscale'])
            const partitaIva = clean(row['PartitaIva'])
            const stadio = clean(row['stadio'])
            const statoContratto = clean(row['statoContratto'])
            const pec = clean(row['PEC'])?.toLowerCase() ?? null
            const emailRaw = clean(row['Mail'])
            const email = emailRaw ? emailRaw.toLowerCase() : null
            const address = clean(row['indirizzo'])
            const city = clean(row['comune'])

            // 08 = contratto annullato: aggiorniamo la fornitura ma non creiamo
            // un profilo nuovo solo per un contratto annullato.
            const isAnnullato = statoContratto === '08'
            if (isAnnullato) skippedAnnullato++

            if (!cif) { skippedNoCif++; continue }

            // Nessun codice_cliente nell'header → si deriva dai primi 6 del CIF.
            let clientCode: string | null = null
            if (cif.length >= 6) clientCode = cif.substring(0, 6)
            if (!clientCode) {
                skippedShortCif++
                errors.push(`Excluded: CIF troppo corto: ${cif}`)
                errorCount++
                continue
            }

            if (!isAnnullato) {
                profilePayloads.set(clientCode, {
                    codice_cliente: clientCode,
                    name,
                    codice_fiscale: codiceFiscale,
                    partita_iva: partitaIva,
                    email,
                    pec,
                    is_shadow: true,
                    role: 'user',
                })
            }

            supplyPayloads.set(cif, {
                codice_cliente: clientCode,
                cif,
                address,
                city,
                stadio,
                stato_contratto: statoContratto,
            })
        }
```

- [ ] **Step 2: Sostituisci la logica di update profilo (righe ~149-227) con la semantica "il file vince" + protezione email**

Sostituire il corpo del `for (const payload of profilePayloads.values())` (la parte che calcola `updates`) con:

```ts
        for (const payload of profilePayloads.values()) {
            try {
                const { data: existing, error: fetchError } = await supabase
                    .from('profiles')
                    .select('id, codice_cliente, email, name, codice_fiscale, partita_iva, pec, is_shadow')
                    .eq('codice_cliente', payload.codice_cliente)
                    .maybeSingle()

                if (fetchError) throw fetchError

                if (existing) {
                    const updates: any = {}
                    if (!existing.codice_cliente) updates.codice_cliente = payload.codice_cliente

                    // "Il file vince": sovrascrivi se il file porta un valore non vuoto e diverso.
                    // Un valore vuoto nel file NON cancella il dato a sistema.
                    for (const field of ['name', 'codice_fiscale', 'partita_iva', 'pec'] as const) {
                        const incoming = payload[field]
                        if (incoming && incoming !== existing[field]) updates[field] = incoming
                    }

                    // Email: shadow o vuota → aggiorna; utente attivo con mail diversa → SOLO segnalazione.
                    if (payload.email) {
                        const currentEmail = (existing.email || '').toLowerCase().trim()
                        if (payload.email !== currentEmail) {
                            if (!currentEmail || existing.is_shadow) {
                                updates.email = payload.email
                            } else {
                                errors.push(
                                    `Email cambiata per utente attivo ${payload.codice_cliente}: ignorata (la mail di login non si aggiorna da CSV).`
                                )
                            }
                        }
                    }

                    if (Object.keys(updates).length > 0) {
                        const { error } = await supabase
                            .from('profiles')
                            .update(updates)
                            .eq('id', existing.id)
                        if (error) throw error
                    }
                    successCount++
                } else {
                    const { error } = await supabase.from('profiles').insert(payload)
                    if (error) throw error
                    successCount++
                }
            } catch (err: any) {
                console.error(`[API] Profile Error for ${payload.codice_cliente}:`, err?.message)
                errors.push(`Err ${payload.codice_cliente}: ${err.message}`)
                errorCount++
            }

            processedSoFar++
            if (processedSoFar - lastProgressFlush >= 50) {
                lastProgressFlush = processedSoFar
                const reportProcessed = Math.round((processedSoFar / profilePayloads.size) * records.length * 0.85)
                await updateProgress(reportProcessed, `Profili ${processedSoFar}/${profilePayloads.size}`)
            }
        }
```

> Nota: `processedSoFar` e `lastProgressFlush` sono già dichiarati subito prima del loop nell'originale — mantenerli. Il commento dell'header CSV (riga ~34) va aggiornato a `CIF;RagioneSociale;CodiceFiscale;PartitaIva;stadio;statoContratto;Mail;PEC;indirizzo;comune`.

- [ ] **Step 3: Verifica build**

Run: `npm run build`
Expected: PASS (nessun errore TS in `route.ts`).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/upload-users/route.ts
git commit -m "feat(import): map new contratti header, file-wins refresh, store cf/piva/pec"
```

---

### Task 3: Registrazione — verifica identità su CF/P.IVA

**Files:**
- Modify: `src/app/register/actions.ts`

> Consultare prima la skill **acqdash-user-area-security**. Il fix C-1 (verifica identità) NON deve regredire.

- [ ] **Step 1: Aggiorna la select del profilo e la validazione (righe 42-60)**

Sostituire:
```ts
    const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, codice_cliente, name, email, cfpi')
        .eq('codice_cliente', clientCode)
        .maybeSingle()
```
con:
```ts
    const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, codice_cliente, name, email, codice_fiscale, partita_iva')
        .eq('codice_cliente', clientCode)
        .maybeSingle()
```
E sostituire il blocco di validazione:
```ts
    if (existingProfile) {
        // Validate against CFPI (Fiscal Code / VAT)
        isValid = (existingProfile.cfpi && existingProfile.cfpi.toUpperCase() === fiscalCode)
        if (isValid) {
            name = existingProfile.name || fullNameInput;
        }
    }
```
con (match sul CF **oppure** sulla P.IVA digitati):
```ts
    if (existingProfile) {
        const cf = existingProfile.codice_fiscale?.toUpperCase()
        const piva = existingProfile.partita_iva?.toUpperCase()
        isValid = (!!cf && cf === fiscalCode) || (!!piva && piva === fiscalCode)
        if (isValid) {
            name = existingProfile.name || fullNameInput;
        }
    }
```

> I fallback su `user_supplies.cfpi` e `bills.cfpi` (righe 66-92) **restano invariati**: quelle tabelle conservano `cfpi` (decisione D6).

- [ ] **Step 2: Aggiorna la finalizzazione del profilo (righe 150-159)**

Sostituire:
```ts
        .update({
            name: name,
            email: email,
            cfpi: fiscalCode,
            role: 'user',
            is_shadow: false,
        })
```
con (instrada il valore digitato per formato):
```ts
        .update({
            name: name,
            email: email,
            ...(/^\d{11}$/.test(fiscalCode) ? { partita_iva: fiscalCode } : { codice_fiscale: fiscalCode }),
            role: 'user',
            is_shadow: false,
        })
```

- [ ] **Step 3: Verifica build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/register/actions.ts
git commit -m "feat(register): verify identity against codice_fiscale/partita_iva (C-1 preserved)"
```

---

### Task 4: PagoPA — debtor fiscal code

**Files:**
- Modify: `src/actions/payment-actions.ts`

- [ ] **Step 1: Aggiorna la select join (riga 32)**

Sostituire:
```ts
        .select('id, user_id, importo, cfpi, codice_cliente, profiles:user_id(email, cfpi, name)')
```
con:
```ts
        .select('id, user_id, importo, cfpi, codice_cliente, profiles:user_id(email, codice_fiscale, partita_iva, name)')
```
> `bills.cfpi` (radice della select) **resta**: quella colonna esiste ancora su `bills`.

- [ ] **Step 2: Aggiorna `debtorFiscalCode` (riga 51)**

Sostituire:
```ts
    const debtorFiscalCode = profile?.cfpi || bill.cfpi
```
con:
```ts
    const debtorFiscalCode = profile?.codice_fiscale || profile?.partita_iva || bill.cfpi
```

- [ ] **Step 3: Verifica build** — Run: `npm run build` — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/actions/payment-actions.ts
git commit -m "feat(payments): resolve debtor fiscal code from codice_fiscale/partita_iva"
```

---

### Task 5: GDPR export — includi i nuovi campi

**Files:**
- Modify: `src/app/api/me/export/route.ts`

- [ ] **Step 1: Aggiorna la select profilo (riga 20)**

Sostituire:
```ts
        .select('id, name, email, phone, cfpi, codice_cliente, created_at')
```
con:
```ts
        .select('id, name, email, phone, codice_fiscale, partita_iva, pec, codice_cliente, created_at')
```

- [ ] **Step 2: Verifica build** — Run: `npm run build` — Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/me/export/route.ts
git commit -m "feat(export): include codice_fiscale/partita_iva/pec in GDPR export"
```

---

### Task 6: Admin `updateUser` action

**Files:**
- Modify: `src/app/admin/users/actions.ts`

- [ ] **Step 1: Aggiorna la firma (righe 53-61)**

`cif`/`address`/`city` **non esistono** su `profiles` (Task 0) → vanno rimossi (la loro presenza rompeva ogni update admin). Sostituire:
```ts
export async function updateUser(userId: string, data: {
    name?: string
    email?: string
    phone?: string
    cfpi?: string
    cif?: string
    address?: string
    city?: string
}) {
```
con:
```ts
export async function updateUser(userId: string, data: {
    name?: string
    email?: string
    phone?: string
    codice_fiscale?: string
    partita_iva?: string
    pec?: string
}) {
```

- [ ] **Step 2: Aggiorna l'update object (righe 91-99)**

Sostituire:
```ts
        .update({
            name: data.name,
            email: data.email,
            phone: data.phone,
            cfpi: data.cfpi,
            cif: data.cif,
            address: data.address,
            city: data.city
        })
```
con (solo colonne realmente esistenti su `profiles`):
```ts
        .update({
            name: data.name,
            email: data.email,
            phone: data.phone,
            codice_fiscale: data.codice_fiscale,
            partita_iva: data.partita_iva,
            pec: data.pec
        })
```

- [ ] **Step 3: Verifica build** — Run: `npm run build` — Expected: il build fallirà finché il chiamante ([id]/page.tsx) passa `cfpi`. Procedere subito al Task 7, poi ricompilare.

- [ ] **Step 4: Commit** (insieme al Task 7, build verde)

```bash
git add src/app/admin/users/actions.ts
git commit -m "feat(admin): updateUser accepts codice_fiscale/partita_iva/pec"
```

---

### Task 7: Dettaglio utente admin — interface, edit form, display

**Files:**
- Modify: `src/app/admin/users/[id]/page.tsx`

- [ ] **Step 1: Interface `Profile` (riga 27)**

Sostituire `cfpi: string | null` con:
```ts
    codice_fiscale: string | null
    partita_iva: string | null
    pec: string | null
```

- [ ] **Step 2: State del form (riga 125) — aggiungi i campi**

Sostituire:
```ts
    const [userData, setUserData] = useState({
        name: '', email: '', phone: '', address: '', city: '', fiscalCode: '', cif: ''
    })
```
con:
```ts
    const [userData, setUserData] = useState({
        name: '', email: '', phone: '', address: '', city: '', codiceFiscale: '', partitaIva: '', pec: '', cif: ''
    })
```

- [ ] **Step 3: Popolamento form da `profile` (righe 130-138)**

Sostituire:
```ts
            setUserData({
                name: profile.name || '',
                email: profile.email || '',
                phone: profile.phone || '',
                address: profile.address || '',
                city: profile.city || '',
                fiscalCode: profile.cfpi || '',
                cif: profile.cif || ''
            })
```
con:
```ts
            setUserData({
                name: profile.name || '',
                email: profile.email || '',
                phone: profile.phone || '',
                address: profile.address || '',
                city: profile.city || '',
                codiceFiscale: profile.codice_fiscale || '',
                partitaIva: profile.partita_iva || '',
                pec: profile.pec || '',
                cif: profile.cif || ''
            })
```

- [ ] **Step 4: Chiamata `updateUser` in `handleSave` (righe 145-149)**

Sostituire:
```ts
            updateUser(id, {
                name: userData.name, email: userData.email, phone: userData.phone,
                address: userData.address, city: userData.city,
                cfpi: userData.fiscalCode, cif: userData.cif
            }),
```
con (niente più `address`/`city`/`cif`: non sono colonne di `profiles`):
```ts
            updateUser(id, {
                name: userData.name, email: userData.email, phone: userData.phone,
                codice_fiscale: userData.codiceFiscale, partita_iva: userData.partitaIva,
                pec: userData.pec
            }),
```

> Le righe `address`/`city`/`cif` del form profilo erano vestigiali (quei dati stanno su `user_supplies`, già gestite nella sezione Forniture). Lasciare invariati `userData.address/city/cif` e il loro rendering: semplicemente non passarli più a `updateUser`. Display: `profile.address`/`profile.city` nella card non renderizzano (campi assenti) — comportamento già attuale, fuori scope.

- [ ] **Step 5: Display nell'Account Details Card (righe 764-766)**

Sostituire:
```tsx
                                {profile.cfpi && (
                                    <CodeBadge value={profile.cfpi} label={/^\d{11}$/.test(profile.cfpi) ? 'P.IVA' : 'CF'} copyable />
                                )}
```
con:
```tsx
                                {profile.codice_fiscale && (
                                    <CodeBadge value={profile.codice_fiscale} label="CF" copyable />
                                )}
                                {profile.partita_iva && (
                                    <CodeBadge value={profile.partita_iva} label="P.IVA" copyable />
                                )}
                                {profile.pec && (
                                    <CodeBadge value={profile.pec} label="PEC" copyable mono={false} />
                                )}
```

> Se in modalità edit esiste un input legato a `userData.fiscalCode` (cercare `fiscalCode` nel file), sostituirlo con due input (`codiceFiscale`, `partitaIva`) + uno per `pec`, sullo stesso pattern degli altri input del form.

- [ ] **Step 6: Verifica build** — Run: `npm run build` — Expected: PASS (insieme a Task 6).

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/users/[id]/page.tsx
git commit -m "feat(admin): user detail shows/edits CF, P.IVA and PEC separately"
```

---

### Task 8: Lista utenti admin — interface, adapt, edit, export, badge

**Files:**
- Modify: `src/app/admin/users/page.tsx`

- [ ] **Step 1: Interface `UserProfile` (riga 23)**

Sostituire `cfpi: string` con:
```ts
    codiceFiscale: string
    partitaIva: string
    pec: string
```

- [ ] **Step 2: `adapt()` (riga 1330)**

Sostituire `cfpi: p.cfpi || '',` con:
```ts
        codiceFiscale: p.codice_fiscale || '',
        partitaIva: p.partita_iva || '',
        pec: p.pec || '',
```

- [ ] **Step 3: `saveEditRow` updates (righe 237-242)**

Sostituire:
```ts
            const updates = {
                name: rowDrafts.fullName,
                email: rowDrafts.email,
                cfpi: rowDrafts.cfpi,
                codice_cliente: rowDrafts.clientCode
            }
```
con:
```ts
            const updates = {
                name: rowDrafts.fullName,
                email: rowDrafts.email,
                codice_fiscale: rowDrafts.codiceFiscale,
                partita_iva: rowDrafts.partitaIva,
                codice_cliente: rowDrafts.clientCode
            }
```

- [ ] **Step 4: `updateUserField` dbColumn map (righe 323-328)**

Sostituire:
```ts
        const dbColumn: Record<string, string> = {
            fullName: 'name',
            email: 'email',
            cfpi: 'cfpi',
            clientCode: 'codice_cliente'
        }
```
con:
```ts
        const dbColumn: Record<string, string> = {
            fullName: 'name',
            email: 'email',
            codiceFiscale: 'codice_fiscale',
            partitaIva: 'partita_iva',
            clientCode: 'codice_cliente'
        }
```

- [ ] **Step 5: Export CSV (righe 356-366)**

Sostituire:
```ts
        const headers = ['Nome', 'Email', 'CF/PIVA', 'Codice Cliente', 'Indirizzo', 'Città']
        const csvContent = [
            headers.join(','),
            ...selectedUsers.map(u => [
                `"${u.fullName}"`,
                `"${u.email}"`,
                `"${u.cfpi}"`,
                `"${u.clientCode}"`,
                `"${u.address}"`,
                `"${u.city}"`
            ].join(','))
        ].join('\n')
```
con:
```ts
        const headers = ['Nome', 'Email', 'CF', 'P.IVA', 'PEC', 'Codice Cliente', 'Indirizzo', 'Città']
        const csvContent = [
            headers.join(','),
            ...selectedUsers.map(u => [
                `"${u.fullName}"`,
                `"${u.email}"`,
                `"${u.codiceFiscale}"`,
                `"${u.partitaIva}"`,
                `"${u.pec}"`,
                `"${u.clientCode}"`,
                `"${u.address}"`,
                `"${u.city}"`
            ].join(','))
        ].join('\n')
```

- [ ] **Step 6: Export HTML/print "Fiscale" (riga 653)**

Sostituire:
```ts
                                            <span class="pill-value mono">${u.cfpi || u.cif || '—'}</span>
```
con:
```ts
                                            <span class="pill-value mono">${u.codiceFiscale || u.partitaIva || u.cif || '—'}</span>
```

- [ ] **Step 7: Input edit inline (righe 1079-1085)**

Sostituire l'unico input legato a `rowDrafts.cfpi`:
```tsx
                                                        <input
                                                            className="h-6 px-2 text-[11px] font-mono border border-indigo-200 dark:border-indigo-500/30 rounded bg-white dark:bg-[#1A1F2A] outline-none"
                                                            value={rowDrafts.cfpi || ''}
                                                            onChange={e => setRowDrafts({ ...rowDrafts, cfpi: e.target.value })}
                                                            placeholder="C.F. o P.IVA"
                                                            onClick={e => e.stopPropagation()}
                                                        />
```
con due input separati:
```tsx
                                                        <input
                                                            className="h-6 px-2 text-[11px] font-mono border border-indigo-200 dark:border-indigo-500/30 rounded bg-white dark:bg-[#1A1F2A] outline-none"
                                                            value={rowDrafts.codiceFiscale || ''}
                                                            onChange={e => setRowDrafts({ ...rowDrafts, codiceFiscale: e.target.value })}
                                                            placeholder="Codice Fiscale"
                                                            onClick={e => e.stopPropagation()}
                                                        />
                                                        <input
                                                            className="h-6 px-2 text-[11px] font-mono border border-indigo-200 dark:border-indigo-500/30 rounded bg-white dark:bg-[#1A1F2A] outline-none"
                                                            value={rowDrafts.partitaIva || ''}
                                                            onChange={e => setRowDrafts({ ...rowDrafts, partitaIva: e.target.value })}
                                                            placeholder="P.IVA"
                                                            onClick={e => e.stopPropagation()}
                                                        />
```

- [ ] **Step 8: Badge display non-edit (righe 1096-1100)**

Sostituire:
```tsx
                                                        {(u.cif || u.cfpi) && (
                                                            <div className="h-6 flex items-center">
                                                                <CodeBadge value={u.cif || u.cfpi} label={u.cif ? 'CIF' : (/^\d{11}$/.test(u.cfpi) ? 'P.IVA' : 'CF')} copyable />
                                                            </div>
                                                        )}
```
con:
```tsx
                                                        {u.codiceFiscale && (
                                                            <div className="h-6 flex items-center">
                                                                <CodeBadge value={u.codiceFiscale} label="CF" copyable />
                                                            </div>
                                                        )}
                                                        {u.partitaIva && (
                                                            <div className="h-6 flex items-center">
                                                                <CodeBadge value={u.partitaIva} label="P.IVA" copyable />
                                                            </div>
                                                        )}
```
E aggiornare la condizione "vuoto" (riga 1106) da `{!u.cif && !u.cfpi && !u.email && (` a:
```tsx
                                                        {!u.codiceFiscale && !u.partitaIva && !u.email && (
```

- [ ] **Step 9: Verifica build** — Run: `npm run build` — Expected: PASS. Cercare eventuali residui con grep `cfpi` nel file: non devono restarne.

- [ ] **Step 10: Commit**

```bash
git add src/app/admin/users/page.tsx
git commit -m "feat(admin): user list edits/exports CF, P.IVA, PEC (drop cfpi)"
```

---

### Task 9: Pagine profilo utente

**Files:**
- Modify: `src/app/profile/page.tsx`
- Modify: `src/app/profile/info/page.tsx`

- [ ] **Step 1: `profile/page.tsx` (riga 46)**

Sostituire:
```ts
        fiscalCode: profile.cfpi || profile.cif || '-',
```
con:
```ts
        fiscalCode: (profile as any).codice_fiscale || (profile as any).partita_iva || profile.cif || '-',
```

- [ ] **Step 2: `profile/info/page.tsx` (riga 25)**

Sostituire:
```ts
        fiscalCode: profile.cfpi || profile.cif || '-',
```
con:
```ts
        fiscalCode: (profile as any).codice_fiscale || (profile as any).partita_iva || profile.cif || '-',
```

> `getUserDashboardData` usa `select('*')`, quindi non si rompe sul drop; questi due edit servono solo a mostrare il dato corretto.

- [ ] **Step 3: Verifica build** — Run: `npm run build` — Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/profile/page.tsx src/app/profile/info/page.tsx
git commit -m "feat(profile): show fiscal code from codice_fiscale/partita_iva"
```

---

### Task 10: Verifica end-to-end

**Files:** nessuno (verifica manuale).

- [ ] **Step 1: Build pulito**

Fermare `next dev` se attivo. Run: `npm run build` — Expected: PASS, nessun riferimento residuo a `profiles.cfpi`. Verificare con grep:
```
grep -rn "cfpi" src/
```
Atteso: solo occorrenze legate a `bills.cfpi` / `user_supplies.cfpi` (payment-actions root select, register fallback, adapters bollette) — nessuna su `profiles`.

- [ ] **Step 2: Import del nuovo file (sample)**

Preparare un CSV di prova con header esatto e 2-3 righe (un'azienda con P.IVA, un privato con CF, una riga con `statoContratto=08`). Caricarlo da `/admin/upload`. Verificare in DB:
```sql
select codice_cliente, name, codice_fiscale, partita_iva, email, pec from public.profiles
where codice_cliente in ('<primi6_cif_1>', '<primi6_cif_2>');
select cif, address, city, stadio, stato_contratto from public.user_supplies
where cif in ('<cif_1>', '<cif_2>');
```
Atteso: profili con CF/P.IVA/PEC/email corretti; forniture con indirizzo/comune/stadio/stato; la riga `08` non crea un profilo nuovo ma aggiorna la fornitura.

- [ ] **Step 3: Re-import con mail cambiata**

Modificare nel CSV la `Mail` di un profilo **shadow** e di uno **attivo** (registrato), ri-caricare. Verificare: shadow → email aggiornata; attivo → email invariata + voce nel report errori ("Email cambiata per utente attivo …").

- [ ] **Step 4: Registrazione**

Da `/register`, con un'azienda (digita la **P.IVA**) e un privato (digita il **CF**) pre-caricati: entrambi superano la verifica e completano la registrazione.

- [ ] **Step 5: Admin + profilo**

In `/admin/users` e dettaglio: CF, P.IVA, PEC mostrati e modificabili; export CSV con le nuove colonne. In `/profile`: il codice fiscale mostrato è corretto.

- [ ] **Step 6: Commit finale (se restano fix di verifica)**

```bash
git add -A
git commit -m "test: verify contratti import refresh, register and admin flows"
```

---

## Note di rollback

- La migration è additiva fino allo Step 6 (drop `cfpi`). In caso di problemi prima del drop, basta non eseguire lo Step 6.
- Dopo il drop, per ripristinare `cfpi`: `alter table public.profiles add column cfpi text;` e `update public.profiles set cfpi = coalesce(partita_iva, codice_fiscale);` poi ripristinare la vecchia `search_users`. I conteggi del Task 0 Step 5 servono a validare.
