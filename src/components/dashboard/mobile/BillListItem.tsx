'use client'

import React from 'react'
import { FileText, CheckCircle2, Droplets } from 'lucide-react'
import { cn } from '@/lib/utils'
import { billingTypeDisplay, DASHBOARD_TONE_CLASS } from '@/lib/billing-type'
import { PAGOPA_ENABLED } from '@/lib/features'
import type { Bill } from '@/types/dashboard'

interface BillListItemProps {
    bill: Bill
    onSelect?: (bill: Bill) => void
    monthYear: (date: string) => string
    formatEuro: (n: number) => string
}

export function BillListItem({ bill, onSelect, monthYear, formatEuro }: BillListItemProps) {
    const isPaid = bill.status === 'paid'
    const billNumber = bill.idboll || bill.nome_pdf?.replace('.pdf', '') || bill.id
    const bt = billingTypeDisplay(bill.billing_type)

    return (
        <button
            onClick={() => onSelect?.(bill)}
            className="w-full text-left flex items-center gap-3 px-4 py-4 active:bg-slate-50 dark:active:bg-white/5 transition-colors"
        >
            <div className={cn(
                'w-[3rem] h-[3rem] rounded-[1rem] flex items-center justify-center shrink-0 transition-all duration-300',
                isPaid ? 'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-slate-100 dark:bg-white/5 text-[#1E5BFF] dark:text-[#93C5FD]'
            )}>
                {isPaid ? <CheckCircle2 size={22} strokeWidth={2.5} /> : <FileText size={22} strokeWidth={2} />}
            </div>
            
            <div className="flex-1 min-w-0">
                <p className="text-[17px] font-bold text-[#0A2540] dark:text-white capitalize truncate mb-1">
                    {monthYear(bill.data_emissione)}
                </p>
                <p className="text-[14px] text-slate-500 dark:text-slate-400 font-medium font-mono tracking-tight mb-0.5">
                    {billNumber}
                </p>
                <p className="text-[13px] text-slate-400 font-bold font-mono uppercase tracking-widest opacity-80 flex items-center gap-1.5">
                    <Droplets size={13} className="text-[#1E5BFF] dark:text-[#93C5FD] shrink-0" fill="currentColor" fillOpacity={0.25} />
                    {bill.consumo || 0} mc
                </p>
            </div>
            
            <div className="text-right flex flex-col items-end gap-1.5 shrink-0 max-w-[40%]">
                <p className="text-[17px] font-bold text-[#0A2540] dark:text-white tracking-tight leading-none">
                    {formatEuro(Number(bill.importo || 0))}
                </p>
                {bt && (
                    <span
                        className={cn(
                            "text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded text-right leading-tight whitespace-normal break-words",
                            DASHBOARD_TONE_CLASS[bt.tone]
                        )}
                        title={bt.label}
                    >
                        {bt.short}
                    </span>
                )}
                {PAGOPA_ENABLED && !isPaid && bill.expected_method === 'MP23' && (
                    <span className="text-[11px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#93C5FD] text-[#0A2540] whitespace-nowrap">
                        Da pagare
                    </span>
                )}
            </div>
        </button>
    )
}
