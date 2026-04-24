'use client'

/**
 * Bills list — rows + pay/open actions. Responsive.
 * Drop into src/components/dashboard/BillsList.tsx
 */

import * as React from 'react'
import { FileText, CreditCard, Download, ChevronRight } from 'lucide-react'
import type { Bill } from '@/types/dashboard'
import { fmtEur, fmtDate, daysUntil } from '@/lib/format'

export function BillsList({ bills, onOpen, onPay }: {
    bills: Bill[]
    onOpen?: (b: Bill) => void
    onPay?: (b: Bill) => void
}) {
    return (
        <div className="rounded-2xl border border-[var(--acq-ink-soft)] bg-[var(--acq-surface)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--acq-ink-soft)]">
                <div>
                    <div className="font-[var(--acq-font-display)] text-lg tracking-tight text-[var(--acq-ink)]">Bollette</div>
                    <div className="text-xs text-[var(--acq-ink-sub)]">{bills.length} totali</div>
                </div>
            </div>
            <div className="divide-y divide-[var(--acq-ink-hair)]">
                {bills.map(b => {
                    const isPaid = b.status === 'paid'
                    const days = daysUntil(b.scadenza)
                    const overdue = !isPaid && days < 0
                    return (
                        <div key={b.id} className="flex items-center gap-3 px-5 py-4 hover:bg-[var(--acq-bg)] transition">
                            <div className="w-10 h-10 rounded-xl bg-[var(--acq-ink-soft)] grid place-items-center flex-shrink-0">
                                <FileText className="w-4 h-4 text-[var(--acq-ink-sub)]" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <div className="text-sm font-semibold text-[var(--acq-ink)] tabular-nums">{fmtEur(b.importo)}</div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isPaid
                                        ? 'bg-[var(--acq-teal)]/10 text-[var(--acq-teal)]'
                                        : overdue ? 'bg-[var(--acq-red)]/10 text-[var(--acq-red)]'
                                          : 'bg-[var(--acq-amber)]/10 text-[var(--acq-amber)]'}`}>
                                        {isPaid ? 'Pagata' : overdue ? 'Scaduta' : 'Da pagare'}
                                    </span>
                                </div>
                                <div className="text-xs text-[var(--acq-ink-sub)] mt-0.5 font-mono">
                                    {fmtDate(b.data_emissione)} · Scad. {fmtDate(b.scadenza)} · {b.consumo} m³
                                </div>
                            </div>
                            <div className="hidden sm:flex gap-2">
                                {!isPaid && (
                                    <button onClick={() => onPay?.(b)}
                                        className="px-3 py-1.5 rounded-lg bg-[var(--acq-deep-blue)] text-white text-xs font-semibold hover:opacity-90">
                                        <CreditCard className="w-3.5 h-3.5 inline mr-1" /> Paga
                                    </button>
                                )}
                                <button onClick={() => onOpen?.(b)}
                                    className="px-3 py-1.5 rounded-lg border border-[var(--acq-ink-soft)] text-xs font-semibold text-[var(--acq-ink)] hover:bg-[var(--acq-ink-soft)]">
                                    Dettagli
                                </button>
                            </div>
                            <button onClick={() => onOpen?.(b)} className="sm:hidden w-9 h-9 rounded-lg grid place-items-center hover:bg-[var(--acq-ink-soft)]">
                                <ChevronRight className="w-4 h-4 text-[var(--acq-ink-sub)]" />
                            </button>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
