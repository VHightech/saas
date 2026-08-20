# Presentazioni PDF per prospect

Genera un PDF di presentazione personalizzato per ogni potenziale cliente:
copertina con il suo nome, i suoi colori, e gli screenshot del portale.

```
npm run presentation -- --client=esempio
```

Il risultato finisce in `out/`. Ci sono due file: il **PDF** da allegare
all'e-mail e lo stesso documento in **HTML**, comodo per un'occhiata veloce
nel browser senza rigenerare.

---

## Cosa serve per un nuovo prospect

### 1. Il logo

Metti il file in `presentations/logos/`, per esempio `acme.png`.
PNG con sfondo trasparente è l'ideale: la copertina è scura.

### 2. La configurazione

Copia `presentations/clients/esempio.json` in `presentations/clients/acme.json`
e cambia quello che serve:

```json
{
  "company": "Acme Servizi Idrici S.p.A.",
  "recipient": "Ing. Mario Rossi",
  "date": "Settembre 2026",
  "logo": "acme.png",
  "primary": "#0B6FA4",
  "accent": "#22C55E",
  "sector": "idrico"
}
```

| Campo | Obbligatorio | Note |
|---|---|---|
| `company` | sì | Ragione sociale, compare in copertina |
| `date` | sì | Testo libero, es. "Settembre 2026" |
| `primary` | sì | Colore dominante: copertina, titoli, tabelle |
| `accent` | sì | Colore di dettaglio: filetti, elenchi puntati |
| `recipient` | no | Se presente, "All'attenzione di …" in copertina |
| `logo` | no | Nome del file dentro `presentations/logos/` |
| `sector` | no | `idrico`, `energia` o `misto` |
| `productName` | no | Se il prodotto va presentato con un altro nome |
| `sections.pricing` | no | Aggiunge la pagina con le condizioni economiche |
| `sections.technicalAnnex` | no | Allegato tecnico in fondo, attivo per default |

Se attivi `sections.pricing` diventano obbligatori anche `price_setup`,
`price_recurring`, `price_migration` e `price_support`.

Se manca qualcosa lo script si ferma e dice cosa, prima di generare.

### 3. Gli screenshot

Vanno in `presentations/shots/acme/` con **esattamente** questi nomi.
Quelli mancanti diventano un riquadro tratteggiato "screenshot mancante",
quindi puoi generare il PDF anche a metà lavoro e vedere come viene.

| File | Dove | Dimensione finestra |
|---|---|---|
| `01-home.png` | `/profile` | 1440 × 900 |
| `02-bollette.png` | `/bollette` | 1440 × 900 |
| `03-confronto.png` | `/confronto` | 1440 × 900 |
| `04-mobile-home.png` | `/profile`, scheda Home | 390 × 844 |
| `05-mobile-bollette.png` | `/profile`, scheda Bollette | 390 × 844 |
| `06-mobile-dettaglio.png` | come sopra, poi tocca una bolletta | 390 × 844 |
| `07-admin-utenti.png` | `/admin/users` | 1440 × 900 |
| `08-admin-dettaglio.png` | `/admin/users/<id>` | 1440 × 900 |
| `09-admin-upload.png` | `/admin/upload` | 1440 × 900 |

Le tre schermate mobile stanno tutte dentro `/profile`: l'interfaccia per
telefono è una sola pagina con la barra di navigazione in basso. Non esistono
indirizzi separati, si cambia scheda toccando le icone.

L'area amministrativa è bloccata su telefono: le sue schermate si fotografano
solo a 1440 × 900.

---

## Come fare uno screenshot della misura giusta

Non serve ridimensionare la finestra: gli strumenti per sviluppatori di Chrome
scattano alla dimensione che imposti tu, qualunque sia la finestra reale.

1. Avvia l'applicazione con `npm run dev` e apri `http://localhost:3000`
2. Premi **F12**, poi **Ctrl+Shift+M** per attivare la modalità dispositivo
3. In alto scegli **Responsive** e scrivi le due misure, per esempio `1440` × `900`
4. Vai sulla pagina da fotografare e aspetta che i grafici finiscano di disegnarsi
5. Premi **Ctrl+Shift+P**, scrivi `capture screenshot`, premi Invio
6. Il PNG finisce nei Download: rinominalo e spostalo in `presentations/shots/<slug>/`

Usa **"Capture screenshot"**, non "Capture full size screenshot": la prima
riprende esattamente il riquadro impostato, la seconda tutta la pagina scorrevole
e viene un'immagine lunghissima che nel PDF si vedrebbe minuscola.

---

## I dati dei clienti veri

Gli screenshot dell'area amministrativa mostrano l'anagrafica reale. Quei dati
non possono finire in un documento che mandi a un'altra azienda.

Due modi, dal più pulito al più rapido.

**Un utente di prova.** Registra un cliente finto e fotografa il portale
dal suo accesso. Risolve le schermate 01-06 in modo definitivo, perché non
c'è nessun dato vero sullo schermo.

**Lo script di sostituzione.** Per le schermate 07-09, che mostrano per forza
l'elenco clienti, apri `presentations/scrub-console.js`, copia tutto,
incollalo nella console del browser (F12 → Console) e premi Invio: nomi,
codici fiscali, e-mail, telefoni e indirizzi vengono sostituiti con dati finti
solo a schermo. Poi scatta. Con **F5** torna tutto come prima.

Lo script va rieseguito a ogni cambio pagina, e non è una garanzia:
**guarda ogni immagine prima di usarla**. Sono nove file, si controllano in un
minuto, e nessun automatismo vale quel minuto.

---

## Modificare il documento

| Cosa | Dove |
|---|---|
| Testi, ordine delle pagine, quali screenshot dove | `template/presentation.html` |
| Colori, caratteri, spaziature, impaginazione | `template/style.css` |
| Elenco degli screenshot attesi | `../scripts/presentation/shots.mjs` |

Le pagine sono riquadri A4 a dimensione fissa con il contenuto in eccesso
tagliato. Per questo la generazione controlla da sola che nessuna pagina
trabocchi e avvisa indicando quale e di quanto:

```
2 pagine traboccano e verranno tagliate:
  pagina 5 (Portale cliente): 31px in eccesso
```

Se succede, togli una riga di testo, accorcia una didascalia, oppure sposta il
contenuto sulla pagina dopo.

I numeri di pagina sono automatici: se disattivi una sezione la numerazione si
ricalcola da sola.

---

## Se qualcosa non va

**"Chrome o Edge non trovati"** — il PDF viene stampato dal Chrome installato
sulla macchina. Se sta in un percorso insolito:

```
set CHROME_PATH=C:\percorso\completo\chrome.exe
npm run presentation -- --client=acme
```

**Il PDF esce con le pagine bianche** — quasi sempre è un'immagine corrotta o
in un formato non supportato. Sono ammessi PNG, JPG, GIF, WebP e SVG.

**I colori non cambiano** — controlla che `primary` e `accent` siano scritti
per esteso a sei cifre (`#0B6FA4`, non `#0B7`).

**Il testo bianco della copertina si legge male** — lo script avvisa da solo
quando il colore scelto è troppo chiaro. Serve una tinta più scura.
