/**
 * Canonical contract-status (stadio) model shared by dashboard and admin views.
 *
 * Supply "stadio" codes:
 *   03 = Attivo, 04 = In Lavorazione, 05 = Chiuso, 08 = Annullato.
 */

export type ContractStatusColor = 'emerald' | 'amber' | 'slate' | 'rose'

export interface ContractStatus {
    label: string
    color: ContractStatusColor
}

const STATUS_MAP: Record<string, ContractStatus> = {
    '03': { label: 'Attivo', color: 'emerald' },
    '04': { label: 'In Lavorazione', color: 'amber' },
    '05': { label: 'Chiuso', color: 'slate' },
    '08': { label: 'Annullato', color: 'rose' },
}

/** Resolve a stadio code into its label + color key. Unknown codes echo the raw value. */
export function getContractStatus(stadio?: string | null): ContractStatus {
    if (stadio && STATUS_MAP[stadio]) return STATUS_MAP[stadio]
    return { label: stadio || '—', color: 'slate' }
}

/** Solid pill (admin list): filled background, white text. */
export const STATUS_SOLID_CLASS: Record<ContractStatusColor, string> = {
    emerald: 'bg-emerald-500 text-white border-emerald-600',
    amber: 'bg-amber-500 text-white border-amber-600',
    slate: 'bg-slate-500 text-white border-slate-600',
    rose: 'bg-rose-500 text-white border-rose-600',
}

/** Soft pill (default supply badge over light/dark card surfaces). */
export const STATUS_SOFT_CLASS: Record<ContractStatusColor, string> = {
    emerald: 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-500/10',
    amber: 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-500/10',
    slate: 'text-slate-700 bg-slate-200 dark:text-slate-300 dark:bg-white/10',
    rose: 'text-rose-700 bg-rose-100 dark:text-rose-300 dark:bg-rose-500/10',
}

/** Glass pill (active supply card over the green→blue gradient). */
export const STATUS_GLASS_CLASS: Record<ContractStatusColor, string> = {
    emerald: 'text-emerald-50 bg-emerald-500/40 backdrop-blur-md border border-emerald-300/60 shadow-sm shadow-emerald-500/20',
    amber: 'text-amber-50 bg-amber-500/40 backdrop-blur-md border border-amber-300/60 shadow-sm shadow-amber-500/20',
    slate: 'text-white bg-white/25 backdrop-blur-md border border-white/40',
    rose: 'text-rose-50 bg-rose-500/40 backdrop-blur-md border border-rose-300/60 shadow-sm shadow-rose-500/20',
}

/** Tint pill (admin detail: subtle bg + colored text + matching border). */
export const STATUS_TINT_CLASS: Record<ContractStatusColor, string> = {
    emerald: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    slate: 'bg-slate-500/15 text-slate-600 dark:text-slate-200 border-slate-400/30',
    rose: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
}

/** Status dot + glow (compact indicators). */
export const STATUS_DOT_CLASS: Record<ContractStatusColor, { dot: string; glow: string }> = {
    emerald: { dot: 'bg-emerald-500', glow: 'shadow-[0_0_8px_rgba(16,185,129,0.6)]' },
    amber: { dot: 'bg-amber-500', glow: 'shadow-[0_0_8px_rgba(245,158,11,0.6)]' },
    slate: { dot: 'bg-slate-400', glow: 'shadow-[0_0_8px_rgba(148,163,184,0.5)]' },
    rose: { dot: 'bg-rose-500', glow: 'shadow-[0_0_8px_rgba(244,63,94,0.6)]' },
}
