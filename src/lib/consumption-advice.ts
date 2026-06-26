// Year-over-year consumption advice, shared by the Confronto screen and the
// home "Confronto" quick-action badge so both tell the same story.

export type AdviceLevel = 'alert' | 'warn' | 'ok' | 'none'

export interface ConsumptionAdvice {
    /** True when there are two comparable years of consumo data. */
    hasData: boolean
    level: AdviceLevel
    /** Signed % change of current vs previous year (positive = consuming more). */
    diffPct: number
    currentYear: number
    prevYear: number
    currentTotal: number
    prevTotal: number
}

const num = (v: unknown): number => parseFloat(String(v ?? 0).replace(',', '.')) || 0

/**
 * Compare the two most recent years that have consumo data (robust to a
 * partially-filled current calendar year). `bills` should already be scoped to a
 * single supply by the caller.
 */
export function consumptionAdvice(bills: any[]): ConsumptionAdvice {
    const byYear = new Map<number, number>()
    for (const b of bills) {
        const d = new Date(b?.data_emissione)
        if (Number.isNaN(d.getTime())) continue
        const y = d.getFullYear()
        byYear.set(y, (byYear.get(y) ?? 0) + num(b.consumo))
    }

    const years = [...byYear.keys()].sort((a, b) => b - a)
    const currentYear = years[0] ?? new Date().getFullYear()
    const prevYear = years[1] ?? 0
    const currentTotal = years[0] ? byYear.get(currentYear)! : 0
    const prevTotal = years[1] ? byYear.get(prevYear)! : 0

    if (years.length < 2 || prevTotal <= 0) {
        return { hasData: false, level: 'none', diffPct: 0, currentYear, prevYear, currentTotal, prevTotal }
    }

    const diffPct = ((currentTotal - prevTotal) / prevTotal) * 100
    const level: AdviceLevel = diffPct > 15 ? 'alert' : diffPct > 0 ? 'warn' : 'ok'

    return { hasData: true, level, diffPct, currentYear, prevYear, currentTotal, prevTotal }
}

/** Human advice paragraph for the given comparison. */
export function consumptionAdviceText(a: ConsumptionAdvice): string {
    if (!a.hasData) {
        return 'Servono almeno due anni di letture per confrontare i consumi. Continueremo a raccogliere i dati delle tue bollette.'
    }
    const pct = Math.abs(a.diffPct).toFixed(0)
    if (a.diffPct < -15) return `Ottimo lavoro! Stai consumando il ${pct}% in meno rispetto al ${a.prevYear}. Le tue abitudini stanno portando un risparmio concreto.`
    if (a.diffPct > 15) return `Attenzione: i consumi sono aumentati del ${pct}% rispetto al ${a.prevYear}. Ti consigliamo di verificare eventuali perdite occulte o picchi anomali.`
    if (a.diffPct > 0) return `I consumi sono leggermente superiori (+${pct}%) rispetto al ${a.prevYear}. Monitora l'andamento nei prossimi mesi.`
    return `Consumi stabili: sei in linea con il tuo storico del ${a.prevYear}. Piccoli accorgimenti quotidiani possono aiutarti a ridurre ulteriormente la spesa.`
}
