// Display helpers for bills.billing_type.
//
// Stored values (see standard-csv.ts / normalizeBillingType):
//   'S' = Saldo, 'A' = Acconto, or the full document label verbatim
//   (e.g. 'NOTA DI CREDITO', 'SALDO E CONGUAGLIO', 'SALDO FINALE').
// This module turns that raw value into a readable label + a colour "tone"
// so every view renders the same way.

export type BillingTone = 'saldo' | 'conguaglio' | 'acconto' | 'credito' | 'neutral'

export interface BillingTypeDisplay {
    label: string      // full human label, e.g. 'Saldo e Conguaglio', 'Nota di Credito'
    short: string      // compact label for narrow badges, e.g. 'Conguaglio', 'Credito'
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

/**
 * Map a raw billing_type to its display label + tone, or null when empty.
 *
 * Order matters: "SALDO E CONGUAGLIO" starts with "SALDO" but must be detected
 * as a conguaglio first, and "NOTA DI CREDITO" must win over everything else.
 */
export function billingTypeDisplay(code: string | null | undefined): BillingTypeDisplay | null {
    const raw = String(code ?? '').trim()
    if (!raw) return null
    const up = raw.toUpperCase()

    if (up === 'S') return { label: 'Saldo', short: 'Saldo', tone: 'saldo', isCredit: false }
    if (up === 'A') return { label: 'Acconto', short: 'Acconto', tone: 'acconto', isCredit: false }

    if (up.includes('CREDITO')) return { label: titleCaseIt(up), short: 'Credito', tone: 'credito', isCredit: true }
    if (up.includes('CONGUAGLIO')) return { label: titleCaseIt(up), short: 'Conguaglio', tone: 'conguaglio', isCredit: false }
    if (up.startsWith('SALDO')) return { label: titleCaseIt(up), short: 'Saldo', tone: 'saldo', isCredit: false }
    if (up.startsWith('ACCONTO')) return { label: titleCaseIt(up), short: 'Acconto', tone: 'acconto', isCredit: false }

    const t = titleCaseIt(up)
    return { label: t, short: t, tone: 'neutral', isCredit: false }
}

/**
 * Shared badge palette (light bg + coloured text + subtle border) used by every
 * billing-type badge — user dashboard AND admin — so the colours stay consistent.
 *
 *   saldo       → blu (Royal/Dodger Blue)   credito → verde (Mint/Pale Green)
 *   conguaglio  → azzurro (Light Sky Blue)   acconto → arancione (Orange/Coral)
 */
export const BILLING_TONE_CLASS: Record<BillingTone, string> = {
    saldo: 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20',
    conguaglio: 'bg-sky-50 text-sky-600 border border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-400/20',
    acconto: 'bg-orange-50 text-orange-600 border border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-400/20',
    credito: 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-500/10 dark:text-green-300 dark:border-green-400/20',
    neutral: 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-400/20',
}

/**
 * @deprecated Use BILLING_TONE_CLASS. Kept as an alias so existing imports keep
 * working; both point at the same palette.
 */
export const DASHBOARD_TONE_CLASS: Record<BillingTone, string> = BILLING_TONE_CLASS
