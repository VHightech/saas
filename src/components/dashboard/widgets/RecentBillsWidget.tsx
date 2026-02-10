'use client'

import { createClient } from '@/lib/supabase/client'
import { FileText, FileDown, Search, Download, ArrowUpDown, ArrowUp, ArrowDown, AlertCircle, CheckCircle, Eye } from 'lucide-react'
import { useState, useEffect } from 'react'
import { parse } from 'date-fns'
import { cn } from '@/lib/utils'
import { DatePicker } from '@/components/ui/date-picker'

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
    raw_emission: Date
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
    const supabase = createClient()

    useEffect(() => {
        setCurrentDate(new Date())

        if (initialData && initialData.length > 0) {
            const mappedBills = initialData.map((bill: any) => ({
                id: bill.id,
                emission: new Date(bill.data_emissione).toLocaleDateString('it-IT'),
                cif: bill.cif || bill.codice_cliente,
                expiry: new Date(bill.scadenza).toLocaleDateString('it-IT'),
                amount: `€ ${bill.importo?.toFixed(2).replace('.', ',')}`,
                consumption: `${bill.consumo?.toFixed(2).replace('.', ',')} Mc`,
                nome_pdf: bill.nome_pdf,
                pdf_url: bill.pdf_url,
                raw_emission: new Date(bill.data_emissione)
            }))
            setDocuments(mappedBills)
            setLoading(false)
        } else {
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
            // If no user, show nothing or all? 
            // For safety, let's keep it restricted to authenticated user, 
            // unless we want to show everything during dev. 
            // Given the demo context, I'll allow fetching all if no user is logged in, 
            // BUT usually RLS prevents this. 
            // I'll assume standard behavior: if no user, RLS gives empty.

            const { data, error } = await query

            if (error) {
                console.error('Error fetching bills:', error)
                return
            }

            if (data) {
                const mappedBills = data.map((bill: any) => ({
                    id: bill.id,
                    emission: new Date(bill.data_emissione).toLocaleDateString('it-IT'),
                    cif: bill.cif || bill.codice_cliente,
                    expiry: new Date(bill.scadenza).toLocaleDateString('it-IT'),
                    amount: `€ ${bill.importo?.toFixed(2).replace('.', ',')}`,
                    consumption: `${bill.consumo?.toFixed(2).replace('.', ',')} Mc`,
                    nome_pdf: bill.nome_pdf,
                    pdf_url: bill.pdf_url,
                    raw_emission: new Date(bill.data_emissione)
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

    const filteredDocuments = documents.filter(doc => {
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

        return (
            doc.cif.toLowerCase().includes(searchTerm.toLowerCase()) ||
            doc.amount.toLowerCase().includes(searchTerm.toLowerCase()) ||
            doc.consumption.toLowerCase().includes(searchTerm.toLowerCase()) ||
            doc.emission.includes(searchTerm) ||
            doc.expiry.includes(searchTerm)
        )
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

    const handleDownload = (url: string | null) => {
        if (url) {
            window.open(url, '_blank');
        } else {
            alert('PDF non disponibile');
        }
    };


    const [visibleCount, setVisibleCount] = useState(limitSetting)

    // Sync visibleCount if limitSetting changes (e.g. in preview)
    useEffect(() => {
        setVisibleCount(limitSetting)
    }, [limitSetting])

    const handleShowMore = () => {
        setVisibleCount(prev => prev + 10)
    }

    const visibleDocuments = sortedDocuments.slice(0, visibleCount)

    return (
        <div className="bg-[#D4E8E1]/60 dark:bg-[#1e1e1e]/60 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-3xl p-6 h-full text-slate-800 dark:text-slate-200 shadow-sm flex flex-col transition-colors duration-500">
            {/* Filter Toolbar (Mobile & Desktop) */}
            <div className="w-full mb-4 flex flex-col md:flex-row gap-3 items-center justify-between relative z-20">
                {/* Date Filters */}
                <div className="flex gap-2 w-full md:w-auto flex-wrap items-center">
                    <div className="flex items-center gap-2">
                        <DatePicker
                            value={fromDate}
                            onChange={(date) => setFromDate(date ? date.toISOString() : '')}
                            placeholder="Dal..."
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <DatePicker
                            value={toDate}
                            onChange={(date) => setToDate(date ? date.toISOString() : '')}
                            placeholder="Al..."
                        />
                    </div>
                    {(fromDate || toDate) && (
                        <button
                            onClick={() => { setFromDate(''); setToDate('') }}
                            className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white underline transition-colors"
                        >
                            Reset
                        </button>
                    )}
                </div>

                {/* Search Bar - Visible on Mobile & Desktop */}
                <div className="relative w-full md:flex-1 ml-0 md:ml-3">
                    <div className="relative group w-full">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-400 group-focus-within:bg-sky-500 group-focus-within:text-white transition-all duration-300 z-10">
                            <Search size={14} strokeWidth={2.5} />
                        </div>
                        <input
                            type="text"
                            placeholder="Cerca fattura..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full py-2.5 pl-12 pr-4 text-xs font-bold focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 ring-sky-500/10 outline-none transition-all placeholder:text-slate-500 dark:placeholder:text-slate-400 dark:text-slate-100 shadow-sm hover:shadow-md hover:border-sky-200 dark:hover:border-sky-800"
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 -mx-2 px-2 custom-scrollbar rounded-t-2xl overflow-hidden flex flex-col min-h-0">
                <div className="flex flex-col w-full h-full">
                    {/* Desktop Header */}
                    <div className="hidden md:flex w-[96%] mx-auto z-10">
                        <div className="flex-1 py-3 pl-4 bg-[#D4E8E1]/80 dark:bg-[#1e1e1e]/80 backdrop-blur-3xl text-left text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400 rounded-tl-2xl rounded-bl-2xl flex items-center">Emissione</div>

                        <div className="flex-1 py-3 bg-[#D4E8E1]/80 dark:bg-[#1e1e1e]/80 backdrop-blur-3xl text-center text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400 cursor-pointer group hover:text-slate-700 dark:hover:text-slate-200 transition-colors flex items-center justify-center gap-1" onClick={() => handleSort('expiry')}>
                            Scadenza
                            {sortConfig.key === 'expiry' ? (
                                sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                            ) : (
                                <ArrowUpDown size={14} className="opacity-0 group-hover:opacity-50 transition-opacity" />
                            )}
                        </div>

                        <div className="flex-1 py-3 bg-[#D4E8E1]/80 dark:bg-[#1e1e1e]/80 backdrop-blur-3xl text-center text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400 cursor-pointer group hover:text-slate-700 dark:hover:text-slate-200 transition-colors flex items-center justify-center gap-1" onClick={() => handleSort('cif')}>
                            Bolletta
                            {sortConfig.key === 'cif' ? (
                                sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                            ) : (
                                <ArrowUpDown size={14} className="opacity-0 group-hover:opacity-50 transition-opacity" />
                            )}
                        </div>

                        <div className="flex-1 py-3 bg-[#D4E8E1]/80 dark:bg-[#1e1e1e]/80 backdrop-blur-3xl text-center text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400 flex items-center justify-center">Importo</div>
                        <div className="flex-1 py-3 bg-[#D4E8E1]/80 dark:bg-[#1e1e1e]/80 backdrop-blur-3xl text-center text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400 flex items-center justify-center">Consumo</div>
                        <div className="flex-1 py-3 pr-4 bg-[#D4E8E1]/80 dark:bg-[#1e1e1e]/80 backdrop-blur-3xl text-center text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400 rounded-tr-2xl rounded-br-2xl flex items-center justify-center">

                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto w-full custom-scrollbar space-y-3 pt-3">
                        {loading ? (
                            <div className="text-center py-10 text-slate-500 dark:text-slate-400">Caricamento fatture...</div>
                        ) : sortedDocuments.length === 0 ? (
                            <div className="text-center py-10 text-slate-500 dark:text-slate-400">Nessuna fattura trovata</div>
                        ) : (
                            <>
                                {/* Desktop Table Rows */}
                                <div className="hidden md:block space-y-3">
                                    {visibleDocuments.map((doc) => {
                                        const isExpired = currentDate ? parseDate(doc.expiry) < currentDate : false;

                                        return (
                                            <div key={doc.id} className="flex w-[96%] mx-auto relative group hover:scale-[1.002] hover:z-10 transition-all duration-200">
                                                <div className="flex-1 py-2 pl-4 bg-white/40 dark:bg-white/5 group-hover:bg-white/70 dark:group-hover:bg-white/10 rounded-l-xl border-y border-l border-white/20 dark:border-white/5 flex items-center">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-500/20">
                                                        {doc.emission}
                                                    </span>
                                                </div>
                                                <div className="flex-1 py-2 bg-white/40 dark:bg-white/5 group-hover:bg-white/70 dark:group-hover:bg-white/10 border-y border-white/20 dark:border-white/5 flex items-center justify-center">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${isExpired
                                                        ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-100 dark:border-red-500/20'
                                                        : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20'
                                                        }`}>
                                                        {doc.expiry}
                                                    </span>
                                                </div>
                                                <div className="flex-1 py-2 bg-white/40 dark:bg-white/5 group-hover:bg-white/70 dark:group-hover:bg-white/10 border-y border-white/20 dark:border-white/5 text-sm text-slate-500 dark:text-slate-300 flex items-center justify-center font-medium">{doc.nome_pdf}</div>
                                                <div className="flex-1 py-2 bg-white/40 dark:bg-white/5 group-hover:bg-white/70 dark:group-hover:bg-white/10 border-y border-white/20 dark:border-white/5 font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center justify-center">{doc.amount}</div>
                                                <div className="flex-1 py-2 bg-white/40 dark:bg-white/5 group-hover:bg-white/70 dark:group-hover:bg-white/10 border-y border-white/20 dark:border-white/5 font-medium text-slate-800 dark:text-slate-200 text-sm flex items-center justify-center">{doc.consumption}</div>
                                                <div className="flex-1 py-2 pr-4 bg-white/40 dark:bg-white/5 group-hover:bg-white/70 dark:group-hover:bg-white/10 rounded-r-xl border-y border-r border-white/20 dark:border-white/5 text-center flex items-center justify-center">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => handleDownload(doc.pdf_url)}
                                                            className="p-1.5 rounded-lg transition-all shadow-sm btn-glass btn-glass-sky cursor-pointer"
                                                            title="Vedi PDF"
                                                        >
                                                            <Eye size={16} strokeWidth={2.5} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDownload(doc.pdf_url)}
                                                            className="p-1.5 rounded-lg transition-all shadow-sm btn-glass btn-glass-emerald cursor-pointer"
                                                            title="Scarica PDF"
                                                        >
                                                            <FileDown size={16} strokeWidth={2.5} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Mobile Cards */}
                                <div className="md:hidden space-y-4 pb-4">
                                    {visibleDocuments.map((doc) => {
                                        const isExpired = currentDate ? parseDate(doc.expiry) < currentDate : false;
                                        return (
                                            <div key={doc.id} className="bg-white/60 dark:bg-white/5 backdrop-blur-md rounded-2xl border border-white/50 dark:border-white/10 shadow-sm overflow-hidden transform transition-all duration-200">

                                                {/* Top Section: Main Info */}
                                                <div className="px-4 pt-3 pb-2">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold tracking-wider mb-0.5">Bolletta</span>
                                                            <span className="font-mono text-slate-900 dark:text-slate-200 font-bold text-sm tracking-tight">{doc.nome_pdf}</span>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold tracking-wider block mb-0.5">Importo</span>
                                                            <span className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">{doc.amount}</span>
                                                        </div>
                                                    </div>

                                                    {/* Data Grid */}
                                                    <div className="grid grid-cols-2 gap-2 py-1.5 border-t border-slate-100/80 dark:border-white/10">
                                                        <div>
                                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block mb-0.5">Emissione</span>
                                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-500/20">
                                                                {doc.emission}
                                                            </span>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block mb-0.5">Consumo</span>
                                                            <span className="text-base font-bold text-[#005A9C] dark:text-sky-400 bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-md inline-block border border-blue-100/50 dark:border-blue-500/20">{doc.consumption}</span>
                                                        </div>
                                                        <div>
                                                            {showStatus && (
                                                                <>
                                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block mb-0.5">Scadenza</span>
                                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border w-fit ${isExpired
                                                                        ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-100 dark:border-red-500/20'
                                                                        : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20'
                                                                        }`}>
                                                                        {isExpired ? (
                                                                            <><AlertCircle size={12} className="mr-1" /> {doc.expiry}</>
                                                                        ) : (
                                                                            <><CheckCircle size={12} className="mr-1" /> {doc.expiry}</>
                                                                        )}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Footer Actions */}
                                                <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700/50">
                                                    <div className="flex items-center gap-3 w-full">
                                                        <button
                                                            onClick={() => handleDownload(doc.pdf_url)}
                                                            className="flex-1 py-2.5 rounded-xl transition-all shadow-sm btn-glass btn-glass-sky cursor-pointer flex items-center justify-center gap-2"
                                                        >
                                                            <Eye size={18} strokeWidth={2.5} />
                                                            <span className="text-xs font-bold uppercase tracking-wide">Vedi</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDownload(doc.pdf_url)}
                                                            className="flex-1 py-2.5 rounded-xl transition-all shadow-sm btn-glass btn-glass-emerald cursor-pointer flex items-center justify-center gap-2"
                                                        >
                                                            <FileDown size={18} strokeWidth={2.5} />
                                                            <span className="text-xs font-bold uppercase tracking-wide">Scarica</span>
                                                        </button>
                                                    </div>
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
                                                className="px-6 py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 rounded-full text-xs font-bold transition-all shadow-sm hover:shadow-md border border-slate-200 dark:border-white/10 active:scale-95 flex items-center gap-2"
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


        </div >
    )
}
