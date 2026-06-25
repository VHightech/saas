// Display helpers for bills.billing_type.
//
// Stored values (see standard-csv.ts / normalizeBillingType):
//   'S' = Saldo, 'A' = Acconto, or the full document label verbatim
//   (e.g. 'NOTA DI CREDITO', 'SALDO E CONGUAGLIO', 'SALDO FINALE').
// This module turns that raw value into a readable label + a colour "tone"
// so every view renders the same way.

export type BillingTone = 'saldo' | 'acconto' | 'credito' | 'neutral'

export interface BillingTypeDisplay {
    label: string      // human label, e.g. 'Saldo', 'Nota di Credito'
    tone: BillingTone  // colour family for the badge
    isCredit: boolean  // true for nota di credito
}

const SMALL_WORDS = new Set(['e', 'di', 'da', 'del', 'della', 'la', 'il', 'in'])

/** Title-case an Italian label, keeping connecting words ("e", "di", ...) lowercase. */
function titleCaseIt(value: string): string {
    return value
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .map((w, i) => (i > 0 && SMALL_WORDS.has(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
}

/** Map a raw billing_type to its display label + tone, or null when empty. */
export function billingTypeDisplay(code: string | null | undefined): BillingTypeDisplay | null {
    const raw = String(code ?? '').trim()
    if (!raw) return null
    const up = raw.toUpperCase()

    if (up === 'S') return { label: 'Saldo', tone: 'saldo', isCredit: false }
    if (up === 'A') return { label: 'Acconto', tone: 'acconto', isCredit: false }

    if (up.includes('CREDITO')) return { label: titleCaseIt(up), tone: 'credito', isCredit: true }
    if (up.startsWith('SALDO')) return { label: titleCaseIt(up), tone: 'saldo', isCredit: false }
    if (up.startsWith('ACCONTO')) return { label: titleCaseIt(up), tone: 'acconto', isCredit: false }
    return { label: titleCaseIt(up), tone: 'neutral', isCredit: false }
}

/** Tailwind classes per tone for the user-facing dashboard badges (blue/orange/rose). */
export const DASHBOARD_TONE_CLASS: Record<BillingTone, string> = {
    saldo: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
    acconto: 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400',
    credito: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
    neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400',
}
