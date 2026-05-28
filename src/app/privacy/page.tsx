import { PrivacyBackButton } from './back-button'

export const metadata = {
    title: 'Informativa Privacy — Acquambiente',
    description: 'Informativa sul trattamento dei dati personali ai sensi del Regolamento (UE) 2016/679 (GDPR).',
}

// NOTA: i contenuti contrassegnati con [DA COMPLETARE] vanno validati e
// compilati dal titolare/consulente legale prima della pubblicazione.
export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-white dark:bg-[#0a0a0a] text-slate-800 dark:text-slate-200">
            <div className="max-w-3xl mx-auto px-6 py-12">
                <PrivacyBackButton />

                <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Informativa sulla Privacy</h1>
                <p className="text-sm text-slate-500 mb-10">
                    Ai sensi degli artt. 13-14 del Regolamento (UE) 2016/679 (GDPR). Ultimo aggiornamento: [DA COMPLETARE].
                </p>

                <Section title="1. Titolare del trattamento">
                    <p>
                        Titolare del trattamento è <strong>Acquambiente Marche S.r.l.</strong> [DA COMPLETARE: ragione
                        sociale completa, sede legale, P.IVA, contatti]. Per esercitare i tuoi diritti o per qualsiasi
                        richiesta puoi scrivere a <strong>[DA COMPLETARE: email privacy/DPO]</strong>.
                    </p>
                </Section>

                <Section title="2. Dati trattati">
                    <p>Nell'ambito del portale clienti trattiamo le seguenti categorie di dati personali:</p>
                    <ul className="list-disc pl-5 space-y-1 mt-2">
                        <li>Dati anagrafici e di contatto: nome, email, telefono;</li>
                        <li>Codice Fiscale / Partita IVA e codice cliente;</li>
                        <li>Indirizzi delle forniture e dati delle utenze (ULM);</li>
                        <li>Dati di consumo e di fatturazione (bollette, importi, scadenze);</li>
                        <li>Dati relativi ai pagamenti (tramite PagoPA);</li>
                        <li>Dati tecnici di accesso (log di autenticazione, indirizzo IP) per finalità di sicurezza.</li>
                    </ul>
                    <p className="mt-2">Non trattiamo categorie particolari di dati (art. 9) né dati di minori.</p>
                </Section>

                <Section title="3. Finalità e basi giuridiche">
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Esecuzione del contratto</strong> di fornitura idrica (art. 6.1.b): consultazione bollette, gestione forniture, pagamenti.</li>
                        <li><strong>Obbligo legale</strong> (art. 6.1.c): conservazione dei documenti contabili e fiscali.</li>
                        <li><strong>Legittimo interesse</strong> (art. 6.1.f): sicurezza del portale e prevenzione abusi (log di accesso, rate limiting).</li>
                    </ul>
                </Section>

                <Section title="4. Conservazione dei dati">
                    <p>
                        I dati di fatturazione sono conservati per il periodo previsto dalla normativa fiscale
                        (<strong>10 anni</strong> [DA CONFERMARE]). I log di autenticazione sono conservati per un periodo
                        limitato a fini di sicurezza ([DA COMPLETARE: es. 12-24 mesi]) e poi cancellati automaticamente.
                    </p>
                </Section>

                <Section title="5. Destinatari e responsabili esterni">
                    <p>I dati possono essere trattati da fornitori che agiscono come responsabili del trattamento:</p>
                    <ul className="list-disc pl-5 space-y-1 mt-2">
                        <li><strong>Supabase</strong> — hosting database (region UE: Irlanda);</li>
                        <li><strong>Cloudflare</strong> — archiviazione documenti (R2) e protezione anti-bot (Turnstile);</li>
                        <li><strong>Resend</strong> — invio email transazionali;</li>
                        <li><strong>PagoPA</strong> — elaborazione pagamenti.</li>
                    </ul>
                    <p className="mt-2">
                        Con ciascun fornitore è in essere un accordo sul trattamento dei dati (DPA) e, ove i dati siano
                        trasferiti fuori dallo Spazio Economico Europeo, sono adottate adeguate garanzie (Clausole
                        Contrattuali Standard). [DA CONFERMARE]
                    </p>
                </Section>

                <Section title="6. I tuoi diritti">
                    <p>In qualità di interessato hai diritto di:</p>
                    <ul className="list-disc pl-5 space-y-1 mt-2">
                        <li>accedere ai tuoi dati (art. 15) — puoi scaricarli dalla tua area riservata;</li>
                        <li>chiederne la rettifica (art. 16) o la cancellazione (art. 17);</li>
                        <li>chiederne la limitazione (art. 18) o opporti al trattamento (art. 21);</li>
                        <li>ricevere i tuoi dati in formato strutturato (portabilità, art. 20);</li>
                        <li>proporre reclamo al Garante per la protezione dei dati personali.</li>
                    </ul>
                    <p className="mt-2">
                        Per esercitare i tuoi diritti scrivi a <strong>[DA COMPLETARE: email privacy/DPO]</strong>.
                        Risponderemo entro 30 giorni. Alcune richieste di cancellazione potrebbero essere limitate dagli
                        obblighi legali di conservazione dei dati di fatturazione.
                    </p>
                </Section>

                <Section title="7. Cookie">
                    <p>
                        Il portale utilizza esclusivamente cookie tecnici di sessione strettamente necessari
                        all'autenticazione e alla sicurezza. Non sono utilizzati cookie di profilazione o di terze parti
                        a fini di marketing, pertanto non è richiesto alcun consenso preventivo.
                    </p>
                </Section>

                <p className="text-xs text-slate-400 mt-12 border-t border-slate-100 dark:border-white/10 pt-6">
                    Questo documento è una bozza tecnica. I contenuti contrassegnati con [DA COMPLETARE]/[DA CONFERMARE]
                    devono essere validati dal titolare e dal consulente legale prima della pubblicazione.
                </p>
            </div>
        </div>
    )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="mb-8">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3">{title}</h2>
            <div className="text-sm leading-relaxed space-y-2 text-slate-600 dark:text-slate-300">{children}</div>
        </section>
    )
}
