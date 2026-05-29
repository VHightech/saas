'use client'

import type { ReactNode } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Small KPI tile on the admin users list. */
export function DetailMetric({ value, label, icon: Icon, colorClass }: { value: string; label: string; icon?: any; colorClass?: string }) {
    return (
        <div className="flex flex-col p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5">
            <div className="flex items-center justify-between mb-2">
                {Icon && <Icon size={14} className="text-slate-400" />}
            </div>
            <div className={cn("text-[15px] font-bold tracking-tight text-slate-900 dark:text-white leading-none", colorClass)}>
                {value}
            </div>
            <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400 mt-2">
                {label}
            </div>
        </div>
    )
}

/** Tri-state (checked / indeterminate / unchecked) selection checkbox. */
export function Checkbox({ checked, indeterminate, onChange }: { checked: boolean; indeterminate?: boolean; onChange: () => void }) {
    return (
        <button
            onClick={(e) => { e.stopPropagation(); onChange() }}
            className={cn(
                'w-4 h-4 rounded border flex items-center justify-center transition-colors',
                checked || indeterminate
                    ? 'bg-[#0A2540] dark:bg-white border-[#0A2540] dark:border-white text-white dark:text-[#0A2540]'
                    : 'bg-white dark:bg-white/5 border-slate-300 dark:border-white/30 hover:border-slate-400'
            )}
        >
            {indeterminate ? (
                <span className="w-2 h-0.5 bg-white" />
            ) : checked ? (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            ) : null}
        </button>
    )
}

/** Action button inside the bulk-selection toolbar. */
export function SelectionAction({ icon, label, onClick }: { icon: ReactNode; label?: string | null; onClick?: () => void }) {
    return (
        <button
            onClick={onClick}
            className="h-10 px-3 hover:bg-white/5 dark:hover:bg-slate-100 flex items-center gap-1.5 text-[12px] text-white/80 dark:text-[#1A1F2A]/80 hover:text-white dark:hover:text-[#1A1F2A] transition-colors whitespace-nowrap"
        >
            {icon}
            {label}
        </button>
    )
}

/** Dashed filter chip with optional active state + count badge + clear button. */
export function FilterChip({ label, badge, active, onClear }: { label: string; badge?: number | null; active?: boolean; onClear?: () => void }) {
    return (
        <button
            className={cn(
                'h-9 px-4 rounded-full text-[13px] font-medium flex items-center gap-2 transition-all duration-200 group/f',
                active
                    ? 'bg-black text-white border-transparent'
                    : 'bg-white dark:bg-white/5 border border-dashed border-slate-300 dark:border-white/20 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-white/40'
            )}
        >
            <span className="flex items-center gap-1.5">
                {label}
            </span>
            <ChevronDown
                size={14}
                className={cn(
                    'transition-transform duration-200',
                    active ? 'text-white/60' : 'text-slate-400'
                )}
            />
            {active && onClear && (
                <div
                    role="button"
                    onClick={(e) => { e.stopPropagation(); onClear() }}
                    className="w-5 h-5 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:bg-rose-500 hover:border-rose-500 -mr-1 transition-all duration-200"
                >
                    <X size={10} strokeWidth={3} />
                </div>
            )}
        </button>
    )
}

/** "Forniture Multiple" pill with a count badge. */
export function MultiBadge({ count }: { count: number }) {
    return (
        <div className="group/multi relative inline-flex items-center h-7 pl-3 pr-1 rounded-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 transition-all duration-300 hover:border-indigo-500/30 hover:bg-slate-50 dark:hover:bg-white/[0.08]">
            <span className="text-[8px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-widest mr-2 transition-colors group-hover/multi:text-slate-600 dark:group-hover/multi:text-slate-300">
                Forniture Multiple
            </span>
            <div className="h-5 px-1.5 min-w-[20px] rounded-full bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-[#1A1F2A] text-[11px] font-mono tabular-nums transition-transform group-hover/multi:scale-110">
                {count}
            </div>
        </div>
    )
}
