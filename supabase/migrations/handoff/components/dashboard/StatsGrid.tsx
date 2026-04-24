'use client'

/**
 * Stats grid — 4 KPI cards (consumo, spesa, bollette pagate, pending).
 * Drop into src/components/dashboard/widgets/StatsGrid.tsx
 */

import * as React from 'react'
import { Droplet, Euro, CheckCircle2, Clock } from 'lucide-react'
import { fmtEur, fmtM3, fmtPct } from '@/lib/format'
import type { DashboardStats } from '@/types/dashboard-extended'

export function StatsGrid({ stats }: { stats: DashboardStats }) {
    const cards = [
        {
            icon: Droplet, label: 'Ultimo consumo',
            value: fmtM3(stats.lastConsumption),
            hint: stats.trendLabel,
        },
        {
            icon: Euro, label: 'Ultima spesa',
            value: fmtEur(stats.lastCost),
            hint: stats.savingsYoYPct != null ? fmtPct(stats.savingsYoYPct, { sign: true }) + ' vs. anno scorso' : '—',
        },
        {
            icon: CheckCircle2, label: 'Bollette pagate',
            value: String(stats.paidBillsCount),
            hint: fmtEur(stats.paidAmount) + ' totali',
        },
        {
            icon: Clock, label: 'Da pagare',
            value: String(stats.pendingBillsCount),
            hint: fmtEur(stats.pendingAmount) + ' in sospeso',
        },
    ]
    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {cards.map(c => {
                const Icon = c.icon
                return (
                    <div key={c.label} className="rounded-2xl border border-[var(--acq-ink-soft)] bg-[var(--acq-surface)] p-4 md:p-5">
                        <div className="flex items-start justify-between mb-3">
                            <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--acq-ink-sub)]">{c.label}</div>
                            <Icon className="w-4 h-4 text-[var(--acq-ink-sub)]" />
                        </div>
                        <div className="font-[var(--acq-font-display)] text-2xl md:text-3xl tracking-tight text-[var(--acq-ink)] tabular-nums">
                            {c.value}
                        </div>
                        <div className="text-[11px] text-[var(--acq-ink-sub)] mt-1 truncate">{c.hint}</div>
                    </div>
                )
            })}
        </div>
    )
}
