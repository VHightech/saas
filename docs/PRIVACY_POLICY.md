# Informativa sulla Privacy — ACQDASH

**Ultimo aggiornamento:** 6 maggio 2026
**Versione documento:** 1.0

La presente informativa è resa ai sensi degli articoli 13 e 14 del **Regolamento (UE) 2016/679** ("GDPR") e del **D.Lgs. 196/2003** come modificato dal D.Lgs. 101/2018 ("Codice Privacy").

---

## 1. Titolare del trattamento

**Grafiche Valdelsa S.r.l.**
Referente: Matteo Volterrani
E-mail: matteo.volterrani@valdelsahightech.com

Per esercitare i propri diritti o per qualsiasi richiesta in materia di protezione dei dati personali, l'interessato può rivolgersi al Titolare ai recapiti sopra indicati.

---

## 2. Tipologie di dati trattati

Tramite la piattaforma **ACQDASH** vengono trattate le seguenti categorie di dati personali:

| Categoria | Dati specifici | Fonte |
|-----------|----------------|-------|
| **Dati identificativi** | Nome, cognome, username, ruolo applicativo | Registrazione / pre-caricamento amministrativo |
| **Dati di contatto** | Indirizzo e-mail, numero di telefono, indirizzo postale, città | Registrazione / pre-caricamento amministrativo |
| **Identificativi fiscali** | Codice Fiscale o Partita IVA (CFPI), CIF (Codice Identificativo Fornitura), Codice Cliente | Pre-caricamento da archivi del gestore servizi |
| **Dati di fornitura e consumo** | Tipo servizio (acqua/energia), letture, importi, consumi, data emissione e scadenza | Bollette emesse dal gestore |
| **Documenti** | Copie PDF delle bollette | Caricamento amministrativo |
| **Dati di pagamento** | Importo, metodo (PagoPA, bonifico, contanti, carta), stato, codice avviso PagoPA, token transazione, data pagamento | Generati dall'utente in piattaforma |
| **Dati di accesso e log tecnici** | Indirizzo IP, user-agent, timestamp di login, eventi di sicurezza | Generati automaticamente |
| **Dati di stato contrattuale** | Stadio lavorazione e stato giuridico del contratto | Gestione amministrativa |

**Categorie particolari (art. 9 GDPR):** non vengono trattati dati appartenenti a categorie particolari (salute, opinioni, biometrici, ecc.).

---

## 3. Finalità e basi giuridiche

| Finalità | Base giuridica (art. 6 GDPR) |
|----------|------------------------------|
| Erogazione del servizio (consultazione bollette, gestione anagrafica, pagamenti) | art. 6 §1 lett. **b** — esecuzione del contratto |
| Adempimenti fiscali e contabili (conservazione fatture/bollette) | art. 6 §1 lett. **c** — obbligo legale (DPR 600/1973, DPR 633/1972) |
| Integrazione con il nodo PagoPA per pagamenti elettronici verso la P.A. | art. 6 §1 lett. **c** + lett. **e** — obbligo legale e interesse pubblico |
| Sicurezza informatica, prevenzione frodi, audit log | art. 6 §1 lett. **f** — legittimo interesse del Titolare |
| Comunicazioni di servizio (recupero password, invito utenti, notifiche operative) | art. 6 §1 lett. **b** |
| Risposta a richieste di esercizio di diritti dell'interessato | art. 6 §1 lett. **c** |

Il trattamento **non comprende** finalità di marketing diretto, profilazione commerciale o cessione a terzi per scopi promozionali.

---

## 4. Modalità di trattamento e misure di sicurezza

I dati sono trattati con strumenti elettronici e con misure tecniche e organizzative adeguate al rischio, tra cui:

- **Cifratura in transito** TLS 1.2+ su tutte le comunicazioni HTTPS.
- **Cifratura at-rest** sui database Supabase e sullo storage Cloudflare R2.
- **Row-Level Security (RLS)** Postgres su tutte le tabelle: ogni utente accede esclusivamente ai propri dati; gli accessi amministrativi sono limitati ai soli ruoli `admin` / `super_admin`.
- **Anti-bot** Cloudflare Turnstile su login e registrazione.
- **URL firmati a TTL breve** (5 minuti) per il download dei documenti PDF.
- **Content Security Policy** stretta, HSTS, frame-ancestors `none`, isolamento clickjacking.
- **Principio del minimo privilegio**: la chiave service-role è impiegata solo nelle operazioni server gateway dietro autorizzazione esplicita.
- **Audit log** delle operazioni amministrative.
- **Separazione delle responsabilità**: i pagamenti sono in tabella dedicata con `REVOKE UPDATE` per gli utenti finali.
- **Backup automatici** giornalieri sull'infrastruttura Supabase.

---

## 5. Soggetti autorizzati al trattamento

I dati sono accessibili a:

- Personale autorizzato di Grafiche Valdelsa S.r.l. (amministratori di sistema, operatori back-office).
- Personale del gestore del servizio idrico/energetico in qualità di **Titolare autonomo** o **Contitolare**, nei limiti contrattualmente definiti.

Tutti i soggetti autorizzati operano sotto vincolo di riservatezza e ricevono istruzioni specifiche sul trattamento.

---

## 6. Responsabili esterni del trattamento (sub-processor)

Per fornire il servizio, ACQDASH si avvale dei seguenti fornitori, designati Responsabili del trattamento ex art. 28 GDPR mediante contratto (DPA):

| Fornitore | Servizio | Sede legale | Regione di trattamento dati ACQDASH |
|-----------|----------|-------------|-------------------------------------|
| **Supabase Inc.** | Database PostgreSQL gestito + servizio Auth | USA | **Europa (EU)** — istanza creata in regione UE |
| **Cloudflare, Inc.** | Storage oggetti R2 + protezione anti-bot Turnstile + CDN | USA | Bucket configurato con servizio in **EU**; URL serviti via signed URL |
| **Resend, Inc.** | Invio e-mail transazionali (recupero password, inviti, notifiche) | USA | Trasmessi solo indirizzo destinatario e contenuto template |
| **PagoPA S.p.A.** | Nodo nazionale dei pagamenti verso la P.A. | Italia | Trasmessi: importo, codice avviso, identificativo creditore |

**Trasferimenti extra-UE**: per Supabase, Cloudflare e Resend (società con casa madre USA) i trattamenti sui dati ACQDASH avvengono su infrastrutture localizzate in UE; eventuali trasferimenti residuali verso paesi terzi avvengono sulla base di:

- **Standard Contractual Clauses (SCC)** approvate dalla Commissione Europea;
- **Decisione di adeguatezza UE-USA Data Privacy Framework** (Decisione di esecuzione (UE) 2023/1795), ove applicabile;
- misure supplementari tecniche (cifratura) e organizzative documentate nei DPA con i fornitori.

L'elenco aggiornato dei sub-processor è disponibile su richiesta al Titolare.

---

## 7. Periodo di conservazione

| Categoria dati | Periodo di conservazione |
|----------------|--------------------------|
| Dati anagrafici e di fornitura | Per tutta la durata del rapporto contrattuale |
| Bollette e dati fiscali | **10 anni** dall'emissione (art. 2220 c.c., DPR 600/1973) |
| Dati di pagamento | 10 anni (obblighi fiscali) |
| Log tecnici di accesso e sicurezza | **12 mesi** dalla generazione |
| Account inattivi (nessun accesso) | Anonimizzazione dopo **24 mesi** di inattività, salvo obblighi legali |
| Profili shadow non rivendicati | **24 mesi** dalla creazione, poi cancellazione |
| E-mail transazionali | 30 giorni (lato Resend) per audit recapito |

Al termine dei periodi indicati, i dati sono cancellati o resi anonimi in modo irreversibile.

---

## 8. Diritti dell'interessato

Ai sensi degli articoli 15-22 GDPR, l'interessato ha diritto di:

- **Accedere** ai propri dati personali (art. 15);
- chiedere la **rettifica** dei dati inesatti o incompleti (art. 16);
- chiedere la **cancellazione** ("diritto all'oblio") nei limiti consentiti dagli obblighi legali (art. 17);
- chiedere la **limitazione** del trattamento (art. 18);
- ricevere i propri dati in formato strutturato e leggibile da dispositivo automatico — **portabilità** (art. 20);
- **opporsi** al trattamento basato su legittimo interesse (art. 21);
- non essere sottoposto a decisioni automatizzate, inclusa profilazione, che producano effetti giuridici (art. 22) — la piattaforma **non effettua** decisioni completamente automatizzate;
- **revocare il consenso** in qualsiasi momento, ove il trattamento sia basato su consenso (art. 7);
- proporre **reclamo** all'Autorità di controllo: Garante per la Protezione dei Dati Personali, www.gpdp.it (art. 77).

Le richieste possono essere inviate a **matteo.volterrani@valdelsahightech.com** e ricevono risposta entro **30 giorni** (prorogabili di ulteriori 60 giorni in casi complessi, con comunicazione motivata).

---

## 9. Conferimento dei dati

Il conferimento dei dati anagrafici, identificativi fiscali e dei codici di fornitura è **necessario** per l'esecuzione del servizio. Il rifiuto comporta l'impossibilità di accedere alla piattaforma e di consultare/pagare le bollette.

---

## 10. Cookie e tecnologie simili

ACQDASH utilizza esclusivamente:

- **Cookie tecnici di sessione** (Supabase Auth) per il mantenimento dell'autenticazione — esenti da consenso ai sensi dell'art. 122 Codice Privacy.
- **Cookie del provider Cloudflare Turnstile** per la verifica anti-bot, classificati come tecnici (sicurezza).

**Non** vengono utilizzati cookie di profilazione, marketing o analitici di terze parti.

---

## 11. Decisioni automatizzate e profilazione

ACQDASH **non effettua** trattamenti automatizzati che producano effetti giuridici nei confronti dell'interessato (es. valutazioni creditizie automatiche, profilazione comportamentale).

---

## 12. Modifiche all'informativa

La presente informativa può essere aggiornata in caso di evoluzione normativa o di modifiche tecniche al servizio. La versione vigente è sempre pubblicata sulla piattaforma con indicazione della data di ultimo aggiornamento. In caso di modifiche sostanziali, gli utenti registrati saranno informati via e-mail.

---

## 13. Contatti

Per qualsiasi richiesta relativa al trattamento dei dati personali:

**Grafiche Valdelsa S.r.l.**
E-mail: matteo.volterrani@valdelsahightech.com

Autorità di controllo:
**Garante per la Protezione dei Dati Personali**
Piazza Venezia, 11 — 00187 Roma
www.gpdp.it
