# Presentazioni PDF per prospect

Genera un PDF di presentazione personalizzato per ogni potenziale cliente:
copertina con il suo nome, i suoi colori, e gli screenshot del portale.

Il documento è scritto per chi decide, non per chi implementa: non contiene
riferimenti tecnici, né architettura, né nomi di tecnologie.

```
npm run shots        -- --client=acme    # cattura gli screenshot (automatico)
npm run presentation -- --client=acme    # costruisce il PDF
```

Il risultato finisce in `out/`: il **PDF** da allegare all'e-mail e lo stesso
documento in **HTML**, comodo per un'occhiata veloce nel browser.

---

## Il nome del prodotto

`ACQDASH` è il nome dell'installazione per Acquambiente, non del prodotto.
Finché non è stato scelto un nome commerciale, in copertina compare
**NOME DA DEFINIRE** e la generazione lo segnala a ogni esecuzione.

Quando il nome c'è, si imposta una volta sola in ogni file cliente:

```json
"productName": "Nome scelto"
```

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
| `productName` | no | Finché manca, resta il segnaposto |
| `tagline` | no | Sottotitolo in copertina |
| `sector` | no | `idrico`, `energia` o `misto` |
| `sections.pricing` | no | Aggiunge la pagina con le condizioni economiche |

Se attivi `sections.pricing` diventano obbligatori anche `price_setup`,
`price_recurring`, `price_migration` e `price_support`.

Se manca qualcosa lo script si ferma e dice cosa, prima di generare.

### 3. Gli screenshot

**In automatico**, con il portale avviato in locale:

```
npm run dev                            # in un terminale
npm run shots -- --client=acme         # in un altro
```

Si apre una finestra di Chrome, lo script entra nel portale, gira per le
schermate e salva le nove immagini già della misura giusta. La finestra deve
restare aperta fino alla fine.

Prima serve il file `presentations/.env.capture`, che **git ignora**:

```
CAPTURE_BASE_URL=http://localhost:3000
CAPTURE_CLIENT_CODE=123456
CAPTURE_CLIENT_PASSWORD=...
CAPTURE_ADMIN_CODE=654321
CAPTURE_ADMIN_PASSWORD=...
```

Il codice è quello a sei cifre della schermata di accesso. Usa **utenti di
prova**, non il tuo account reale.

Il captcha non è automatizzabile. Di solito si risolve da solo perché Chrome
è una finestra vera; se non succede, lo script te lo dice e aspetta che
completi l'accesso a mano, poi riprende da solo.

### L'elenco delle nove immagini

| File | Dove | Misura |
|---|---|---|
| `01-home.png` | `/profile` | 1440 × 900 |
| `02-bollette.png` | `/bollette` | 1440 × 900 |
| `03-confronto.png` | `/confronto` | 1440 × 900 |
| `04-mobile-home.png` | `/profile`, schermata iniziale | 390 × 844 |
| `05-mobile-bollette.png` | `/profile`, sezione Bollette | 390 × 844 |
| `06-mobile-dettaglio.png` | come sopra, aprendo una bolletta | 390 × 844 |
| `07-admin-utenti.png` | `/admin/users` | 1440 × 900 |
| `08-admin-dettaglio.png` | `/admin/users/<id>` | 1440 × 900 |
| `09-admin-upload.png` | `/admin/upload` | 1440 × 900 |

Le tre schermate del telefono stanno tutte dentro `/profile`: l'interfaccia
mobile è una pagina sola, si cambia sezione toccando i pulsanti. L'area
amministrativa è bloccata su telefono, quindi si fotografa solo a 1440 × 900.

Gli screenshot mancanti diventano un riquadro tratteggiato "screenshot
mancante": puoi generare il PDF anche a metà lavoro e vedere come viene.

### A mano, se preferisci

1. **F12**, poi **Ctrl+Shift+M** per la modalità dispositivo
2. Scegli **Responsive** e scrivi le due misure, es. `1440` × `900`
3. Vai sulla pagina e aspetta che i grafici finiscano di disegnarsi
4. **Ctrl+Shift+P**, scrivi `capture screenshot`, Invio
5. Rinomina il PNG e mettilo in `presentations/shots/<slug>/`

Usa **"Capture screenshot"**, non "Capture full size screenshot": la prima
riprende il riquadro impostato, la seconda tutta la pagina scorrevole e viene
un'immagine lunghissima che nel PDF si vedrebbe minuscola.

---

## I dati dei clienti veri

Le schermate dell'area amministrativa mostrano l'anagrafica reale, e quei dati
non possono finire in un documento mandato a un'altra azienda.

`npm run shots` applica da solo [`scrub-console.js`](scrub-console.js) prima di
ogni scatto: nomi, codici fiscali, e-mail, telefoni e indirizzi vengono
sostituiti con dati finti, solo a schermo e solo per il tempo dello scatto.

Se fai gli screenshot a mano, apri quel file, copia tutto e incollalo nella
console del browser (F12 → Console) prima di scattare. Con **F5** torna tutto
come prima.

**Non è una garanzia.** È una sostituzione a tentativi: non riconosce una
ragione sociale insolita, e non tocca i nomi dei comuni. Sono nove immagini,
**guardale una per una prima di usarle**.

Per le sei schermate lato cliente c'è una via più pulita: registra un utente
di prova con dati inventati e fotografa dal suo accesso. Così sullo schermo
non c'è proprio nulla di reale.

---

## Modificare il documento

| Cosa | Dove |
|---|---|
| Testi, ordine delle pagine, quali screenshot dove | `template/presentation.html` |
| Colori, caratteri, spaziature, impaginazione | `template/style.css` |
| Elenco degli screenshot attesi | `../scripts/presentation/shots.mjs` |

Le pagine sono riquadri A4 a dimensione fissa: il contenuto in eccesso viene
tagliato senza lasciare traccia. Per questo la generazione controlla da sola
che nessuna pagina trabocchi, e avvisa dicendo quale e di quanto:

```
2 pagine traboccano e verranno tagliate:
  pagina 5 (Portale cliente): 31px in eccesso
```

Se succede, togli una riga, accorcia una didascalia, o sposta il contenuto
sulla pagina dopo.

I numeri di pagina sono automatici: se attivi o disattivi una sezione, la
numerazione si ricalcola.

---

## Se qualcosa non va

**"Chrome o Edge non trovati"** — il PDF viene stampato dal Chrome installato
sulla macchina. Se sta in un percorso insolito:

```
set CHROME_PATH=C:\percorso\completo\chrome.exe
```

**"Il portale non risponde"** — manca `npm run dev` in un altro terminale.

**L'accesso non riesce entro cinque minuti** — controlla il codice a sei cifre
e la password in `.env.capture`. Il codice cliente sono cifre, non lettere.

**Una schermata non viene catturata** — lo script lo dice e prosegue con le
altre. Quella mancante resta segnaposto: rifalla a mano o rilancia il comando.

**Il PDF esce con pagine bianche** — quasi sempre è un'immagine corrotta o in
un formato non supportato. Sono ammessi PNG, JPG, GIF, WebP e SVG.

**I colori non cambiano** — `primary` e `accent` vanno scritti per esteso a sei
cifre (`#0B6FA4`, non `#0B7`).

**Il testo bianco della copertina si legge male** — lo script avvisa da solo
quando il colore scelto è troppo chiaro: serve una tinta più scura.
