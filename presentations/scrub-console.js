// ─────────────────────────────────────────────────────────────────────────────
//  SCRUB — sostituisce i dati reali con dati finti, solo a schermo.
//
//  A cosa serve: fare screenshot del portale senza mostrare nomi, codici
//  fiscali, e-mail e indirizzi di clienti veri.
//
//  Come si usa:
//    1. apri la pagina da fotografare
//    2. premi F12, vai nella scheda "Console"
//    3. incolla TUTTO questo file e premi Invio
//    4. fai lo screenshot
//    5. ricarica la pagina (F5) per tornare ai dati veri
//
//  Va rieseguito dopo ogni cambio pagina o ricaricamento.
//
//  ATTENZIONE: non è una garanzia. Guarda ogni screenshot prima di usarlo.
//  Sono nove immagini: controllarle è questione di un minuto, e nessun
//  automatismo sostituisce quel controllo.
// ─────────────────────────────────────────────────────────────────────────────

(() => {
    const NOMI = ['Marco', 'Giulia', 'Alessandro', 'Chiara', 'Davide', 'Federica',
        'Lorenzo', 'Martina', 'Simone', 'Elena', 'Andrea', 'Sara', 'Matteo', 'Paola']
    const COGNOMI = ['Bianchi', 'Ferrari', 'Conti', 'Ricci', 'Marino', 'Greco',
        'Bruno', 'Gallo', 'Costa', 'Fontana', 'Caruso', 'Rizzo', 'Moretti', 'Barbieri']
    const VIE = ['Via Roma', 'Via Garibaldi', 'Viale Europa', 'Via Mazzini',
        'Corso Italia', 'Via Dante', 'Via Verdi', 'Piazza Cavour']

    // Parole che sembrano nomi ma sono etichette dell'interfaccia: mai sostituire.
    const STOP = new Set(['Codice', 'Cliente', 'Fiscale', 'Partita', 'Iva', 'Nome',
        'Cognome', 'Indirizzo', 'Comune', 'Bolletta', 'Bollette', 'Fornitura',
        'Forniture', 'Storico', 'Caricamenti', 'Ultima', 'Totale', 'Importo',
        'Scadenza', 'Stato', 'Pagata', 'Non', 'Pagamento', 'Consumo', 'Consumi',
        'Anno', 'Data', 'Emissione', 'Utente', 'Utenti', 'Profilo', 'Contratto',
        'Attivo', 'Cessato', 'Elenco', 'Ricerca', 'Filtri', 'Azioni', 'Dettaglio',
        'Numero', 'Servizio', 'Idrico', 'Energia', 'Acqua', 'Area', 'Riservata',
        'Amministrazione', 'Pannello', 'Accedi', 'Esci', 'Salva', 'Annulla',
        'Confronto', 'Supporto', 'Riepilogo', 'Home', 'Invito', 'Invita',
        // Prefissi stradali: evitano che il nome finto di una via, appena
        // generato dalla regola sugli indirizzi, venga riscambiato per un nome
        // di persona dalla regola successiva.
        'Via', 'Viale', 'Corso', 'Piazza', 'Località', 'Loc', 'Strada', 'Vicolo'])

    // Mappa stabile: lo stesso valore reale diventa sempre lo stesso valore finto,
    // così le due colonne di una tabella restano coerenti fra loro.
    const memo = new Map()
    const pick = (list, seed) => list[Math.abs(hash(seed)) % list.length]

    function hash(s) {
        let h = 0
        for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
        return h
    }

    function stable(real, make) {
        if (!memo.has(real)) memo.set(real, make(real))
        return memo.get(real)
    }

    const RULES = [
        // e-mail
        [/[\w.+-]+@[\w-]+\.[\w.]{2,}/g, (m) => stable(m, (s) =>
            `${pick(NOMI, s).toLowerCase()}.${pick(COGNOMI, s + 'x').toLowerCase()}@esempio.it`)],

        // codice fiscale italiano
        // Formato: 3 cognome + 3 nome + 2 anno + 1 mese + 2 giorno + 4 comune + 1 controllo = 16
        [/\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/g, (m) => stable(m, (s) => {
            const c = pick(COGNOMI, s).toUpperCase().padEnd(3, 'X').slice(0, 3)
            const n = pick(NOMI, s + 'n').toUpperCase().padEnd(3, 'X').slice(0, 3)
            const anno = 60 + (Math.abs(hash(s)) % 40)
            const giorno = String(1 + (Math.abs(hash(s + 'g')) % 28)).padStart(2, '0')
            const check = String.fromCharCode(65 + (Math.abs(hash(s + 'k')) % 26))
            return `${c}${n}${anno}A${giorno}H501${check}`
        })],

        // partita IVA / codici numerici lunghi (codice cliente, CIF, numero bolletta)
        [/\b\d{8,16}\b/g, (m) => stable(m, (s) => {
            let out = ''
            for (let i = 0; i < s.length; i++) out += String((Math.abs(hash(s + i)) % 10))
            return out
        })],

        // numeri di telefono
        [/\b(?:\+39\s?)?3\d{2}[\s.-]?\d{6,7}\b/g, (m) => stable(m, (s) =>
            `3${(Math.abs(hash(s)) % 90 + 10)} ${1000000 + (Math.abs(hash(s + 'p')) % 8999999)}`)],

        // indirizzi — accetta anche le preposizioni minuscole ("Piazza della Repubblica")
        [/\b(?:Via|Viale|Corso|Piazza|Piazzale|Località|Strada|Vicolo)\s+[A-Za-zÀ-ù'’]+(?:\s+[A-Za-zÀ-ù'’]+){0,3}(?:\s*,\s*\d+[a-zA-Z]?)?/g,
            (m) => stable(m, (s) => `${pick(VIE, s)}, ${1 + (Math.abs(hash(s)) % 120)}`)],
    ]

    // Nomi di persona: due o più parole capitalizzate consecutive, escluse le
    // etichette dell'interfaccia.
    const NAME_RE = /\b[A-ZÀ-Ù][a-zà-ù']{2,}(?:\s+[A-ZÀ-Ù][a-zà-ù']{2,})+\b/g

    function scrubNames(text) {
        return text.replace(NAME_RE, (m) => {
            const words = m.split(/\s+/)
            if (words.some((w) => STOP.has(w))) return m
            return stable(m, (s) => `${pick(NOMI, s)} ${pick(COGNOMI, s + 'c')}`)
        })
    }

    function scrubText(text) {
        let out = text
        for (const [re, fn] of RULES) out = out.replace(re, fn)
        return scrubNames(out)
    }

    // Attraversa solo i nodi di testo: la struttura della pagina resta intatta.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            const parent = node.parentElement
            if (!parent) return NodeFilter.FILTER_REJECT
            if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT
            return node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
        },
    })

    const nodes = []
    while (walker.nextNode()) nodes.push(walker.currentNode)

    let changed = 0
    for (const node of nodes) {
        const next = scrubText(node.nodeValue)
        if (next !== node.nodeValue) {
            node.nodeValue = next
            changed++
        }
    }

    // Anche i campi di input mostrano dati reali.
    for (const el of document.querySelectorAll('input, textarea')) {
        if (el.value) el.value = scrubText(el.value)
        if (el.placeholder) el.placeholder = scrubText(el.placeholder)
    }

    console.log(
        `%c SCRUB %c ${changed} porzioni di testo sostituite, ${memo.size} valori distinti.\n` +
        ` Controlla comunque lo screenshot prima di usarlo. F5 per tornare ai dati veri.`,
        'background:#0B6FA4;color:#fff;font-weight:bold;padding:2px 6px;border-radius:3px',
        'color:#0B6FA4'
    )
})()
