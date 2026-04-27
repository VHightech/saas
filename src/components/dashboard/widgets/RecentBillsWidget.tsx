'use client'

import { createClient } from '@/lib/supabase/client'
import { FileText, FileDown, Search, Download, ArrowUpDown, ArrowUp, ArrowDown, AlertCircle, CheckCircle, Eye, Droplets, Zap, CreditCard, X, ListFilter } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { parse } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { DatePicker } from '@/components/ui/date-picker'
import { PagoPAPaymentModal } from '@/components/dashboard/payment/PaymentModal'

// Client initialized inside component or imported as singleton from lib


type Bill = {
    id: number
    emission: string
    cif: string
    expiry: string
    amount: string
    consumption: string
    nome_pdf: string
    pdf_url: string | null
    idboll?: number
    ulm?: string
    billing_type?: string
    expected_method?: string
    raw_emission: Date
    // Mock status for demo
    status?: 'paid' | 'unpaid' | string
}

interface RecentBillsWidgetProps {
    settings?: Record<string, any>
    initialData?: Bill[] | any[]
}

export function RecentBillsWidget({ settings = {}, initialData = [] }: RecentBillsWidgetProps) {
    const limitSetting = parseInt(settings.limit || '10')
    const showStatus = settings.show_status ?? true
    const [documents, setDocuments] = useState<Bill[]>([])
    const [currentDate, setCurrentDate] = useState<Date | null>(null)
    const [sortConfig, setSortConfig] = useState<{ key: 'cif' | 'expiry' | null, direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' })
    const [searchTerm, setSearchTerm] = useState('')
    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')
    const [loading, setLoading] = useState(true)
    const [selectedBillForPayment, setSelectedBillForPayment] = useState<Bill | null>(null)
    const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('all')
    const [isSearchExpanded, setIsSearchExpanded] = useState(false)
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const searchInputRef = useRef<HTMLInputElement>(null)
    const supabase = createClient()

    useEffect(() => {
        setCurrentDate(new Date())

        if (initialData) {
            console.log('[Debug] Mapping initialData, first bill billing_type:', initialData[0]?.billing_type);
            const mappedBills = initialData.map((bill: any, index) => ({
                id: bill.id,
                emission: new Date(bill.data_emissione).toLocaleDateString('it-IT'),
                cif: bill.cif || bill.codice_cliente,
                expiry: new Date(bill.scadenza).toLocaleDateString('it-IT'),
                amount: `€ ${bill.importo?.toFixed(2).replace('.', ',')}`,
                consumption: `${bill.consumo?.toFixed(2).replace('.', ',')}`,
                nome_pdf: bill.nome_pdf,
                pdf_url: bill.pdf_url,
                idboll: bill.idboll,
                ulm: bill.ulm,
                billing_type: bill.billing_type || bill.payment_type, // Fallback if legacy field exists
                expected_method: bill.expected_method || bill.payment_method,
                raw_emission: new Date(bill.data_emissione),
                status: bill.status || 'unpaid'
            }))
            setDocuments(mappedBills)
            setLoading(false)
        } else if (!initialData) {
            fetchBills()
        }
    }, [initialData])

    const fetchBills = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()

            let query = supabase
                .from('bills')
                .select('*')
                .order('data_emissione', { ascending: false })

            if (user) {
                query = query.eq('user_id', user.id)
            }

            const { data, error } = await query

            if (error) {
                console.error('Error fetching bills:', error)
                return
            }

            if (data) {
                console.log('[Debug] fetchBills success, first bill billing_type:', data[0]?.billing_type);
                const mappedBills = data.map((bill: any) => ({
                    id: bill.id,
                    emission: new Date(bill.data_emissione).toLocaleDateString('it-IT'),
                    cif: bill.cif || bill.codice_cliente,
                    expiry: new Date(bill.scadenza).toLocaleDateString('it-IT'),
                    amount: `€ ${bill.importo?.toFixed(2).replace('.', ',')}`,
                    consumption: `${bill.consumo?.toFixed(2).replace('.', ',')}`,
                    nome_pdf: bill.nome_pdf,
                    pdf_url: bill.pdf_url,
                    idboll: bill.idboll,
                    ulm: bill.ulm,
                    billing_type: bill.billing_type || bill.payment_type,
                    expected_method: bill.expected_method,
                    raw_emission: new Date(bill.data_emissione),
                    status: bill.status || 'unpaid'
                }))
                setDocuments(mappedBills)
            }
        } catch (error) {
            console.error('Error:', error)
        } finally {
            setLoading(false)
        }
    }

    const parseDate = (dateStr: string) => {
        // Italian format dd/mm/yyyy
        const parts = dateStr.split('/');
        if (parts.length !== 3) return new Date();
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        return new Date(year, month, day);
    };

    const handleSort = (key: 'cif' | 'expiry') => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleDownload = (id: number, url: string | null) => {
        if (url) {
            window.open(`/api/bills/${id}/pdf`, '_blank');
        } else {
            alert('PDF non disponibile');
        }
    };

    const filteredDocuments = documents.filter(doc => {
        // Status Filter
        if (statusFilter === 'unpaid' && doc.status === 'paid') return false;
        if (statusFilter === 'paid' && doc.status !== 'paid') return false;

        // Date Range Filter
        if (fromDate) {
            const start = new Date(fromDate)
            start.setHours(0, 0, 0, 0)
            if (doc.raw_emission < start) return false
        }
        if (toDate) {
            const end = new Date(toDate)
            end.setHours(23, 59, 59, 999)
            if (doc.raw_emission > end) return false
        }

        // Search Filter
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            return (
                doc.cif.toLowerCase().includes(searchLower) ||
                doc.amount.toLowerCase().includes(searchLower) ||
                doc.consumption.toLowerCase().includes(searchLower) ||
                doc.emission.includes(searchTerm) ||
                doc.expiry.includes(searchTerm)
            );
        }

        return true;
    });

    const sortedDocuments = [...filteredDocuments].sort((a, b) => {
        if (!sortConfig.key) return 0;

        let aValue: any = a[sortConfig.key];
        let bValue: any = b[sortConfig.key];

        if (sortConfig.key === 'expiry') {
            aValue = parseDate(a.expiry).getTime();
            bValue = parseDate(b.expiry).getTime();
        }

        if (aValue < bValue) {
            return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
            return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });


    const isManualPayment = (method?: string) => {
        if (!method) return true
        const autoMethods = ['SDD', 'RID', 'ADDEBITO', 'SEPA', 'DOMICILIAZIONE']
        return !autoMethods.some(m => method.toUpperCase().includes(m))
    }


    const [visibleCount, setVisibleCount] = useState(limitSetting)

    // Sync visibleCount if limitSetting changes (e.g. in preview)
    useEffect(() => {
        setVisibleCount(limitSetting)
    }, [limitSetting])

    const handleShowMore = () => {
        setVisibleCount(prev => prev + 10)
    }

    const visibleDocuments = sortedDocuments.slice(0, visibleCount)

    // Vertical Dropdown Options Definition
    const StatusFilterOptions = (
        <div className="flex flex-col min-w-[180px] p-1.5">
            <button
                onClick={() => { setStatusFilter('all'); setIsFilterOpen(false); }}
                className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all w-full",
                    statusFilter === 'all'
                        ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-700 dark:hover:text-slate-200"
                )}
            >
                <div className={`w-1.5 h-1.5 rounded-full ${statusFilter === 'all' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                Tutte
            </button>
            <button
                onClick={() => { setStatusFilter('unpaid'); setIsFilterOpen(false); }}
                className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all w-full",
                    statusFilter === 'unpaid'
                        ? "bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white"
                        : "text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-700 dark:hover:text-slate-200"
                )}
            >
                <div className={`w-1.5 h-1.5 rounded-full ${statusFilter === 'unpaid' ? 'bg-slate-800 dark:bg-white' : 'bg-slate-300'}`} />
                Da Pagare
            </button>
            <button
                onClick={() => { setStatusFilter('paid'); setIsFilterOpen(false); }}
                className={cn(
                    "flex items-center gap-3 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all w-full",
                    statusFilter === 'paid'
                        ? "bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white"
                        : "text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-700 dark:hover:text-slate-200"
                )}
            >
                <div className={`w-1.5 h-1.5 rounded-full ${statusFilter === 'paid' ? 'bg-slate-800 dark:bg-white' : 'bg-slate-300'}`} />
                Pagate
            </button>
        </div>
    );

    return (
        <div className="bg-[#D4E8E1]/60 dark:bg-[#1e1e1e]/60 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-3xl p-6 h-full text-slate-800 dark:text-slate-200 shadow-sm flex flex-col transition-colors duration-500">
            {/* --- TOP HEADER ROW (Unified Search & Dates - Full Width) --- */}
            <div className="flex items-center w-full mb-6 relative z-30">
                <div className="flex items-center w-full bg-white/95 dark:bg-[#1a1a1a]/80 backdrop-blur-md rounded-2xl h-11 text-slate-800 dark:text-slate-200 transition-all duration-300">
                    {/* Search Section */}
                    <div className="flex items-center flex-1 min-w-[200px] h-full px-4 gap-3">
                        <Search className="w-4 h-4 text-emerald-600/70 dark:text-emerald-400/70" strokeWidth={3} />
                        <input
                            type="text"
                            placeholder="Cerca per numero bolletta o nome file..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-transparent w-full text-[11px] font-black focus:outline-none placeholder:text-slate-400 uppercase tracking-widest"
                        />
                    </div>

                    {/* Date Range Section */}
                    <div className="flex items-center px-4 gap-2 h-full">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Dal</span>
                            <div className="w-[120px]">
                                <DatePicker
                                    value={fromDate}
                                    onChange={(date) => setFromDate(date ? date.toISOString() : '')}
                                    placeholder="--"
                                    className="!bg-transparent !border-none !shadow-none !text-[11px] !font-bold hover:!bg-slate-100/50 dark:hover:!bg-white/5 !transition-colors !h-9 !rounded-xl"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Al</span>
                            <div className="w-[120px]">
                                <DatePicker
                                    value={toDate}
                                    onChange={(date) => setToDate(date ? date.toISOString() : '')}
                                    placeholder="--"
                                    className="!bg-transparent !border-none !shadow-none !text-[11px] !font-bold hover:!bg-slate-100/50 dark:hover:!bg-white/5 !transition-colors !h-9 !rounded-xl"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Reset Button (Only if filters active) */}
                    {(searchTerm || fromDate || toDate) && (
                        <button
                            onClick={() => { setSearchTerm(''); setFromDate(''); setToDate(''); }}
                            className="flex items-center justify-center w-12 h-full text-slate-400 hover:text-red-500 hover:bg-red-50/50 dark:hover:bg-red-500/10 transition-all rounded-r-2xl"
                        >
                            <X size={18} strokeWidth={3} />
                        </button>
                    )}
                </div>
            </div>


            <div className="flex-1 -mx-2 px-2 custom-scrollbar rounded-t-2xl overflow-hidden flex flex-col min-h-0">
                <div className="flex flex-col w-full h-full">
                    {/* Desktop Header - Emerald Pro Header */}
                    <div className="hidden md:flex w-full items-center mb-3 text-[11px] font-black uppercase tracking-[0.15em]">
                        <div className="flex-[4.5] flex items-center px-4 py-2 bg-emerald-600 dark:bg-emerald-600/40 rounded-xl shadow-sm border border-emerald-500/20 text-emerald-50">
                            <div className="w-[90px] text-left">Emissione</div>
                            <div className="w-[100px] flex justify-center cursor-pointer group hover:text-white transition-colors items-center gap-1" onClick={() => handleSort('expiry')}>
                                Scadenza
                                {sortConfig.key === 'expiry' && (
                                    sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                                )}
                            </div>
                            <div className="w-[160px] text-center">N. Bolletta</div>
                            <div className="w-[85px] text-center">Consumo</div>
                            <div className="w-[90px] text-center">Importo</div>
                            <div className="flex-1 flex justify-end relative">
                                <button
                                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all",
                                        isFilterOpen
                                            ? "bg-white text-emerald-700 shadow-lg"
                                            : "bg-emerald-500/30 text-emerald-50 hover:bg-emerald-500/50"
                                    )}
                                >
                                    <ListFilter size={14} strokeWidth={2.5} />
                                    Filtra
                                </button>

                                {/* Floating Dropdown Menu */}
                                <AnimatePresence>
                                    {isFilterOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                            className="absolute top-full right-0 mt-2 z-[100] bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden min-w-[200px]"
                                        >
                                            {StatusFilterOptions}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto w-full custom-scrollbar space-y-2.5 pt-1">
                        {loading ? (
                            <div className="text-center py-20 text-slate-400 animate-pulse font-medium">Caricamento fatture in corso...</div>
                        ) : sortedDocuments.length === 0 ? (
                            <div className="text-center py-20 text-slate-400 font-medium bg-slate-50/50 dark:bg-white/5 rounded-2xl border border-dashed border-slate-200 dark:border-white/10">Nessuna fattura trovata</div>
                        ) : (
                            <>
                                {/* Desktop Table Rows - Compact Layout */}
                                <div className="hidden md:block space-y-2.5">
                                    {visibleDocuments.map((doc) => {
                                        const isExpired = currentDate ? parseDate(doc.expiry) < currentDate : false;
                                        const isUnpaid = doc.status === 'unpaid';

                                        return (
                                            <div key={doc.id} className="flex items-center gap-3 w-full group">
                                                {/* Left Block: Data Pill */}
                                                <div className="flex-[4.5] flex items-center px-4 py-2.5 bg-white dark:bg-[#111] rounded-2xl border border-slate-100 dark:border-white/5 group-hover:border-emerald-500/30 transition-all duration-200">
                                                    <div className="w-[90px]">
                                                        <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-tight">{doc.emission}</span>
                                                    </div>

                                                    <div className="w-[100px] flex justify-start">
                                                        <div className={`px-3 py-1 rounded-full text-[10px] font-black border transition-colors ${isExpired
                                                            ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
                                                            : 'bg-slate-50 text-slate-600 border-slate-100 dark:bg-white/5 dark:text-slate-400 dark:border-white/10'
                                                            }`}>
                                                            {doc.expiry}
                                                        </div>
                                                    </div>

                                                    <div className="w-[160px] text-center">
                                                        <span className="text-[15px] font-mono text-slate-800 dark:text-slate-200 font-bold truncate block">{doc.idboll || doc.nome_pdf?.replace('.pdf', '')}</span>
                                                    </div>

                                                    <div className="w-[85px] flex justify-center">
                                                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                                                            <Droplets size={14} className="text-indigo-600 dark:text-indigo-400 fill-indigo-200/50 dark:fill-indigo-500/10" />
                                                            {doc.consumption}
                                                        </div>
                                                    </div>

                                                    <div className="w-[90px] flex flex-col items-center justify-center">
                                                        {(() => {
                                                            if (!doc.billing_type) return null;
                                                            const type = String(doc.billing_type).trim().toUpperCase();
                                                            const isSaldo = type.startsWith('S');
                                                            const isAcconto = type.startsWith('A');
                                                            if (!isSaldo && !isAcconto) return null;
                                                            return (
                                                                <span className={`text-[10px] font-black uppercase tracking-[0.1em] mb-0.5 ${isSaldo
                                                                    ? 'text-blue-600/90 dark:text-blue-400'
                                                                    : 'text-orange-500/90 dark:text-orange-400'
                                                                    }`}>
                                                                    {isSaldo ? 'Saldo' : 'Acconto'}
                                                                </span>
                                                            );
                                                        })()}
                                                        <span className="text-sm font-black text-slate-900 dark:text-white tracking-tighter">{doc.amount}</span>
                                                    </div>
                                                </div>

                                                {/* Right: Floating Buttons */}
                                                <div className="flex-1 flex items-center justify-end pr-2 group-hover:opacity-100 transition-opacity">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleDownload(doc.id, doc.pdf_url)}
                                                            className="p-2 rounded-xl text-slate-400 hover:text-purple-500 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-purple-200 dark:hover:border-purple-500/30 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-all"
                                                            title="Visualizza PDF"
                                                        >
                                                            <Eye size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                const link = document.createElement('a');
                                                                link.href = doc.pdf_url || '#';
                                                                link.download = doc.nome_pdf || 'bolletta.pdf';
                                                                link.target = '_blank';
                                                                document.body.appendChild(link);
                                                                link.click();
                                                                document.body.removeChild(link);
                                                            }}
                                                            className="p-2 rounded-xl text-slate-400 hover:text-emerald-500 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-emerald-200 dark:hover:border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all"
                                                            title="Scarica PDF"
                                                        >
                                                            <FileDown size={18} />
                                                        </button>
                                                        {isUnpaid ? (
                                                            doc.expected_method === 'MP23' && (
                                                                <button
                                                                    onClick={() => setSelectedBillForPayment(doc)}
                                                                    className="p-2 rounded-xl text-slate-400 hover:text-sky-500 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-sky-200 dark:hover:border-sky-500/30 hover:bg-sky-50 dark:hover:bg-sky-500/10 transition-all"
                                                                    title="Paga ora"
                                                                >
                                                                    <CreditCard size={18} />
                                                                </button>
                                                            )
                                                        ) : (
                                                            <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-xl flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-[11px] uppercase pr-3">
                                                                <CheckCircle size={15} />
                                                                OK
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Mobile Cards - Neutral & Professional */}
                                <div className="md:hidden space-y-4 pb-4">
                                    {visibleDocuments.map((doc) => {
                                        const isExpired = currentDate ? parseDate(doc.expiry) < currentDate : false;
                                        const isUnpaid = doc.status === 'unpaid';

                                        return (
                                            <div key={doc.id} className="bg-white dark:bg-[#111] rounded-3xl border border-slate-100 dark:border-white/5 overflow-hidden p-5">
                                                {/* Header: ID and Amount */}
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] uppercase text-slate-400 font-black tracking-widest mb-1">Bolletta</span>
                                                        <span className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                                                            {doc.idboll || doc.nome_pdf?.replace('.pdf', '')}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">{doc.amount}</span>
                                                        {(() => {
                                                            if (!doc.billing_type) return null;
                                                            const type = doc.billing_type.trim().toUpperCase();
                                                            const isSaldo = type.startsWith('S');
                                                            const isAcconto = type.startsWith('A');
                                                            return (
                                                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md mt-1 ${isSaldo
                                                                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
                                                                    : 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400'
                                                                    }`}>
                                                                    {isSaldo ? 'Saldo' : 'Acconto'}
                                                                </span>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>

                                                {/* Info Grid */}
                                                <div className="grid grid-cols-2 gap-4 mb-5 p-4 bg-slate-50/50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-[9px] uppercase text-slate-400 font-bold">Emissione</span>
                                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{doc.emission}</span>
                                                    </div>
                                                    <div className="flex flex-col gap-1 text-right">
                                                        <span className="text-[9px] uppercase text-slate-400 font-bold">Consumo</span>
                                                        <div className="flex items-center justify-end gap-1 text-xs font-bold text-slate-700 dark:text-slate-300">
                                                            <Droplets size={12} className="text-indigo-600 dark:text-indigo-400 fill-indigo-200/50 dark:fill-indigo-500/20" />
                                                            {doc.consumption} <span className="opacity-40 font-medium">mc</span>
                                                        </div>
                                                    </div>
                                                    <div className="col-span-2 pt-2 border-t border-slate-200/50 dark:border-white/5">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-[9px] uppercase text-slate-400 font-bold">Scadenza</span>
                                                            <span className={`text-xs font-bold ${isExpired ? 'text-red-500' : 'text-emerald-500'}`}>
                                                                {isExpired ? 'Scaduta' : 'Entro il'} {doc.expiry}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleDownload(doc.id, doc.pdf_url)}
                                                        className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2"
                                                    >
                                                        <Eye size={16} /> PDF
                                                    </button>
                                                    {isUnpaid && doc.expected_method === 'MP23' ? (
                                                        <button
                                                            onClick={() => setSelectedBillForPayment(doc)}
                                                            className="flex-[1.5] py-3 rounded-2xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                                                        >
                                                            <CreditCard size={16} /> PAGA ORA
                                                        </button>
                                                    ) : !isUnpaid && (
                                                        <div className="flex-1 flex items-center justify-center gap-2 text-emerald-500 font-bold text-xs uppercase">
                                                            <CheckCircle size={16} /> Pagata
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {
                                    visibleCount < sortedDocuments.length && (
                                        <div className="flex justify-center pb-4">
                                            <button
                                                onClick={handleShowMore}
                                                className="px-6 py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 rounded-full text-xs font-bold transition-all border border-slate-200 dark:border-white/10 active:scale-95 flex items-center gap-2"
                                            >
                                                <ArrowDown size={14} />
                                                Mostra altro
                                            </button>
                                        </div>
                                    )
                                }
                            </>
                        )}
                    </div>
                </div>
            </div>

            <PagoPAPaymentModal
                isOpen={!!selectedBillForPayment}
                bill={selectedBillForPayment}
                onClose={() => setSelectedBillForPayment(null)}
                onSuccess={fetchBills}
            />

        </div >
    )
}
