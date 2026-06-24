# Import contratti — CF/P.IVA separati, PEC, refresh dei dati

- **Data:** 2026-06-09
- **Autore:** Matteo Volterrani + Claude
- **Stato:** Design approvato (in attesa di review dello spec)
- **Area:** Import master-data clienti (`/api/upload-users`), schema `profiles`, flow di auth/pagamenti, UI admin

## 1. Contesto e obiettivo

Il file "contratti" che Acquambiente fornisce per popolare l'anagrafica clienti ha un **nuovo formato** con più campi e nomi colonna diversi:

```
CIF;RagioneSociale;CodiceFiscale;PartitaIva;stadio;statoContratto;Mail;PEC;indirizzo;comune
```

**Obiettivo primario:** questo file serve a **ri-allineare/aggiornare** i dati già a sistema quando un'utenza cambia (mail, indirizzo, ecc.) — è un import di *refresh*, non solo di primo caricamento.

Due esigenze strutturali emerse:
1. **CF e P.IVA devono essere campi separati** (oggi sono fusi in un unico `cfpi`).
2. La **PEC** va salvata e mostrata (oggi non esiste a sistema).

### Stato attuale (sintesi)

- `profiles` (per cliente): `name`, `email`, `cfpi` (CF **o** P.IVA), `codice_cliente` UNIQUE, `is_shadow`, `role`, …
- `user_supplies` (per fornitura/CIF): `cif` UNIQUE, `address`, `city`, `stadio`, `stato_contratto`, `cfpi` (tecnico).
- `bills`: ha anch'essa `cfpi` (tecnico, da import bollette).
- L'importer attuale ([upload-users/route.ts](../../src/app/api/upload-users/route.ts)) cerca **vecchi** nomi colonna (`Ragione Sociale`, `Codice Fiscale`, `Partita Iva`, `email`, `indirizzo utenza`, `STATO CONTRATTO`) → **con il nuovo header non matcherebbe nulla** (nome/CF/P.IVA/mail/indirizzo/stato risulterebbero vuoti). PEC non è gestita.
- L'update è volutamente conservativo: `name`/`cfpi` riempiti solo se vuoti; email di utenti **attivi** mai sovrascritta (è la credenziale di login).

## 2. Decisioni prese (con motivazione)

| # | Decisione | Motivazione |
|---|---|---|
| D1 | L'import è di **refresh**: i campi anagrafici non-credenziali seguono la regola **"il file vince"** | Tenere il DB allineato all'ultima versione del file |
| D2 | Email di utente **già registrato** che risulta diversa: **non si sovrascrive**, si **segnala** nel report | L'email è la credenziale di login (legata a `auth.users`); un errore nel CSV non deve bloccare l'accesso |
| D3 | **CF e P.IVA in due colonne separate** su `profiles` (`codice_fiscale`, `partita_iva`) | Richiesta esplicita; aziende hanno P.IVA + eventualmente CF distinto |
| D4 | **PEC** salvata (`profiles.pec`) e **mostrata** in admin | Serve per contattare i clienti |
| D5 | Approccio **②**: si **elimina `cfpi`** da `profiles` (non si tiene come campo specchio) | Modello pulito, scelta dell'utente |
| D6 | `cfpi` viene rimosso **solo da `profiles`**; resta su `bills` e `user_supplies` come chiave tecnica di matching | Eliminarlo da lì toccherebbe l'import bollette + `mass_link` → blast radius molto più ampio, fuori scope |
| D7 | **Nessun fallback** sui vecchi nomi colonna: il parser legge solo l'header nuovo | Il file avrà sempre questo formato; i fallback aggiungono solo complessità inutile |

## 3. Schema (nuova migration)

`profiles`:
- **DROP** colonna `cfpi`.
- **ADD** `codice_fiscale text`, `partita_iva text`, `pec text`.
- **Backfill** (prima del drop, idempotente e guardato): per ogni profilo con `cfpi` valorizzato →
  - se `cfpi` è 11 cifre (`^\d{11}$`) → `partita_iva = cfpi`
  - altrimenti → `codice_fiscale = cfpi`
- Indici opzionali su `codice_fiscale` e `partita_iva` (lookup registrazione). Da valutare in fase di piano.
- Dopo la DDL: `NOTIFY pgrst, 'reload schema';`.

`bills`, `user_supplies`: **invariate** (conservano `cfpi`).

## 4. Parser & mappatura import ([upload-users/route.ts](../../src/app/api/upload-users/route.ts))

Il file avrà **sempre** questo formato: **nessun fallback** sui vecchi nomi colonna (decisione D7). Le chiavi vengono lette esattamente come da header concordato (trim degli spazi). Mapping diretto:

| Colonna file | Target |
|---|---|
| `CIF` | `user_supplies.cif` (+ `codice_cliente` = primi 6 del CIF) |
| `RagioneSociale` | `profiles.name` |
| `CodiceFiscale` | `profiles.codice_fiscale` |
| `PartitaIva` | `profiles.partita_iva` |
| `Mail` | `profiles.email` |
| `PEC` | `profiles.pec` |
| `indirizzo` | `user_supplies.address` |
| `comune` | `user_supplies.city` |
| `stadio` | `user_supplies.stadio` |
| `statoContratto` | `user_supplies.stato_contratto` |

> Il parser attuale pieno di fallback (`row['cif'] || row['CIF'] || …`) va **semplificato**: si leggono solo le colonne dell'header concordato.

- `codice_cliente` non è più nell'header → si deriva sempre dai primi 6 del CIF (comportamento già presente come fallback).
- Payload profilo: `{ codice_cliente, name, codice_fiscale, partita_iva, email, pec, is_shadow: true, role: 'user' }`.
- Mantenere: skip righe senza CIF / CIF troppo corto; gestione `statoContratto = '08'` (annullato → non crea profilo nuovo, ma fa upsert della fornitura).

## 5. Semantica di aggiornamento (refresh)

**Profilo esistente** (match su `codice_cliente`):
- `name`, `codice_fiscale`, `partita_iva`, `pec`: **sovrascritti** quando il file porta un valore **non vuoto** e **diverso**. Un campo **vuoto** nel file **non** cancella il dato a sistema.
- `email`:
  - profilo **shadow** o email a sistema vuota → aggiorna con quella del file.
  - profilo **attivo** con email diversa → **non aggiorna**; aggiunge una **segnalazione** al report (`errors`/summary).
- `codice_cliente`: settato se mancante (come oggi).

**Forniture** (upsert su `cif`): `address`, `city`, `stadio`, `stato_contratto` → "il file vince" (già così via upsert `ignoreDuplicates:false`).

`mass_link_orphaned_data()` resta invariata e viene richiamata a fine import.

## 6. Rewiring per la rimozione di `profiles.cfpi`

| File | Cambiamento |
|---|---|
| [register/actions.ts](../../src/app/register/actions.ts) | Verifica identità: confronta il `fiscalCode` digitato con `codice_fiscale` **OR** `partita_iva` (poi fallback `user_supplies.cfpi` / `bills.cfpi`). Creazione profilo: il valore digitato va in `partita_iva` se `^\d{11}$`, altrimenti `codice_fiscale`. **Mantiene il fix C-1.** |
| [payment-actions.ts](../../src/actions/payment-actions.ts) | `debtorFiscalCode = profile.codice_fiscale ?? profile.partita_iva ?? bill.cfpi` |
| RPC `search_users` (nuova migration funzione) | Restituisce `codice_fiscale`, `partita_iva`, `pec` invece di `cfpi` |
| [admin/users/page.tsx](../../src/app/admin/users/page.tsx) | Lista + modifica inline + export CSV: campo unico `cfpi` → due campi CF e P.IVA; rimuovere euristica "11 cifre = P.IVA" |
| [admin/users/[id]/page.tsx](../../src/app/admin/users/[id]/page.tsx) | Dettaglio + form modifica: CF, P.IVA, PEC separati; mostra PEC vicino a email |
| [admin/users/actions.ts](../../src/app/admin/users/actions.ts) | `updateUser` accetta `codice_fiscale`, `partita_iva`, `pec` |
| [profile/page.tsx](../../src/app/profile/page.tsx), [profile/info/page.tsx](../../src/app/profile/info/page.tsx) | `fiscalCode` = `codice_fiscale ?? partita_iva ?? cif` |
| [api/me/export/route.ts](../../src/app/api/me/export/route.ts) | Export include `codice_fiscale`, `partita_iva`, `pec` |
| [lib/admin/adapters/types.ts](../../src/lib/admin/adapters/types.ts) | Verificare l'uso di `cfpi` (riguarda l'import bollette: `bills.cfpi` resta, quindi probabilmente invariato) |

## 7. UI admin (dettaglio utente)

- Mostrare: **Ragione Sociale** (= `name`), **CF** (`codice_fiscale`), **P.IVA** (`partita_iva`), **PEC** (`pec`, accanto a email), oltre a CIF/stadio/stato contratto per ciascuna fornitura.
- I `CodeBadge` per CF/P.IVA usano etichette esplicite (non più euristica sul formato).

## 8. Error handling

- Report import (in `import_logs.errors` + risposta JSON): conteggi (profili, forniture, skip) + lista **segnalazioni**:
  - email di utenti attivi non aggiornata (con codice_cliente, senza loggare la mail in chiaro lato server),
  - CIF mancante / troppo corto.
- Migration backfill: idempotente, guardata da `IF EXISTS` / controllo colonna, nessuna perdita dati.
- Mantenere il throttling del progresso su `import_logs` per la GlobalProgressBar.

## 9. Vincoli di sicurezza (da rispettare in implementazione)

- Consultare la skill **acqdash-user-area-security** prima di toccare `register`, `payment-actions`, `admin/*`.
- Non loggare CF/P.IVA/email/codice_cliente in chiaro lato server.
- Non indebolire il fix C-1 (verifica identità in registrazione).
- Le Server Action admin restano dietro `requireAdmin()`.

## 10. Test / criteri di accettazione

1. Import file **nuovo formato** → i profili ottengono `name`/`codice_fiscale`/`partita_iva`/`email`/`pec`; le forniture ottengono `address`/`city`/`stadio`/`stato_contratto`.
2. **Re-import** con mail cambiata: profilo **shadow** → aggiornata; profilo **attivo** → invariata + segnalazione nel report.
3. **Refresh** anagrafica: cambiando RagioneSociale/CF/P.IVA nel file, il profilo esistente viene aggiornato (campo vuoto non cancella).
4. **Registrazione**: azienda che digita la **P.IVA** e privato che digita il **CF** → entrambi superano la verifica identità.
5. **PagoPA**: `debtorFiscalCode` risolve correttamente dai nuovi campi.
6. **Backfill** migration idempotente: ri-eseguibile senza danni; i `cfpi` esistenti finiscono nella colonna giusta per formato.
7. Build verde + nessuna regressione nelle flow di login/forgot-password.

## 11. Fuori scope

- Rimozione di `cfpi` da `bills` / `user_supplies` e riscrittura dell'import bollette / `mass_link` (decisione D6).
- Uso dei nuovi campi nell'area utente oltre alla semplice visualizzazione del profilo.
- Modifica dell'email di login in `auth.users` da CSV (decisione D2).
