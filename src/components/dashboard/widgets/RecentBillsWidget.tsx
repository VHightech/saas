'use client'

import { createClient } from '@/lib/supabase/client'
import { FileText, Search, Download, Calendar, Clock, Eye, Droplets, CreditCard, X, Euro, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import { format, startOfDay, endOfDay } from 'date-fns'
import { cn } from '@/lib/utils'
import { DatePicker } from '@/components/ui/date-picker'
import { SearchBar } from '@/components/ui/search-bar'
import { PagoPAPaymentModal } from '@/components/dashboard/payment/PaymentModal'

interface RecentBillsWidgetProps {
    settings?: Record<string, any>
    initialData?: any[]
}

export function RecentBillsWidget({ settings = {}, initialData = [] }: RecentBillsWidgetProps) {
    const [searchTerm, setSearchTerm] = useState('')
    const [fromDate, setFromDate] = useState<Date | null>(null)
    const [toDate, setToDate] = useState<Date | null>(null)
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)
    const [selectedBillForPayment, setSelectedBillForPayment] = useState<any | null>(null)

    const filteredInvoices = useMemo(() => {
        if (!initialData) return []
        let filtered = initialData

        if (fromDate) {
            const start = startOfDay(fromDate).getTime()
            filtered = filtered.filter(inv => {
                if (!inv.data_emissione) return false
                return new Date(inv.data_emissione).getTime() >= start
            })
        }

        if (toDate) {
            const end = endOfDay(toDate).getTime()
            filtered = filtered.filter(inv => {
                if (!inv.data_emissione) return false
                return new Date(inv.data_emissione).getTime() <= end
            })
        }

        return filtered.filter(inv =>
            (inv.nome_pdf && inv.nome_pdf.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (inv.importo && inv.importo.toString().includes(searchTerm)) ||
            (inv.numero_bolletta && inv.numero_bolletta.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (inv.idboll && inv.idboll.toString().includes(searchTerm))
        )
    }, [initialData, searchTerm, fromDate, toDate])

    const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage)
    const currentInvoices = filteredInvoices.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    )

    const isManualPayment = (method?: string) => {
        if (!method) return true
        const autoMethods = ['SDD', 'RID', 'ADDEBITO', 'SEPA', 'DOMICILIAZIONE']
        return !autoMethods.some(m => method.toUpperCase().includes(m))
    }

    return (
        <div className="flex flex-col h-full">
            {/* Table Header / Toolbar */}
            <div className="p-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-sky-50 dark:bg-sky-500/10 text-sky-500 rounded-xl flex items-center justify-center">
                        <FileText size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-extrabold text-[#0A2540] dark:text-white leading-tight">Archivio Fatture</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Storico documentale</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 ml-auto">
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-white/5 p-1 rounded-xl border border-slate-200/60 dark:border-white/10">
                        <div className="w-32">
                            <DatePicker value={fromDate} onChange={setFromDate} placeholder="Dal..." />
                        </div>
                        <div className="w-32">
                            <DatePicker value={toDate} onChange={setToDate} placeholder="Al..." />
                        </div>
                    </div>
                    <div className="relative w-48">
                        <SearchBar placeholder="Cerca..." value={searchTerm} onChange={(val) => setSearchTerm(val)} />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5">
                            <th className="p-4 pl-6">N° Bolletta</th>
                            <th className="p-4">Emissione</th>
                            <th className="p-4">Scadenza</th>
                            <th className="p-4 text-center">Consumo</th>
                            <th className="p-4 text-right">Importo</th>
                            <th className="p-4 pr-6 text-right">Azioni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                        {currentInvoices.length > 0 ? currentInvoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors group">
                                <td className="p-4 pl-6">
                                    <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                                        {inv.numero_bolletta || inv.idboll || inv.nome_pdf?.replace('.pdf', '') || inv.id}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                        <Calendar size={14} className="opacity-40" />
                                        <span className="text-[12px] font-semibold">{inv.data_emissione ? format(new Date(inv.data_emissione), 'dd/MM/yyyy') : '-'}</span>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                        <Clock size={14} className="opacity-40" />
                                        <span className="text-[12px] font-semibold">{inv.scadenza ? format(new Date(inv.scadenza), 'dd/MM/yyyy') : '-'}</span>
                                    </div>
                                </td>
                                <td className="p-4 text-center">
                                    <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-lg text-[11px] font-bold border border-sky-100 dark:border-sky-500/20 shadow-sm">
                                        <Droplets size={12} />
                                        {inv.consumo || 0} MC
                                    </div>
                                </td>
                                <td className="p-4 text-right">
                                    <div className="inline-flex flex-col items-end">
                                        {(() => {
                                            if (!inv.billing_type) return null;
                                            const type = String(inv.billing_type).trim().toUpperCase();
                                            const isSaldo = type.startsWith('S');
                                            const isAcconto = type.startsWith('A');
                                            return (
                                                <span className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${isSaldo ? 'text-blue-500' : 'text-orange-500'}`}>
                                                    {isSaldo ? 'Saldo' : isAcconto ? 'Acconto' : ''}
                                                </span>
                                            )
                                        })()}
                                        <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg text-[11px] font-bold border border-indigo-100 dark:border-indigo-500/20 shadow-sm">
                                            <Euro size={12} />
                                            € {(inv.importo || 0).toFixed(2).replace('.', ',')}
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 pr-6 text-right space-x-2">
                                    <button
                                        onClick={() => window.open(`/api/bills/${inv.id}/pdf`, '_blank')}
                                        className="h-8 w-8 rounded-lg bg-white dark:bg-white/5 text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-500/10 transition-all border border-slate-200 dark:border-white/10 shadow-sm cursor-pointer"
                                        title="Visualizza"
                                    >
                                        <Eye size={14} className="mx-auto" />
                                    </button>
                                    <button
                                        onClick={() => {
                                            const link = document.createElement('a')
                                            link.href = `/api/bills/${inv.id}/pdf`
                                            link.download = inv.nome_pdf || `bolletta_${inv.id}.pdf`
                                            link.click()
                                        }}
                                        className="h-8 w-8 rounded-lg bg-white dark:bg-white/5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all border border-slate-200 dark:border-white/10 shadow-sm cursor-pointer"
                                        title="Scarica"
                                    >
                                        <Download size={14} className="mx-auto" />
                                    </button>
                                    {inv.status === 'unpaid' && inv.expected_method === 'MP23' && (
                                        <button
                                            onClick={() => setSelectedBillForPayment(inv)}
                                            className="h-8 w-8 rounded-lg bg-white dark:bg-white/5 text-slate-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-500/10 transition-all border border-slate-200 dark:border-white/10 shadow-sm cursor-pointer"
                                            title="Paga ora"
                                        >
                                            <CreditCard size={14} className="mx-auto" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={6} className="p-10 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                                    Nessun documento trovato
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="p-4 border-t border-slate-100 dark:border-white/5 bg-slate-50/30 dark:bg-white/[0.01] flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                    <span>Mostra</span>
                    <select
                        value={itemsPerPage}
                        onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                        className="bg-white dark:bg-[#1A1D23] border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 outline-none focus:border-sky-500 cursor-pointer font-bold text-slate-600 dark:text-slate-300 shadow-sm"
                    >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                    </select>
                    <span>risultati</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[12px] font-bold text-slate-400">
                        Pagina <span className="text-slate-700 dark:text-slate-200">{currentPage}</span> di {totalPages || 1}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-white/10 transition-all shadow-sm cursor-pointer"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <button
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-white/10 transition-all shadow-sm cursor-pointer"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            </div>

            <PagoPAPaymentModal
                isOpen={!!selectedBillForPayment}
                bill={selectedBillForPayment}
                onClose={() => setSelectedBillForPayment(null)}
                onSuccess={() => {/* Refetch logic handled by parent via initialData sync if needed */}}
            />
        </div>
    )
}
