# Generatore di presentazioni PDF personalizzate per prospect

**Data:** 2026-08-20
**Stato:** in revisione
**Branch di lavoro:** `demo` (da `master`)

---

## 1. Obiettivo

Produrre, con un solo comando, un **PDF di presentazione commerciale** personalizzato per
ogni potenziale cliente. Il PDF è offline, autoconsistente, e si invia via e-mail: il
prospect lo apre, lo legge, e decide se il prodotto gli interessa.

La personalizzazione non è solo un logo in copertina. Gli **screenshot dentro il PDF
mostrano il portale nei colori e con il nome del prospect**, così che veda il proprio
prodotto e non quello di un altro cliente.

## 2. Non-obiettivi

Esplicitamente fuori scope:

- Demo web live accessibile dal prospect (nessun hosting pubblico, nessun link da mandare).
- Video demo. La pipeline lo abilita in futuro ma non è un deliverable qui.
- Modalità demo dentro l'applicazione di produzione. `master` resta intoccato.
- Uso di dati di produzione, anche anonimizzati o sfocati. I dati sono interamente inventati.
- Generazione di un PDF di bolletta reale per ogni bolletta del dataset.

## 3. Deliverable e flusso d'uso

```
presentations/clients/acme.json      <- 6 righe scritte a mano
presentations/logos/acme.png         <- logo del prospect
npm run presentation -- --client=acme
out/ACQDASH-Acme-Servizi-Idrici.pdf  <- da allegare all'e-mail
```

Tempo per prospect, a pipeline costruita: circa due minuti.

## 4. Architettura

Cinque componenti indipendenti, ognuno usabile da solo.

```
[1] Progetto Supabase demo  +  scripts/seed-demo.ts
              |
              v  dati finti
[3] src/lib/brand.ts  ->  app Next.js in esecuzione locale (:3000)
              |
              v  Playwright
[4] scripts/capture-shots.ts  ->  presentations/shots/<slug>/NN-nome.png
              |
              v
[5] scripts/build-presentation.ts  ->  out/<file>.pdf
                  ^
                  |
      presentations/clients/<slug>.json  +  template HTML

[2] scripts/gen-fake-bills.ts -> PDF finti su R2, referenziati da bills.pdf_url
```

Il componente [1] si esegue una volta sola: i dati finti non dipendono dal prospect.

Il flusso di generazione per prospect tocca [3], **[2]**, [4] e [5], in quest'ordine. Le
bollette finte rientrano nel ciclo per prospect perché sono brandizzate anche loro: se
restassero fisse, il cliente vedrebbe il proprio portale che apre la bolletta di un altro.
Ogni prospect ha quindi il proprio prefisso R2 `demo-<slug>/`.

---

## 5. Componente 1 — Dataset demo

### Dove

Un **secondo progetto Supabase** (piano free), separato dalla produzione. Nessun dato
reale vi transita mai. Le 69 migration in `supabase/migrations/` vengono applicate in
ordine di data, seguite da `NOTIFY pgrst, 'reload schema';`.

### Dimensione

Il dataset serve solo a rendere credibili una ventina di screenshot. Non serve replicare
i volumi di produzione.

| Entità | Quantità | Note |
|---|---|---|
| `profiles` (clienti) | ~30 | nomi, indirizzi, CF/P.IVA italiani inventati |
| `profiles` (shadow) | ~5 | per mostrare il badge "shadow" nella lista admin |
| `user_supplies` | ~45 | alcuni clienti con 2-3 forniture, per il selettore fornitura |
| `bills` | ~300 | distribuite su 3-4 anni, così i grafici hanno forma reale |
| `import_logs` | 4-6 | per popolare lo Storico Caricamenti e i filtri per anno |
| utenti auth | 2 | un admin demo e un cliente demo |

### Qualità dei dati

Perché gli screenshot siano convincenti, il seed deve produrre:

- **Curve di consumo stagionali**, non numeri casuali: consumo idrico più alto in estate,
  così `YearlyConsumoChart` e `ConsumoComparisonChart` mostrano un andamento leggibile.
- **Mix di stati**: la maggioranza `paid`, alcune `unpaid` con scadenza passata, così i
  badge di insoluto e il totale non pagato nella lista admin sono valorizzati.
- **Un cliente "hero"** con storico ricco su più anni e più forniture: è quello che
  compare negli screenshot di dettaglio, sia lato cliente sia in `/admin/users/[id]`.
- **`codice_cliente` univoco** (vincolo `UNIQUE` a DB) e `cif` valorizzato: `bills.ulm` è
  colonna generata come `right(cif, 6)` e si ricalcola da sola.
- Il campo `sector` della configurazione prospect determina i `tipo_servizio` generati
  (`idrico` / `energia` / `misto`), così a un gestore idrico non compaiono bollette luce.

### Configurazione locale

Un file `.env.demo` con URL e chiavi del progetto demo, e uno script `npm run dev:demo`
che avvia Next puntando lì. La configurazione normale di sviluppo resta invariata.

---

## 6. Componente 2 — Bollette PDF finte

### Perché non serve codice applicativo

`src/app/api/bills/[id]/pdf/route.ts` legge `bills.pdf_url`, firma quella chiave R2 e
risponde con un 302. Non ispeziona mai il file. Quindi *quale PDF apre una bolletta* è un
problema di dati, non di codice: basta valorizzare `pdf_url`. **Il branch `demo` non
contiene nessuna modifica al percorso PDF.**

### Come sono fatte

Nessun mockup da seguire: il layout è progettato da zero come una bolletta utility
italiana plausibile (intestazione fornitore, dati cliente, periodo, letture, consumo,
dettaglio importi, totale, scadenza, modalità di pagamento).

Il template è HTML e legge la **stessa configurazione brand** del portale, quindi la
bolletta finta si ricolora con il logo e i colori del prospect insieme al resto. È un
vantaggio rispetto al copiare un layout reale, che resterebbe fisso.

### Quante

Una dozzina di varianti, generate per coprire le combinazioni anno × tipo servizio
presenti nel seed, più una serie dedicata al cliente "hero" i cui importi e date
coincidono esattamente con le righe mostrate negli screenshot. Le restanti bollette
puntano alla variante generica dell'anno corrispondente.

Caricamento su R2 sotto prefisso `demo-<slug>/` tramite `uploadPdfToR2` già esistente in
`src/lib/r2.ts`, un prefisso per prospect. Rimozione = cancellazione di un prefisso.

Essendo brandizzate, **le bollette si rigenerano a ogni prospect**, non una volta sola:
lo script fa parte del ciclo per prospect e aggiorna `bills.pdf_url` puntando al nuovo
prefisso. Costo: qualche decina di secondi, automatizzati.

---

## 7. Componente 3 — Configurazione brand

### Stato attuale

Il branding è cablato in circa 32 occorrenze su 20 file (stringhe "Acquambiente",
"ACQDASH", "Valdelsa") più tre asset in `public/`: `acq_logo.jpg`, `acq_logo2.png`,
`acq_favicon.ico`.

### Intervento

Nuovo modulo `src/lib/brand.ts`:

```ts
export const brand = {
  productName: process.env.NEXT_PUBLIC_BRAND_NAME ?? 'ACQDASH',
  portalName:  process.env.NEXT_PUBLIC_BRAND_PORTAL ?? 'Portale Clienti',
  logo:        process.env.NEXT_PUBLIC_BRAND_LOGO ?? '/acq_logo2.png',
  favicon:     process.env.NEXT_PUBLIC_BRAND_FAVICON ?? '/acq_favicon.ico',
  primary:     process.env.NEXT_PUBLIC_BRAND_PRIMARY ?? '#0B6FA4',
  accent:      process.env.NEXT_PUBLIC_BRAND_ACCENT ?? '#22C55E',
}
```

I colori vengono esposti come CSS custom properties su `<html>` dal root layout, così i
componenti li usano via Tailwind arbitrary values senza toccare la configurazione
Tailwind. Le occorrenze cablate vengono sostituite con riferimenti a `brand`.

`generateMetadata` in `src/app/layout.tsx` usa `brand.portalName` e `brand.favicon`, così
anche il titolo della finestra negli screenshot è quello del prospect.

**Nota:** la modifica è retrocompatibile. Senza variabili d'ambiente impostate, i default
riproducono esattamente il branding attuale. Per ora vive solo su `demo`.

---

## 8. Componente 4 — Cattura screenshot

### Il dettaglio che condiziona tutto

Mobile e desktop **non sono rotte diverse**:

- `MobileShell` è avvolto in `lg:hidden` e vive dentro un'unica rotta, `/profile`, con
  stato di tab interno (`home | bollette | profilo | confronto | supporto`) e uno stato
  separato `selectedBill` per il dettaglio bolletta.
- Le schermate desktop cliente sono rotte distinte: `/profile`, `/bollette`, `/confronto`,
  `/supporto`, ciascuna con il proprio componente in `components/dashboard/desktop/`, resa
  visibile da `hidden lg:block`.

Quindi lo script di cattura:

- **desktop** (1440×900, sopra il breakpoint `lg` = 1024px): naviga per URL;
- **mobile** (390×844): apre `/profile` una volta sola e **clicca la bottom-nav** per
  cambiare schermata, più un click su una bolletta per il dettaglio.

L'area admin è bloccata su mobile da `src/app/admin/layout.tsx`, quindi viene catturata
solo a 1440×900.

### Implementazione

`scripts/capture-shots.ts`, con Playwright come `devDependency` (solo Chromium, mai nel
bundle di produzione). Login reale via form, con le credenziali demo. Attesa esplicita
del rendering dei grafici Recharts prima dello scatto, per evitare PNG con grafici vuoti.
Output numerato in `presentations/shots/<slug>/`.

Lo script è deterministico: rieseguito dopo aver cambiato brand produce lo stesso insieme
di immagini nei nuovi colori.

### Lista scatti proposta (~20, da congelare)

**Cliente — desktop (1440×900)**

1. Login
2. Home / riepilogo (`/profile`)
3. Elenco bollette (`/bollette`)
4. Dettaglio bolletta con PDF aperto
5. Confronto consumi (`/confronto`)
6. Selettore fornitura multipla
7. Profilo (`/profile`, colonna destra)
8. Supporto (`/supporto`)

**Cliente — mobile (390×844)**

9. Home
10. Elenco bollette
11. Dettaglio bolletta
12. Confronto
13. Profilo
14. Supporto

**Admin — desktop (1440×900)**

15. Elenco utenti con ricerca e filtri
16. Dettaglio utente con MiniSpendChart
17. Storico caricamenti con filtri per anno
18. Card DB health
19. Invito utente
20. Interfaccia di caricamento massivo (BulkUploader)

**Esclusa deliberatamente:** `/admin/invoices`. La pagina è un segnaposto che dice
"Sezione in Sviluppo"; fotografarla comunicherebbe a un prospect che il prodotto è
incompleto. Va mostrata solo quando sarà implementata.

---

## 9. Componente 5 — Costruttore della presentazione

### Contenuto

`docs/PRESENTATION.md` contiene già la presentazione commerciale completa in italiano
(290 righe, 12 sezioni: executive summary, problema, soluzione lato cliente e lato
gestore, architettura, sicurezza e GDPR, modello dati, flussi distintivi, vantaggi
competitivi, KPI, roadmap, team, contatti).

Il contenuto viene portato in un template HTML impaginato, non riusato come markdown.

**Struttura del PDF**, decisa per un lettore decisionale e non tecnico:

1. Copertina — logo prospect, "Preparato per <azienda>", data, referente
2. Executive summary
3. Il problema
4. La soluzione lato cliente finale — con gli screenshot mobile e desktop
5. La soluzione lato gestore — con gli screenshot admin
6. Sicurezza e conformità GDPR
7. Vantaggi competitivi e KPI attesi
8. Roadmap
9. Contatti
10. *Allegato tecnico* — architettura, stack, modello dati, flussi

Le sezioni 3 e 5 dell'attuale PRESENTATION.md (architettura, modello dati) confluiscono
nell'allegato: restano nello stesso PDF, ma in fondo, così un direttore generale non le
incontra a pagina tre.

Sezione prezzi assente per default, attivabile per singolo prospect.

### Configurazione per prospect

```json
{
  "slug": "acme",
  "company": "Acme Servizi Idrici SpA",
  "recipient": "Ing. Mario Rossi",
  "logo": "acme.png",
  "primary": "#0B6FA4",
  "accent": "#22C55E",
  "sector": "idrico",
  "date": "2026-09",
  "sections": { "pricing": false, "technicalAnnex": true }
}
```

Validazione con schema esplicito all'avvio dello script: campi obbligatori presenti,
colori in formato esadecimale valido, file logo esistente, `sector` fra i valori ammessi.
Errore chiaro e uscita se qualcosa manca, mai un PDF generato a metà.

### Resa

Chromium headless in stampa PDF, formato A4, con intestazione e piè di pagina (logo
prospect, numero di pagina). Nessuna dipendenza runtime aggiuntiva oltre a Playwright,
già presente per la cattura.

---

## 10. Struttura nel repository

```
presentations/
├── clients/<slug>.json        # configurazione per prospect
├── logos/<slug>.png           # asset forniti dal prospect
├── shots/<slug>/NN-nome.png   # screenshot generati (gitignored)
├── template/
│   ├── presentation.html      # impaginato
│   ├── presentation.css
│   └── bill.html              # template bolletta finta
scripts/
├── seed-demo.ts
├── gen-fake-bills.ts
├── capture-shots.ts
└── build-presentation.ts
out/                           # PDF generati (gitignored)
```

Script npm aggiunti: `dev:demo`, `seed:demo`, `shots`, `presentation`.

---

## 11. Rischi e punti aperti

| Rischio | Mitigazione |
|---|---|
| La lista scatti cresce senza controllo | Congelare i ~20 della sezione 8 prima di scrivere lo script; aggiunte in un secondo giro |
| Grafici Recharts catturati vuoti | Attesa esplicita di un selettore di grafico renderizzato, non un timeout fisso |
| Il seed produce dati poco credibili | Curve stagionali e un cliente "hero" curato a mano, non generazione puramente casuale |
| Piano free Supabase insufficiente | Dataset volutamente piccolo (~300 bollette); ampiamente entro i limiti |
| Divergenza fra `demo` e `master` | Il branch resta un diff sottile: nessuna modifica alla rotta PDF, brand config retrocompatibile |
| Colori del prospect illeggibili nell'UI | Controllo di contrasto sul colore primario in fase di validazione, con avviso |
| Lo scatto 4 mostra un PDF dentro un `<iframe>` (`PdfViewer.tsx`): Chromium headless può non caricare il visualizzatore PDF | Ripiego su cattura in modalità headed per quel singolo scatto; Playwright lo consente senza cambi di script |
| Screenshot di schermate incomplete | Escluso `/admin/invoices` (segnaposto); rivedere la lista se altre sezioni sono stub |

**Punti aperti**, da chiudere con il committente:

1. Chiavi del progetto Supabase demo — bloccante per la Fase 1.
2. Kit del primo prospect: nome, logo, colori, settore.
3. Conferma della lista scatti della sezione 8.
4. Il PDF resta in italiano.

---

## 12. Fasi

| Fase | Contenuto | Dipende da |
|---|---|---|
| 0 | Branch `demo`, `.env.demo`, `dev:demo` | — |
| 1 | Progetto Supabase demo, migration, utenti auth, `seed-demo.ts` | chiavi dal committente |
| 2 | `brand.ts`, sostituzione delle 32 occorrenze, colori come CSS variables | — |
| 3 | `gen-fake-bills.ts`, upload R2, valorizzazione `pdf_url` | Fase 1, Fase 2 |
| 4 | Playwright, `capture-shots.ts`, lista scatti congelata | Fasi 1-3 |
| 5 | Template HTML, schema config, `build-presentation.ts` | Fase 4 |
| 6 | Primo PDF reale, revisione, iterazioni sul design | Fase 5, kit prospect |

Le fasi 1 e 2 sono indipendenti fra loro e sono il grosso del lavoro. La 4 è breve. La 5
dipende da quanto curata si vuole l'impaginazione. La 6 dura quanto servono le revisioni.

A regime, `npm run presentation -- --client=<slug>` incatena le fasi 2, 3, 4 e 5 in un
unico comando; la fase 1 resta fuori perché il dataset non cambia da un prospect all'altro.
