'use client'

/**
 * Supply switcher — dropdown for selecting active supply (home/office).
 * Drop into src/components/dashboard/SupplySwitcher.tsx
 */

import * as React from 'react'
import { ChevronDown, Home, Building2, Check } from 'lucide-react'
import type { Supply } from '@/types/dashboard-extended'

export interface SupplySwitcherProps {
    supplies: Supply[]
    selected: Supply | null
    onSelect: (s: Supply) => void
}

export function SupplySwitcher({ supplies, selected, onSelect }: SupplySwitcherProps) {
    const [open, setOpen] = React.useState(false)
    const ref = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
        const h = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', h)
        return () => document.removeEventListener('mousedown', h)
    }, [])

    if (!selected) return null
    const Icon = selected.type === 'office' ? Building2 : Home

    return (
        <div ref={ref} className="relative">
            <button onClick={() => setOpen(o => !o)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--acq-ink-soft)] transition">
                <div className="w-8 h-8 rounded-lg bg-[var(--acq-deep-blue)] text-white grid place-items-center">
                    <Icon className="w-4 h-4" />
                </div>
                <div className="text-left hidden sm:block">
                    <div className="text-xs text-[var(--acq-ink-sub)] leading-tight">Fornitura</div>
                    <div className="text-sm font-semibold text-[var(--acq-ink)] leading-tight">{selected.label}</div>
                </div>
                <ChevronDown className={`w-4 h-4 text-[var(--acq-ink-sub)] transition ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute top-full left-0 mt-2 w-72 rounded-xl border border-[var(--acq-ink-soft)] bg-[var(--acq-surface)] shadow-lg z-50 overflow-hidden">
                    {supplies.map(s => {
                        const I = s.type === 'office' ? Building2 : Home
                        const active = s.id === selected.id
                        return (
                            <button key={s.id}
                                onClick={() => { onSelect(s); setOpen(false) }}
                                className="w-full flex items-center gap-3 p-3 hover:bg-[var(--acq-bg)] text-left">
                                <div className="w-9 h-9 rounded-lg bg-[var(--acq-ink-soft)] grid place-items-center">
                                    <I className="w-4 h-4 text-[var(--acq-ink-sub)]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-[var(--acq-ink)]">{s.label}</div>
                                    <div className="text-[11px] text-[var(--acq-ink-sub)] truncate">ULM {s.ulm} · {s.address ?? 'Indirizzo non disponibile'}</div>
                                </div>
                                {active && <Check className="w-4 h-4 text-[var(--acq-teal)]" />}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
