'use client'

/**
 * Alerts widget — open consumption anomalies.
 * Drop into src/components/dashboard/widgets/AlertsWidget.tsx
 */

import * as React from 'react'
import { AlertTriangle, AlertCircle, Info } from 'lucide-react'
import type { ConsumptionAlert } from '@/types/dashboard-extended'
import { fmtDateRelative, fmtPct } from '@/lib/format'

const ICON: Record<ConsumptionAlert['severity'], React.ComponentType<{ className?: string }>> = {
    info: Info, warning: AlertCircle, critical: AlertTriangle,
}
const TONE: Record<ConsumptionAlert['severity'], string> = {
    info: 'bg-[var(--acq-blue)]/10 text-[var(--acq-blue)]',
    warning: 'bg-[var(--acq-amber)]/10 text-[var(--acq-amber)]',
    critical: 'bg-[var(--acq-red)]/10 text-[var(--acq-red)]',
}

export function AlertsWidget({ alerts, onOpen }: { alerts: ConsumptionAlert[]; onOpen?: (a: ConsumptionAlert) => void }) {
    if (alerts.length === 0) {
        return (
            <div className="rounded-2xl border border-[var(--acq-ink-soft)] bg-[var(--acq-surface)] p-5">
                <div className="text-xs font-semibold tracking-wider uppercase text-[var(--acq-ink-sub)]">Avvisi</div>
                <div className="mt-3 text-sm text-[var(--acq-ink-sub)]">Nessuna anomalia rilevata ✓</div>
            </div>
        )
    }
    return (
        <div className="rounded-2xl border border-[var(--acq-ink-soft)] bg-[var(--acq-surface)] overflow-hidden">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                <div className="text-xs font-semibold tracking-wider uppercase text-[var(--acq-ink-sub)]">Avvisi</div>
                <span className="text-xs font-mono text-[var(--acq-ink-sub)]">{alerts.length}</span>
            </div>
            <div className="divide-y divide-[var(--acq-ink-hair)]">
                {alerts.map(a => {
                    const Icon = ICON[a.severity]
                    return (
                        <button key={a.id} onClick={() => onOpen?.(a)}
                            className="w-full flex items-start gap-3 px-5 py-3 text-left hover:bg-[var(--acq-bg)]">
                            <div className={`w-8 h-8 rounded-lg grid place-items-center flex-shrink-0 ${TONE[a.severity]}`}>
                                <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-[var(--acq-ink)]">{a.title}</div>
                                {a.description && <div className="text-xs text-[var(--acq-ink-sub)] mt-0.5">{a.description}</div>}
                                <div className="text-[11px] font-mono text-[var(--acq-ink-sub)] mt-1">
                                    {fmtDateRelative(a.detected_at)}{a.metric_delta_pct != null && ` · ${fmtPct(a.metric_delta_pct, { sign: true })}`}
                                </div>
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
