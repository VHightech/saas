// Formatters for Italian locale — currency, dates, cubic metres, percentages.
// Drop into src/lib/format.ts

const LOCALE = 'it-IT'

export function fmtEur(n: number | null | undefined, opts: { fractionDigits?: number } = {}): string {
    if (n == null || Number.isNaN(n)) return '—'
    return new Intl.NumberFormat(LOCALE, {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: opts.fractionDigits ?? 2,
        maximumFractionDigits: opts.fractionDigits ?? 2,
    }).format(n)
}

export function fmtM3(n: number | null | undefined): string {
    if (n == null || Number.isNaN(n)) return '—'
    return `${new Intl.NumberFormat(LOCALE).format(n)} m³`
}

export function fmtDate(
    iso: string | Date | null | undefined,
    opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }
): string {
    if (!iso) return '—'
    const d = typeof iso === 'string' ? new Date(iso) : iso
    if (Number.isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat(LOCALE, opts).format(d)
}

export function fmtDateRelative(iso: string | Date | null | undefined): string {
    if (!iso) return '—'
    const d = typeof iso === 'string' ? new Date(iso) : iso
    const diff = Date.now() - d.getTime()
    const abs = Math.abs(diff)
    const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' })
    if (abs < 60_000) return 'adesso'
    if (abs < 3600_000) return rtf.format(-Math.round(diff / 60_000), 'minute')
    if (abs < 86_400_000) return rtf.format(-Math.round(diff / 3600_000), 'hour')
    if (abs < 7 * 86_400_000) return rtf.format(-Math.round(diff / 86_400_000), 'day')
    return fmtDate(d)
}

export function fmtPct(n: number | null | undefined, opts: { sign?: boolean; digits?: number } = {}): string {
    if (n == null || Number.isNaN(n)) return '—'
    const digits = opts.digits ?? 1
    const s = n.toFixed(digits)
    if (opts.sign && n > 0) return `+${s}%`
    return `${s}%`
}

// Italian month short labels (for charts)
export const MONTHS_IT_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

export function monthShort(iso: string | Date): string {
    const d = typeof iso === 'string' ? new Date(iso) : iso
    return MONTHS_IT_SHORT[d.getMonth()]
}

export function daysUntil(iso: string | Date): number {
    const d = typeof iso === 'string' ? new Date(iso) : iso
    return Math.ceil((d.getTime() - Date.now()) / 86_400_000)
}
