# Termini e Condizioni d'Uso — ACQDASH

**Ultimo aggiornamento:** 6 maggio 2026
**Versione:** 1.0

I presenti Termini e Condizioni ("**Termini**") regolano l'utilizzo della piattaforma **ACQDASH** ("**Piattaforma**" o "**Servizio**"), erogata da **Grafiche Valdelsa S.r.l.** ("**Fornitore**", "noi"). L'accesso e l'uso della Piattaforma comportano l'accettazione integrale dei presenti Termini.

---

## 1. Definizioni

- **Utente**: persona fisica o giuridica titolare di un contratto di fornitura idrica/energetica, abilitata ad accedere alla Piattaforma con credenziali personali.
- **Fornitore / Titolare**: Grafiche Valdelsa S.r.l.
- **Amministratore**: personale autorizzato dal Fornitore o dal gestore del servizio idrico/energetico con privilegi `admin` o `super_admin`.
- **Bolletta**: documento di fatturazione emesso dal gestore del servizio, archiviato in piattaforma in formato PDF.
- **Codice Cliente / CIF / CFPI**: identificativi univoci utilizzati per associare l'utente al rapporto di fornitura.
- **Profilo Shadow**: profilo pre-caricato dal personale amministrativo in attesa di "claim" (rivendicazione) tramite registrazione dell'utente reale.

---

## 2. Oggetto del Servizio

ACQDASH consente all'Utente di:

a) consultare l'anagrafica del proprio rapporto di fornitura;
b) visualizzare e scaricare le proprie bollette in formato PDF;
c) avviare pagamenti elettronici tramite **PagoPA**;
d) modificare i dati di contatto consentiti (nome, indirizzo, città);
e) ricevere notifiche operative via e-mail.

Il Fornitore si riserva di integrare nuove funzionalità senza preavviso.

---

## 3. Registrazione e accesso

3.1 L'accesso al Servizio richiede registrazione tramite **Codice Cliente** + **Codice Fiscale o Partita IVA** (CFPI/CIF) corrispondenti a un rapporto di fornitura attivo o storico.

3.2 In sede di registrazione l'Utente fornisce un'e-mail valida e una password; la registrazione completa il flusso di **claim** del profilo shadow eventualmente esistente.

3.3 Le credenziali sono strettamente personali. L'Utente è responsabile della loro custodia e di ogni attività compiuta tramite il proprio account. In caso di sospetto utilizzo non autorizzato, l'Utente deve modificare immediatamente la password e contattare il Fornitore.

3.4 L'accesso è protetto da **Cloudflare Turnstile** (anti-bot) e da policy di gestione sessione tramite cookie HTTP-only.

---

## 4. Uso corretto della Piattaforma

L'Utente si impegna a:

- utilizzare il Servizio in modo lecito, in conformità a leggi italiane ed europee;
- non tentare accessi non autorizzati a dati di altri utenti, alle aree amministrative o all'infrastruttura;
- non effettuare reverse engineering, scraping massivo, attacchi di forza bruta o test di sicurezza non autorizzati;
- non caricare contenuti illeciti, malware o dati di terzi senza titolo;
- non aggirare i meccanismi di autenticazione, captcha o rate-limit;
- non sfruttare vulnerabilità: eventuali bug devono essere segnalati al Fornitore in modalità responsabile (responsible disclosure) all'indirizzo matteo.volterrani@valdelsahightech.com.

La violazione dei presenti obblighi può comportare la **sospensione immediata** dell'account, l'azione legale e la segnalazione alle autorità competenti.

---

## 5. Pagamenti tramite PagoPA

5.1 La Piattaforma integra il **Nodo dei Pagamenti SPC** (PagoPA) per il saldo delle bollette. Il pagamento è gestito da **PagoPA S.p.A.**, soggetto autonomo e responsabile dell'esecuzione della transazione.

5.2 Lo stato del pagamento sulla Piattaforma viene aggiornato in seguito alla notifica del nodo PagoPA. Il Fornitore non garantisce l'aggiornamento istantaneo: l'Utente è invitato a conservare la ricevuta PagoPA come prova del pagamento.

5.3 Eventuali contestazioni relative all'importo o alla fatturazione devono essere indirizzate al **gestore del servizio idrico/energetico** che ha emesso la bolletta. Il Fornitore agisce come tramite tecnico, non come emittente del titolo di pagamento.

5.4 Non sono accettati storni o rimborsi tramite la Piattaforma: i rimborsi vengono gestiti dal gestore secondo i canali ordinari.

---

## 6. Documenti e archiviazione

6.1 Le bollette in formato PDF sono archiviate su **Cloudflare R2** (regione UE) e servite tramite URL firmati a tempo (5 minuti).

6.2 L'Utente può scaricare le proprie bollette per uso personale e in conformità agli obblighi di conservazione fiscale.

6.3 Il Fornitore conserva le bollette per il periodo previsto dalla normativa fiscale italiana (**10 anni**, art. 2220 c.c.).

---

## 7. Disponibilità del Servizio

7.1 Il Fornitore si impegna a mantenere la Piattaforma operativa con il massimo dell'impegno tecnologico ragionevolmente possibile, fatti salvi:

- interventi di manutenzione programmata (con preavviso);
- interventi di manutenzione straordinaria per ragioni di sicurezza;
- malfunzionamenti delle infrastrutture di terzi (Supabase, Cloudflare, Resend, PagoPA);
- eventi di forza maggiore.

7.2 Non è garantito alcun **SLA** di uptime contrattuale verso l'Utente finale; eventuali SLA sono definiti tra il Fornitore e il gestore del servizio.

---

## 8. Proprietà intellettuale

8.1 Il software ACQDASH, il codice sorgente, il design dell'interfaccia, i marchi e i loghi sono di proprietà esclusiva di **Grafiche Valdelsa S.r.l.** o dei rispettivi licenziatari.

8.2 È vietata la riproduzione, distribuzione, modifica o creazione di opere derivate senza autorizzazione scritta.

8.3 Le bollette e i dati di fornitura restano di proprietà del **gestore del servizio idrico/energetico**; l'Utente conserva diritti sui propri dati personali ai sensi del GDPR.

---

## 9. Limitazione di responsabilità

9.1 Il Fornitore non risponde di:

- danni indiretti, perdita di profitto, perdita di chance, danni reputazionali;
- malfunzionamenti delle infrastrutture di terzi (operatori telefonici, ISP, sub-processor);
- comportamenti illeciti dell'Utente o di terzi che abbiano avuto accesso alle credenziali per causa imputabile all'Utente;
- ritardi nell'aggiornamento dello stato pagamento dovuti a PagoPA o ai prestatori di servizi di pagamento;
- contenuto delle bollette (di responsabilità del gestore del servizio).

9.2 Nei limiti consentiti dalla legge, la responsabilità del Fornitore è limitata al danno diretto e immediato, escluso ogni danno indiretto.

9.3 La presente clausola non limita la responsabilità per **dolo** o **colpa grave**, né per i diritti inderogabili dei consumatori ai sensi del Codice del Consumo.

---

## 10. Sospensione e cessazione

10.1 Il Fornitore può **sospendere** o **cessare** l'account in caso di:

- violazione dei presenti Termini;
- richiesta motivata del gestore del servizio (es. cessazione contratto);
- obblighi di legge, ordini dell'autorità giudiziaria;
- attività che pregiudichino la sicurezza della Piattaforma o di altri utenti.

10.2 L'Utente può richiedere in qualsiasi momento la cancellazione dell'account, fatti salvi gli obblighi di conservazione fiscale (vedi Privacy Policy).

---

## 11. Trattamento dei dati personali

Il trattamento dei dati personali è disciplinato dall'Informativa sulla Privacy disponibile in [PRIVACY_POLICY.md](./PRIVACY_POLICY.md), che costituisce parte integrante dei presenti Termini.

L'infrastruttura di trattamento è **localizzata in Unione Europea** (Supabase + Cloudflare R2 in regione EU) in conformità al **Regolamento (UE) 2016/679 (GDPR)**.

---

## 12. Modifiche ai Termini

Il Fornitore può modificare i presenti Termini per ragioni tecniche, normative o operative. Le modifiche sostanziali sono comunicate tramite e-mail e/o avviso in piattaforma con preavviso di **30 giorni**. L'uso della Piattaforma successivo all'entrata in vigore costituisce accettazione.

---

## 13. Legge applicabile e foro competente

13.1 I presenti Termini sono regolati dal **diritto italiano**.

13.2 Per ogni controversia è competente in via esclusiva il **Foro di Siena**, fatto salvo il foro inderogabile del consumatore ai sensi dell'art. 66-bis del D.Lgs. 206/2005 (Codice del Consumo).

13.3 Per gli utenti consumatori è disponibile la piattaforma europea **ODR** (Online Dispute Resolution): https://ec.europa.eu/consumers/odr.

---

## 14. Disposizioni finali

14.1 L'eventuale invalidità di una singola clausola non comporta l'invalidità dell'intero documento.

14.2 La tolleranza di una violazione non costituisce rinuncia ad agire per violazioni successive.

14.3 Per ogni comunicazione: **matteo.volterrani@valdelsahightech.com**.

---

**Grafiche Valdelsa S.r.l.**
matteo.volterrani@valdelsahightech.com
