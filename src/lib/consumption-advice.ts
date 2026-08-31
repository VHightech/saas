// Confronto anno-su-anno dei consumi, condiviso dalla schermata Confronto
// (desktop e mobile) e dal badge "Confronto" della home mobile, cosi' tutti
// raccontano la stessa storia.

export type AdviceLevel = 'alert' | 'warn' | 'ok' | 'none'

export interface ConsumptionAdvice {
    /** True quando ci sono due anni confrontabili di consumi. */
    hasData: boolean
    level: AdviceLevel
    /** Variazione % dell'anno in corso sul precedente (positiva = consuma di piu'). */
    diffPct: number
    currentYear: number
    prevYear: number
    /** Consumo dell'anno in corso sul periodo confrontato. */
    currentTotal: number
    /** Consumo dell'anno precedente SUGLI STESSI MESI. */
    prevTotal: number
    /** Ultimo mese (0-11) fatturato nell'anno in corso: oltre non ci sono dati. */
    lastMonth: number
    /** True quando la finestra confrontata e' meno di 12 mesi. */
    partial: boolean
    /** Finestra confrontata, es. "feb–ago". Vuota quando copre l'anno intero. */
    periodLabel: string
}

export interface ConsumptionComparison {
    advice: ConsumptionAdvice
    /** mc per mese (0-11) dell'anno in corso. */
    curByMonth: number[]
    /** mc per mese (0-11) dell'anno precedente. */
    prevByMonth: number[]
    /** Mesi con almeno una bolletta nell'anno precedente (0 vero ≠ dato assente). */
    prevCovered: boolean[]
    currentYear: number
    prevYear: number
    hasCompare: boolean
    /** Totali sul periodo confrontato, gli stessi che mostra `advice`. */
    curTotal: number
    prevTotal: number
}

const num = (v: unknown): number => parseFloat(String(v ?? 0).replace(',', '.')) || 0

const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

interface YearBuckets {
    byMonth: number[]
    /** Mesi con almeno una bolletta: serve a distinguere "consumo 0" da "nessun dato". */
    covered: boolean[]
}

const emptyBuckets = (): YearBuckets => ({
    byMonth: new Array(12).fill(0),
    covered: new Array(12).fill(false),
})

function bucketsByYear(bills: any[]): Map<number, YearBuckets> {
    const byYear = new Map<number, YearBuckets>()
    for (const b of bills) {
        const d = new Date(b?.data_emissione)
        if (Number.isNaN(d.getTime())) continue
        const year = d.getFullYear()
        let bucket = byYear.get(year)
        if (!bucket) {
            bucket = emptyBuckets()
            byYear.set(year, bucket)
        }
        bucket.byMonth[d.getMonth()] += num(b.consumo)
        bucket.covered[d.getMonth()] = true
    }
    return byYear
}

/**
 * Confronta i due anni piu' recenti con dati di consumo (robusto a un anno in
 * corso solo parzialmente fatturato). `bills` deve essere gia' filtrato su una
 * sola fornitura dal chiamante.
 *
 * Il confronto si fermerebbe volentieri a "totale anno contro totale anno", ma a
 * meta' anno quel conto e' falso: sommare i 12 mesi del passato contro gli 8 gia'
 * fatturati mostra un calo puramente aritmetico. Sui dati reali il segno usciva
 * ribaltato per un terzo delle forniture — utenti che consumavano piu' dell'anno
 * prima leggevano "consumi in calo" in verde.
 *
 * Quindi si confronta una finestra di mesi che i due anni hanno davvero in
 * comune: dal primo mese fatturato da entrambi all'ultimo fatturato da entrambi.
 * Tagliare anche l'inizio conta: i cicli di fatturazione slittano di un mese tra
 * un anno e l'altro, e senza quel taglio la finestra conteneva 8 periodi da un
 * lato e 7 dall'altro (per il 16% delle forniture), gonfiando la percentuale.
 * Resta un limite di fondo: le bollette portano solo la data di emissione, non
 * il periodo di lettura, quindi mesi fatturati con cadenze diverse non si
 * possono allineare meglio di cosi'.
 */
export function consumptionComparison(bills: any[]): ConsumptionComparison {
    const byYear = bucketsByYear(bills)
    const years = [...byYear.keys()].sort((a, b) => b - a)

    const currentYear = years[0] ?? new Date().getFullYear()
    const prevYear = years[1] ?? 0
    const cur = byYear.get(currentYear) ?? emptyBuckets()
    const prev = (prevYear ? byYear.get(prevYear) : undefined) ?? emptyBuckets()

    const firstBilled = (b: YearBuckets) => b.covered.findIndex(Boolean)
    const lastBilled = (b: YearBuckets) => b.covered.reduce((acc, covered, i) => (covered ? i : acc), -1)

    // Ultimo mese fatturato dell'anno in corso: da qui in avanti non ci sono
    // ancora dati (il grafico lo ombreggia).
    const lastMonth = lastBilled(cur)

    // Finestra confrontata: i mesi che entrambi gli anni hanno fatturato.
    const from = Math.max(firstBilled(cur), firstBilled(prev))
    const to = Math.min(lastMonth, lastBilled(prev))
    const sumRange = (byMonth: number[], a: number, b: number) =>
        a < 0 || b < a ? 0 : byMonth.slice(a, b + 1).reduce((x, y) => x + y, 0)

    const windowValid = from >= 0 && to >= from
    const prevTotal = windowValid ? sumRange(prev.byMonth, from, to) : 0
    const comparable = years.length >= 2 && prevTotal > 0

    // Senza confronto la card mostra il consumo dell'anno in corso: li' serve
    // tutto l'anno disponibile, non la finestra comune.
    const winFrom = comparable ? from : 0
    const winTo = comparable ? to : (lastMonth < 0 ? 11 : lastMonth)
    const currentTotal = sumRange(cur.byMonth, winFrom, winTo)

    const partial = winFrom > 0 || winTo < 11
    const periodLabel = !partial
        ? ''
        : winFrom === winTo
            ? MONTHS_SHORT[winFrom]
            : `${MONTHS_SHORT[winFrom]}–${MONTHS_SHORT[winTo]}`

    const diffPct = comparable ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0
    // Le soglie guardano la percentuale ARROTONDATA, quella che l'utente legge:
    // altrimenti un +0,4% mostrava "+0%" con la card rossa "consumi in aumento".
    const rounded = Math.round(diffPct)
    const level: AdviceLevel = !comparable
        ? 'none'
        : rounded > 15 ? 'alert'
            : rounded > 0 ? 'warn'
                : 'ok'

    const advice: ConsumptionAdvice = {
        hasData: comparable,
        level,
        diffPct,
        currentYear,
        prevYear,
        currentTotal,
        prevTotal,
        lastMonth,
        partial,
        periodLabel,
    }

    return {
        advice,
        curByMonth: cur.byMonth,
        prevByMonth: prev.byMonth,
        prevCovered: prev.covered,
        currentYear,
        prevYear,
        hasCompare: comparable,
        curTotal: currentTotal,
        prevTotal,
    }
}

/** Solo il verdetto, per chi non disegna il grafico (es. il badge della home). */
export function consumptionAdvice(bills: any[]): ConsumptionAdvice {
    return consumptionComparison(bills).advice
}

/** Paragrafo di consiglio per il confronto dato. */
export function consumptionAdviceText(a: ConsumptionAdvice): string {
    if (!a.hasData) {
        return 'Servono almeno due anni di letture per confrontare i consumi. Continueremo a raccogliere i dati delle tue bollette.'
    }
    // Stessa percentuale arrotondata mostrata dalla card: testo e numero non
    // devono mai raccontare due cose diverse.
    const rounded = Math.round(a.diffPct)
    const pct = Math.abs(rounded)
    const rif = a.partial ? `agli stessi mesi del ${a.prevYear}` : `al ${a.prevYear}`

    if (rounded === 0) {
        return `Consumi stabili: sei in linea con ${a.partial ? `gli stessi mesi del ${a.prevYear}` : `il tuo storico del ${a.prevYear}`}. Piccoli accorgimenti quotidiani possono aiutarti a ridurre ulteriormente la spesa.`
    }
    if (rounded <= -15) {
        return `Ottimo lavoro! Stai consumando il ${pct}% in meno rispetto ${rif}. Le tue abitudini stanno portando un risparmio concreto.`
    }
    if (rounded < 0) {
        return `Consumi in calo del ${pct}% rispetto ${rif}. Continua così: l'andamento è quello giusto.`
    }
    if (rounded > 15) {
        return `Attenzione: i consumi sono aumentati del ${pct}% rispetto ${rif}. Ti consigliamo di verificare eventuali perdite occulte o picchi anomali.`
    }
    return `I consumi sono leggermente superiori (+${pct}%) rispetto ${rif}. Monitora l'andamento nei prossimi mesi.`
}
