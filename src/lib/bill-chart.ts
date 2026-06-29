/**
 * Shared 6-month chart series builder used by both the desktop BolletteView
 * charts and the mobile home charts. Callers pass the bills already filtered to
 * the selected supply (the two views differ in how they resolve "which bills",
 * so that selection stays at the call site); this builds the padded slot series.
 *
 * Kept as a pure function (not a hook) so each caller keeps its own useMemo with
 * the correct dependencies and memoization is preserved.
 */

export interface ChartSlot {
    key: string
    value: number | null
    label: string
    ym: string
    bill?: any
}

export interface BillChartData {
    slots: ChartSlot[]
    max: number
    lastRealIndex: number
    placeholderHeights: number[]
    lastBill: any | null
}

const SLOT_COUNT = 6
const MIN_PLACEHOLDERS = 2
const MAX_REAL = SLOT_COUNT - MIN_PLACEHOLDERS
const PLACEHOLDER_HEIGHTS = [55, 72, 48, 65, 58, 70]

/** Robustly parse a consumo value that may be a number or an Italian "1.234,5" string. */
const parseConsumo = (v: unknown): number => parseFloat(String(v ?? 0).replace(',', '.')) || 0

const monthLabel = (d: Date) => d.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '')
const ymKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

export function buildBillChartData(supplyBills: any[]): BillChartData {
    const recent = [...supplyBills]
        .sort((a: any, b: any) => new Date(a.data_emissione).getTime() - new Date(b.data_emissione).getTime())
        .slice(-MAX_REAL)

    const padCount = SLOT_COUNT - recent.length
    const anchor = recent.length > 0 ? new Date((recent[0] as any).data_emissione) : new Date()

    const slots: ChartSlot[] = []
    for (let i = padCount; i > 0; i--) {
        const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1)
        slots.push({ key: `placeholder-${ymKey(d)}`, value: null, label: monthLabel(d), ym: ymKey(d) })
    }
    recent.forEach((b: any, i) => {
        const d = new Date(b.data_emissione)
        slots.push({
            key: `bill-slot-${i}-${b.id ?? 'x'}`,
            value: parseConsumo(b.consumo),
            label: monthLabel(d),
            ym: ymKey(d),
            bill: b,
        })
    })

    const max = Math.max(...recent.map((b: any) => parseConsumo(b.consumo)), 1)
    const lastRealIndex = slots.reduce((acc, s, i) => (s.bill ? i : acc), -1)
    const lastBill = recent.length > 0 ? recent[recent.length - 1] : null

    return { slots, max, lastRealIndex, placeholderHeights: PLACEHOLDER_HEIGHTS, lastBill }
}

// ===== Yearly month-by-month series (spesa + consumo combined) =====

/** Robustly parse a euro amount that may be a number or an Italian "1.234,56" string. */
const parseAmount = (v: unknown): number => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0
    const s = String(v ?? '').trim()
    if (!s) return 0
    // Italian format: thousands '.' and decimal ',' → strip dots, swap comma.
    const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
    return parseFloat(normalized) || 0
}

const MONTHS_IT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

export interface YearlyMonth {
    month: number   // 0-11
    label: string   // 'Gen' … 'Dic'
    spesa: number   // € summed for that month
    consumo: number // mc summed for that month
    count: number   // number of bills in that month
}

export interface YearlyChartData {
    year: number
    months: YearlyMonth[]
    maxSpesa: number
    maxConsumo: number
    /** Outlier-resistant scale for bar/line heights (freak bills clip above it). */
    spesaScale: number
    consumoScale: number
    totalSpesa: number
    totalConsumo: number
    hasData: boolean
}

/**
 * Outlier-resistant upper bound for a set of monthly values. Uses the Tukey
 * upper fence (Q3 + 1.5·IQR): when the largest value sits within the fence the
 * scale is just the data max (normal chart); when a freak bill blows past it the
 * scale clamps to the top of the "normal" range so a €110k anomaly clips instead
 * of flattening every other month to nothing.
 */
export function robustScale(values: number[]): number {
    const v = values.filter(x => x > 0).sort((a, b) => a - b)
    if (v.length === 0) return 1
    const dataMax = v[v.length - 1]
    if (v.length <= 2) return dataMax || 1 // too few points to call anything an outlier

    const quantile = (p: number) => {
        const idx = (v.length - 1) * p
        const lo = Math.floor(idx)
        const hi = Math.ceil(idx)
        return v[lo] + (v[hi] - v[lo]) * (idx - lo)
    }
    const q1 = quantile(0.25)
    const q3 = quantile(0.75)
    const fence = q3 + 1.5 * (q3 - q1)
    if (dataMax <= fence) return dataMax

    const within = v.filter(x => x <= fence)
    const top = within.length ? within[within.length - 1] : q3
    return Math.max(top * 1.1, fence, 1)
}

/**
 * Round a value up to a "nice" axis ceiling (1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5
 * ×10ⁿ) with ~5% headroom, so the tallest bar/line never sits flush against the
 * top and the axis labels are readable round numbers.
 */
export function niceCeil(value: number): number {
    if (!Number.isFinite(value) || value <= 0) return 1
    // ~25% headroom so the tallest bar / a near-constant line sits around 3/4
    // height instead of hugging the top edge of the plot.
    const v = value / 0.8
    const exp = Math.floor(Math.log10(v))
    const base = Math.pow(10, exp)
    const norm = v / base // [1, 10)
    const step =
        norm <= 1 ? 1 :
        norm <= 1.25 ? 1.25 :
        norm <= 1.5 ? 1.5 :
        norm <= 2 ? 2 :
        norm <= 2.5 ? 2.5 :
        norm <= 3 ? 3 :
        norm <= 4 ? 4 :
        norm <= 5 ? 5 :
        norm <= 7.5 ? 7.5 : 10
    return step * base
}

/** Distinct years (desc) that have at least one bill with a valid emission date. */
export function availableBillYears(bills: any[]): number[] {
    const years = new Set<number>()
    for (const b of bills) {
        const raw = b?.data_emissione
        if (!raw) continue
        const d = new Date(raw)
        if (!Number.isNaN(d.getTime())) years.add(d.getFullYear())
    }
    return [...years].sort((a, b) => b - a)
}

/**
 * Aggregate a supply's (or all) bills into the 12 calendar months of `year`,
 * summing both spesa (importo) and consumo per month. Unlike buildBillChartData
 * this keeps the FULL set of bills for the year — no last-N truncation.
 */
export function buildYearlyChartData(bills: any[], year: number): YearlyChartData {
    const months: YearlyMonth[] = MONTHS_IT.map((label, month) => ({
        month, label, spesa: 0, consumo: 0, count: 0,
    }))

    for (const b of bills) {
        const raw = b?.data_emissione
        if (!raw) continue
        const d = new Date(raw)
        if (Number.isNaN(d.getTime()) || d.getFullYear() !== year) continue
        const slot = months[d.getMonth()]
        slot.spesa += parseAmount(b.importo)
        slot.consumo += parseConsumo(b.consumo)
        slot.count += 1
    }

    const maxSpesa = Math.max(...months.map(m => m.spesa), 1)
    const maxConsumo = Math.max(...months.map(m => m.consumo), 1)
    // Spesa is drawn as bars → robust scale (a freak bill clips, doesn't flatten
    // the rest). Consumo is drawn as a LINE → fit the actual max (with headroom)
    // so the line is never clipped, which would read as broken.
    const spesaScale = niceCeil(robustScale(months.map(m => m.spesa)))
    const consumoScale = niceCeil(Math.max(...months.map(m => m.consumo), 1))
    const totalSpesa = months.reduce((s, m) => s + m.spesa, 0)
    const totalConsumo = months.reduce((s, m) => s + m.consumo, 0)

    return {
        year,
        months,
        maxSpesa,
        maxConsumo,
        spesaScale,
        consumoScale,
        totalSpesa,
        totalConsumo,
        hasData: months.some(m => m.count > 0),
    }
}
