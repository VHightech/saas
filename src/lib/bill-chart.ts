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
    totalSpesa: number
    totalConsumo: number
    hasData: boolean
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
    const totalSpesa = months.reduce((s, m) => s + m.spesa, 0)
    const totalConsumo = months.reduce((s, m) => s + m.consumo, 0)

    return {
        year,
        months,
        maxSpesa,
        maxConsumo,
        totalSpesa,
        totalConsumo,
        hasData: months.some(m => m.count > 0),
    }
}
