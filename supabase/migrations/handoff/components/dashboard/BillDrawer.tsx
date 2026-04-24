'use client'

/**
 * Bill drawer — slides in from the right on desktop, bottom sheet on mobile.
 * Drop into src/components/dashboard/BillDrawer.tsx
 * Depends on shadcn/ui <Sheet> (install: `npx shadcn@latest add sheet`).
 */

import * as React from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Download, CreditCard, ExternalLink, FileText } from 'lucide-react'
import type { Bill } from '@/types/dashboard'
import { fmtEur, fmtDate, daysUntil } from '@/lib/format'

export interface BillDrawerProps {
    open: boolean
    onOpenChange: (v: boolean) => void
    bill: Bill | null
    onPay?: (bill: Bill) => void
    onDownload?: (bill: Bill) => void
}

export function BillDrawer({ open, onOpenChange, bill, onPay, onDownload }: BillDrawerProps) {
    if (!bill) return null

    const isPaid = bill.status === 'paid'
    const days = daysUntil(bill.scadenza)
    const isOverdue = !isPaid && days < 0

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
                <SheetHeader className="p-6 pb-4 border-b border-[var(--acq-ink-soft)]">
                    <SheetDescription className="text-xs font-semibold tracking-wider uppercase text-[var(--acq-ink-sub)]">
                        Bolletta #{bill.id}
                    </SheetDescription>
                    <SheetTitle className="font-[var(--acq-font-display)] text-2xl tracking-tight">
                        {fmtEur(bill.importo)}
                    </SheetTitle>
                </SheetHeader>

                <div className="flex-1 overflow-auto p-6 space-y-5">
                    {/* Status pill */}
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold
                        ${isPaid ? 'bg-[var(--acq-teal)]/10 text-[var(--acq-teal)]'
                          : isOverdue ? 'bg-[var(--acq-red)]/10 text-[var(--acq-red)]'
                          : 'bg-[var(--acq-amber)]/10 text-[var(--acq-amber)]'}`}>
                        {isPaid ? 'Pagata' : isOverdue ? `Scaduta da ${Math.abs(days)} giorni` : `Scade tra ${days} giorni`}
                    </div>

                    <dl className="grid grid-cols-2 gap-3 text-sm">
                        <Row label="Emissione">{fmtDate(bill.data_emissione)}</Row>
                        <Row label="Scadenza">{fmtDate(bill.scadenza)}</Row>
                        <Row label="Consumo">{bill.consumo} m³</Row>
                        <Row label="Fornitura">{bill.ulm ?? '—'}</Row>
                        <Row label="Cod. cliente">{bill.codice_cliente}</Row>
                        <Row label="Tipo">{bill.tipo_servizio ?? 'Idrico'}</Row>
                    </dl>

                    {/* PDF preview placeholder */}
                    <button onClick={() => onDownload?.(bill)}
                        className="w-full flex items-center gap-3 p-4 rounded-xl border border-[var(--acq-ink-soft)] hover:bg-[var(--acq-bg)] transition">
                        <div className="w-10 h-10 rounded-lg bg-[var(--acq-ink-soft)] grid place-items-center">
                            <FileText className="w-5 h-5 text-[var(--acq-ink-sub)]" />
                        </div>
                        <div className="flex-1 text-left">
                            <div className="text-sm font-semibold text-[var(--acq-ink)]">{bill.nome_pdf}.pdf</div>
                            <div className="text-xs text-[var(--acq-ink-sub)]">Scarica il documento originale</div>
                        </div>
                        <Download className="w-4 h-4 text-[var(--acq-ink-sub)]" />
                    </button>
                </div>

                {/* Sticky action bar */}
                {!isPaid && (
                    <div className="p-6 border-t border-[var(--acq-ink-soft)] flex gap-3">
                        <Button variant="outline" className="flex-1" onClick={() => onDownload?.(bill)}>
                            <Download className="w-4 h-4 mr-2" /> PDF
                        </Button>
                        <Button className="flex-1 bg-[var(--acq-deep-blue)] hover:bg-[var(--acq-deep-blue)]/90" onClick={() => onPay?.(bill)}>
                            <CreditCard className="w-4 h-4 mr-2" /> Paga {fmtEur(bill.importo)}
                        </Button>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <dt className="text-[10px] tracking-wider uppercase font-semibold text-[var(--acq-ink-sub)] mb-1">{label}</dt>
            <dd className="text-sm font-medium text-[var(--acq-ink)] tabular-nums">{children}</dd>
        </div>
    )
}
