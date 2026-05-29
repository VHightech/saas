'use client'

import { useMemo, useState, useLayoutEffect, useRef, useEffect } from 'react'
import { FileText, CheckCircle2, AlertCircle, Search, Home, Building2, LineChart, BarChart3, Sun, Moon, Eye, CreditCard, Droplets, X, ChevronLeft, ChevronRight, Calendar, Download } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { formatEuro as formatEuroBase, monthYear } from '@/lib/format'
import { getContractStatus, STATUS_SOFT_CLASS, STATUS_GLASS_CLASS } from '@/lib/contract-status'
import { CodeBadge } from '@/components/ui/CodeBadge'
import { DesktopSidebar } from '@/components/dashboard/desktop/DesktopSidebar'
import { WaveHero } from '@/components/dashboard/desktop/WaveHero'
import { MobileBollette } from '@/components/dashboard/mobile/MobileBollette'
import { MobileBollettaDetail } from '@/components/dashboard/mobile/MobileBollettaDetail'
import { initiatePagoPAPayment } from '@/actions/payment-actions'
import type { Profile, Bill, UserSupply } from '@/types/dashboard'

interface BolletteViewProps {
    profile: Profile
    bills: Bill[]
    supplies?: UserSupply[]
}

type StatusFilter = 'all' | 'paid' | 'unpaid'

export function BolletteView({ bills: rawBills, supplies: rawSupplies = [], profile }: BolletteViewProps) {
    const bills = useMemo(() => rawBills.map((b: any) => ({
        ...b,
        ulm: b.ulm || (b.cif ? b.cif.toString().slice(-6) : '')
    })), [rawBills])

    const supplies = useMemo(() => rawSupplies.map((s: any) => ({
        ...s,
        ulm: s.ulm || (s.cif ? s.cif.toString().slice(-6) : '')
    })), [rawSupplies])
    const [selectedBill, setSelectedBill] = useState<Bill | null>(null)
    const [isPaying, setIsPaying] = useState(false)
    const [filterStatus, setFilterStatus] = useState<StatusFilter>('all')
    const [search, setSearch] = useState('')
    const [selectedUlm, setSelectedUlm] = useState<string | 'all'>('all')
    const [supplyIndex, setSupplyIndex] = useState(0)

    const [activeGraph, setActiveGraph] = useState<'spesa' | 'consumo'>('spesa')
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(8)
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [dateMenuOpen, setDateMenuOpen] = useState(false)
    const dateMenuRef = useRef<HTMLDivElement>(null)
    const { theme, setTheme } = useTheme()
    const [themeMounted, setThemeMounted] = useState(false)
    useEffect(() => { setThemeMounted(true) }, [])

    const sorted = useMemo(() =>
        [...bills].sort((a, b) => new Date(b.data_emissione).getTime() - new Date(a.data_emissione).getTime())
        , [bills])

    const filtered = useMemo(() => {
        let list = sorted
        if (selectedUlm !== 'all') {
            list = list.filter((b: any) => b.ulm === selectedUlm)
        }
        if (filterStatus !== 'all') {
            list = list.filter((b: any) => (b.status || 'unpaid') === filterStatus)
        }
        if (search.trim()) {
            const q = search.trim().toLowerCase()
            list = list.filter((b: any) =>
                String(b.idboll || b.id || '').toLowerCase().includes(q) ||
                String(b.ulm || '').toLowerCase().includes(q) ||
                String(b.consumo || '').toLowerCase().includes(q)
            )
        }
        if (dateFrom) {
            const fromTs = new Date(dateFrom).getTime()
            list = list.filter((b: any) => new Date(b.data_emissione).getTime() >= fromTs)
        }
        if (dateTo) {
            const toTs = new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1
            list = list.filter((b: any) => new Date(b.data_emissione).getTime() <= toTs)
        }
        return list
    }, [sorted, filterStatus, search, selectedUlm, dateFrom, dateTo])

    useEffect(() => { setCurrentPage(1) }, [filterStatus, search, selectedUlm, dateFrom, dateTo, itemsPerPage])

    useEffect(() => {
        if (!dateMenuOpen) return
        const onClick = (e: MouseEvent) => {
            if (dateMenuRef.current && !dateMenuRef.current.contains(e.target as Node)) {
                setDateMenuOpen(false)
            }
        }
        document.addEventListener('mousedown', onClick)
        return () => document.removeEventListener('mousedown', onClick)
    }, [dateMenuOpen])

    const applyPreset = (preset: 'last30' | 'last90' | 'currentYear' | 'lastYear' | 'all') => {
        const now = new Date()
        const fmt = (d: Date) => d.toISOString().slice(0, 10)
        if (preset === 'all') { setDateFrom(''); setDateTo(''); return }
        if (preset === 'last30') {
            const from = new Date(now); from.setDate(from.getDate() - 30)
            setDateFrom(fmt(from)); setDateTo(fmt(now)); return
        }
        if (preset === 'last90') {
            const from = new Date(now); from.setDate(from.getDate() - 90)
            setDateFrom(fmt(from)); setDateTo(fmt(now)); return
        }
        if (preset === 'currentYear') {
            setDateFrom(`${now.getFullYear()}-01-01`); setDateTo(fmt(now)); return
        }
        if (preset === 'lastYear') {
            const y = now.getFullYear() - 1
            setDateFrom(`${y}-01-01`); setDateTo(`${y}-12-31`); return
        }
    }

    const dateLabel = (() => {
        if (!dateFrom && !dateTo) return 'Periodo'
        const fmtIt = (s: string) => s ? new Date(s).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
        return `${fmtIt(dateFrom)} → ${fmtIt(dateTo)}`
    })()

    const paginated = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage
        return filtered.slice(start, start + itemsPerPage)
    }, [filtered, currentPage, itemsPerPage])

    const totalPages = Math.ceil(filtered.length / itemsPerPage)

    // Desktop bollette uses the prefix Euro convention ("€175,89").
    const formatEuro = (n: number) => formatEuroBase(n, 'prefix')

    // 6-month series (mobile-style)
    const chartData = useMemo(() => {
        const SLOT_COUNT = 6
        const MIN_PLACEHOLDERS = 2
        const MAX_REAL = SLOT_COUNT - MIN_PLACEHOLDERS
        const placeholderHeights = [55, 72, 48, 65, 58, 70]
        const monthLabel = (d: Date) => d.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '')

        const relevant = selectedUlm === 'all' ? [] : bills.filter((b: any) => b.ulm === selectedUlm)

        const recent = [...relevant]
            .sort((a: any, b: any) => new Date(a.data_emissione).getTime() - new Date(b.data_emissione).getTime())
            .slice(-MAX_REAL)

        const padCount = SLOT_COUNT - recent.length
        const anchor = recent.length > 0 ? new Date((recent[0] as any).data_emissione) : new Date()
        const ymKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

        const slots: Array<{ key: string; value: number | null; label: string; ym: string; bill?: any }> = []
        for (let i = padCount; i > 0; i--) {
            const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1)
            slots.push({ key: `placeholder-${ymKey(d)}`, value: null, label: monthLabel(d), ym: ymKey(d) })
        }
        recent.forEach((b: any, i) => {
            const d = new Date(b.data_emissione)
            slots.push({
                key: `bill-${b.id ?? i}`,
                value: Number(b.consumo || 0),
                label: monthLabel(d),
                ym: ymKey(d),
                bill: b
            })
        })

        const max = Math.max(...recent.map((b: any) => Number(b.consumo || 0)), 1)
        const lastRealIndex = slots.reduce((acc, s, i) => (s as any).bill ? i : acc, -1)
        const lastBill = recent.length > 0 ? recent[recent.length - 1] : null
        return { slots, max, lastRealIndex, placeholderHeights, lastBill }
    }, [bills, selectedUlm])

    const totals = useMemo(() => {
        const source = selectedUlm === 'all' ? bills : bills.filter((b: any) => b.ulm === selectedUlm)
        const paid = source.filter((b: any) => b.status === 'paid')
        const unpaid = source.filter((b: any) => b.status !== 'paid')
        const sumImporto = (arr: Bill[]) => arr.reduce((s, b: any) => s + Number(b.importo || 0), 0)
        const now = new Date()
        const thisMonth = source.filter((b: any) => {
            const d = new Date(b.data_emissione)
            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
        })
        const overdue = unpaid.filter((b: any) => {
            const due = b.scadenza || b.data_scadenza
            return due ? new Date(due).getTime() < now.getTime() : false
        })
        return {
            count: source.length,
            paid: paid.length,
            unpaid: unpaid.length,
            totalSpent: sumImporto(paid),
            totalDue: sumImporto(unpaid),
            monthSpend: sumImporto(thisMonth),
            overdueCount: overdue.length,
            overdueAmount: sumImporto(overdue),
            latestAmount: source.length > 0 ? Number([...source].sort((a, b) => new Date(b.data_emissione).getTime() - new Date(a.data_emissione).getTime())[0].importo || 0) : 0,
        }
    }, [bills, selectedUlm])

    const displayCif = useMemo(() => {
        if (selectedUlm !== 'all') {
            const s = supplies.find(s => s.ulm === selectedUlm)
            if (s?.cif) return s.cif
        }
        // Fallback to first available cif from supplies or bills
        return supplies[0]?.cif || (bills[0] as any)?.cif || '-'
    }, [selectedUlm, supplies, bills])

    const displayCodice = useMemo(() => {
        return profile.codice_cliente || (bills[0] as any)?.codice_cliente || '-'
    }, [profile.codice_cliente, bills])

    // Next unpaid bill highlighted in hero
    const upcomingBill = useMemo(() => {
        return sorted.find((b: any) => (b.status || 'unpaid') === 'unpaid') || sorted[0]
    }, [sorted])

    const handlePay = async (bill: Bill) => {
        if (isPaying) return
        setIsPaying(true)
        try {
            const result = await initiatePagoPAPayment(bill.id, Number((bill as any).importo || 0))
            if ('error' in result && result.error) { alert(result.error); return }
            if ('paymentUrl' in result && result.paymentUrl) {
                window.location.href = result.paymentUrl
            }
        } catch {
            alert('Errore durante l\'inizializzazione del pagamento.')
        } finally {
            setIsPaying(false)
        }
    }

    if (selectedBill) {
        const matchingSupply = supplies.find((s: any) =>
            (s.ulm || 'all') === selectedBill.ulm || s.cif === (selectedBill as any).cif
        )
        const currentIndex = bills.findIndex(b => b.id === selectedBill.id)
        const onNext = currentIndex < bills.length - 1 ? () => setSelectedBill(bills[currentIndex + 1]) : undefined
        const onPrev = currentIndex > 0 ? () => setSelectedBill(bills[currentIndex - 1]) : undefined
        return (
            <MobileBollettaDetail
                bill={selectedBill} supply={matchingSupply}
                onBack={() => setSelectedBill(null)}
                onPay={handlePay} isPaying={isPaying}
                onNext={onNext} onPrev={onPrev}
                allBills={bills} onSelectBill={setSelectedBill}
            />
        )
    }

    const today = new Date()
    const todayDayName = today.toLocaleDateString('it-IT', { weekday: 'long' })
    const todayDay = today.getDate()

    return (
        <>
            {/* MOBILE */}
            <div className="lg:hidden min-h-screen bg-[#F8FAFC] dark:bg-[#0F1115]">
                <MobileBollette bills={bills} supplies={supplies} onSelectBill={setSelectedBill} onBack={() => history.back()} />
            </div>

            {/* DESKTOP */}
            <div className="hidden lg:block min-h-screen bg-[#F8FAFC] dark:bg-[#0F1115]">
                <DesktopSidebar />

                <main className="ml-20 h-screen overflow-hidden flex flex-col">
                    <div className="max-w-[1440px] w-full mx-auto flex-1 flex flex-col p-6 space-y-7 overflow-hidden">
                        <div className="shrink-0 space-y-5">
                        {/* TOP ROW: OVERVIEW + FORNITURE + GRAPHS (Condensed) */}
                        <div className="grid grid-cols-12 gap-5 h-[215px]">
                            {/* Left Widget: Overview */}
                            <div className="col-span-12 lg:col-span-3 flex flex-col">
                                <WaveHero className="p-4 flex flex-col justify-between h-full min-h-[110px]">
                                    <div>
                                        <div className="flex flex-col">
                                            <p className="text-[13px] font-bold text-white/60 uppercase tracking-[0.18em] mb-4 h-6 flex items-center">Ultima Bolletta</p>
                                            <p className="text-5xl font-medium tracking-tighter text-white mb-6">{formatEuro(totals.latestAmount)}</p>
                                            <div className="flex gap-3">
                                                <InfoBadge label="CIF" value={displayCif} />
                                                <InfoBadge label="Codice Cliente" value={displayCodice} />
                                            </div>
                                        </div>
                                        {profile.address && (
                                            <div className="mb-4">
                                                <InfoBadge label="Indirizzo" value={profile.address} full />
                                            </div>
                                        )}
                                    </div>

                                </WaveHero>
                            </div>

                            {/* Middle Widget: Forniture Carousel */}
                            <SuppliesCarousel
                                supplies={supplies}
                                selectedUlm={selectedUlm}
                                setSelectedUlm={setSelectedUlm}
                                supplyIndex={supplyIndex}
                                setSupplyIndex={setSupplyIndex}
                            />

                            {/* Right Widget: Graphs */}
                            <div className="col-span-12 lg:col-span-5 relative bg-white dark:bg-[#1A1D23] rounded-[2rem] p-4 flex flex-col h-full min-h-[110px]">
                                <div className="absolute top-3 right-3 z-10 flex items-center gap-0.5 bg-slate-100 dark:bg-white/5 p-0.5 rounded-lg">
                                    <button
                                        onClick={() => setActiveGraph('spesa')}
                                        className={cn(
                                            "h-7 w-8 rounded-md transition-colors flex items-center justify-center",
                                            activeGraph === 'spesa'
                                                ? "bg-white dark:bg-white/15 text-[#1E5BFF] dark:text-[#93C5FD] shadow-sm"
                                                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white"
                                        )}
                                        title="Spesa"
                                    >
                                        <LineChart size={14} />
                                    </button>
                                    <button
                                        onClick={() => setActiveGraph('consumo')}
                                        className={cn(
                                            "h-7 w-8 rounded-md transition-colors flex items-center justify-center",
                                            activeGraph === 'consumo'
                                                ? "bg-white dark:bg-white/15 text-[#1E5BFF] dark:text-[#93C5FD] shadow-sm"
                                                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white"
                                        )}
                                        title="Consumo"
                                    >
                                        <BarChart3 size={14} />
                                    </button>
                                </div>

                                <div className="flex-1 flex flex-col min-h-0">
                                    {activeGraph === 'spesa' ? (
                                        <SpesaLineChart chartData={chartData} bills={bills} monthYear={monthYear} isAll={false} />
                                    ) : (
                                        <ConsumoBarChart chartData={chartData} isAll={false} />
                                    )}
                                </div>
                                {selectedUlm === 'all' && (
                                    <div className="absolute inset-0 z-[60] rounded-[2rem] flex items-center justify-center p-6 bg-white/70 dark:bg-[#1A1D23]/70 backdrop-blur-md">
                                        <p className="text-[14px] font-bold text-[#0A2540] dark:text-white bg-white dark:bg-[#2A2D35] px-5 py-3 rounded-2xl shadow-xl ring-1 ring-slate-200 dark:ring-white/10 max-w-[80%] text-center">
                                            Seleziona una fornitura per vedere il grafico
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* TABLE SECTION — Scrollable */}
                    <div className="flex-1 min-h-0 bg-white dark:bg-[#1A1D23] rounded-[2rem] p-5 overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between mb-4 gap-4">
                            <div>
                                <h2 className="text-xl font-bold text-[#0A2540] dark:text-white">Elenco bollette</h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <div ref={dateMenuRef} className="relative">
                                    <button
                                        onClick={() => setDateMenuOpen(o => !o)}
                                        className={cn(
                                            "h-11 px-4 rounded-full text-[13px] font-bold flex items-center gap-2 transition-all outline-none ring-2 ring-transparent",
                                            (dateFrom || dateTo)
                                                ? "bg-[#1E5BFF]/10 text-[#1E5BFF] ring-[#1E5BFF]/30"
                                                : "bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/15 hover:ring-[#93C5FD] focus-visible:ring-[#93C5FD]"
                                        )}
                                    >
                                        <Calendar size={15} />
                                        {dateLabel}
                                        {(dateFrom || dateTo) && (
                                            <span
                                                role="button"
                                                tabIndex={0}
                                                onClick={(e) => { e.stopPropagation(); setDateFrom(''); setDateTo('') }}
                                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setDateFrom(''); setDateTo('') } }}
                                                className="ml-1 w-5 h-5 rounded-full bg-[#1E5BFF]/15 hover:bg-red-500/15 text-[#1E5BFF] hover:text-red-500 flex items-center justify-center transition-colors"
                                                aria-label="Pulisci date"
                                            >
                                                <X size={12} />
                                            </span>
                                        )}
                                    </button>
                                    {dateMenuOpen && (
                                        <div className="absolute right-0 top-12 z-50 w-[300px] bg-white dark:bg-[#1A1D23] rounded-2xl shadow-xl ring-1 ring-slate-200 dark:ring-white/10 p-3">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Periodi rapidi</p>
                                            <div className="grid grid-cols-2 gap-2 mb-4">
                                                {[
                                                    { k: 'last30', label: 'Ultimi 30 giorni' },
                                                    { k: 'last90', label: 'Ultimi 90 giorni' },
                                                    { k: 'currentYear', label: 'Anno corrente' },
                                                    { k: 'lastYear', label: 'Anno scorso' },
                                                ].map(p => (
                                                    <button
                                                        key={p.k}
                                                        onClick={() => applyPreset(p.k as any)}
                                                        className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 text-[12px] font-bold text-[#0A2540] dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                                                    >
                                                        {p.label}
                                                    </button>
                                                ))}
                                            </div>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Personalizzato</p>
                                            <RangeCalendar
                                                from={dateFrom}
                                                to={dateTo}
                                                onChange={(f, t) => { setDateFrom(f); setDateTo(t) }}
                                            />
                                            <div className="flex gap-2 mt-4">
                                                <button
                                                    onClick={() => applyPreset('all')}
                                                    className="flex-1 h-10 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 text-[13px] font-bold hover:bg-red-500/10 hover:text-red-500 transition-colors"
                                                >
                                                    Cancella
                                                </button>
                                                <button
                                                    onClick={() => setDateMenuOpen(false)}
                                                    className="flex-1 h-10 rounded-xl bg-[#1E5BFF] text-white text-[13px] font-bold hover:bg-[#1E5BFF]/90 transition-colors"
                                                >
                                                    Applica
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="relative group">
                                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#93C5FD] transition-colors" />
                                    <input
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        placeholder="Cerca bollette"
                                        className="h-11 pl-10 pr-4 rounded-full bg-slate-100 dark:bg-white/10 text-[13px] text-slate-700 dark:text-slate-200 placeholder:text-slate-500 outline-none focus:ring-2 ring-[#1E5BFF]/20 w-64"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar rounded-2xl">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-[12px] font-bold uppercase tracking-widest text-slate-500 border-b border-slate-100 dark:border-white/5">
                                        <th className="px-6 py-4 font-bold w-[20%]">Bolletta</th>
                                        <th className="px-6 py-4 font-bold w-[12%]">Fornitura</th>
                                        <th className="px-6 py-4 font-bold w-[10%]">Emissione</th>
                                        <th className="px-6 py-4 font-bold w-[10%]">Scadenza</th>
                                        <th className="px-6 py-4 font-bold w-[10%]">Consumo</th>
                                        <th className="px-6 py-4 font-bold w-[12%]">Tipologia</th>
                                        <th className="px-6 py-4 font-bold text-right w-[10%]">Importo</th>
                                        <th className="px-6 py-4 font-bold text-right w-[16%]"><span className="sr-only">Stato Pagamento</span></th>
                                    </tr>
                                </thead>
                                <tbody className="text-[15px]">
                                    {paginated.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-4 py-16">
                                                <div className="flex flex-col items-center justify-center text-center">
                                                    <div className="w-16 h-16 rounded-[1.25rem] bg-slate-50 dark:bg-white/5 flex items-center justify-center mb-5 shadow-[0_8px_16px_rgba(15,23,42,0.04)]">
                                                        <FileText size={28} className="text-slate-400 dark:text-slate-500" strokeWidth={1.5} />
                                                    </div>
                                                    <p className="text-[15px] font-bold text-[#0A2540] dark:text-white mb-1.5">
                                                        Nessuna bolletta trovata
                                                    </p>
                                                    <p className="text-[13px] text-slate-400 leading-relaxed">
                                                        Non ci sono documenti che corrispondono ai filtri selezionati.
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : paginated.map((b: any, idx: number) => {
                                        const isPaid = b.status === 'paid'
                                        const billId = (b.idboll || b.id).toString()
                                        return (
                                            <tr
                                                key={b.id || idx}
                                                className="border-t border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group"
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn(
                                                            "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
                                                            isPaid
                                                                ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                                                : "bg-blue-50 dark:bg-blue-500/15 text-[#1E5BFF] dark:text-[#93C5FD]"
                                                        )}>
                                                            {isPaid ? <CheckCircle2 size={20} /> : <FileText size={20} />}
                                                        </div>
                                                        <div>
                                                            <p className="text-[15px] font-bold text-[#0A2540] dark:text-white capitalize">{monthYear(b.data_emissione)}</p>
                                                            <p className="text-[12px] font-mono text-slate-500 truncate">{billId.slice(0, 16)}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-mono text-[14px] text-slate-600 dark:text-slate-400">
                                                    {b.ulm || '-'}
                                                </td>
                                                <td className="px-6 py-4 text-[14px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                    {new Date(b.data_emissione).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </td>
                                                <td className="px-6 py-4 text-[14px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                    {b.scadenza || b.data_scadenza ? new Date(b.scadenza || b.data_scadenza).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center gap-1.5 text-[14px] text-slate-700 dark:text-slate-300">
                                                        <Droplets size={15} className="text-[#1E5BFF] shrink-0" fill="currentColor" fillOpacity={0.25} />
                                                        {b.consumo || 0} m³
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {(() => {
                                                        const type = String(b.billing_type || '').trim().toUpperCase()
                                                        const isSaldo = type.startsWith('S')
                                                        const isAcconto = type.startsWith('A')
                                                        if (isSaldo) {
                                                            return (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                                                                    Saldo
                                                                </span>
                                                            )
                                                        }
                                                        if (isAcconto) {
                                                            return (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400">
                                                                    Acconto
                                                                </span>
                                                            )
                                                        }
                                                        return <span className="text-slate-400 dark:text-slate-600">-</span>
                                                    })()}
                                                </td>
                                                <td className="px-6 py-4 text-right text-[16px] font-bold text-[#0A2540] dark:text-white tracking-tight">
                                                    {formatEuro(Number(b.importo || 0))}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-3">
                                                        <div>
                                                            {isPaid ? (
                                                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[12px] font-bold whitespace-nowrap">
                                                                    <CheckCircle2 size={13} /> Pagata
                                                                </span>
                                                            ) : b.expected_method === 'MP23' ? (
                                                                <div className="flex items-center gap-3">
                                                                    <div className="h-5 flex items-center shrink-0">
                                                                        <img src="/pagoPA.svg" alt="pagoPA" className="h-5 w-auto dark:hidden" />
                                                                        <img src="/pagoPA-white.svg" alt="pagoPA" className="h-5 w-auto hidden dark:block" />
                                                                    </div>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handlePay(b) }}
                                                                        disabled={isPaying}
                                                                        className="h-8 px-3 rounded-lg bg-[#1E5BFF] text-white text-[12px] font-bold flex items-center gap-1.5 hover:bg-[#1E5BFF]/90 transition-colors disabled:opacity-50 shadow-sm shadow-[#1E5BFF]/20"
                                                                        title="Paga ora con PagoPA"
                                                                    >
                                                                        <CreditCard size={12} /> Paga
                                                                    </button>
                                                                </div>
                                                            ) : null}
                                                        </div>

                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); window.open(`/api/bills/${b.id}/pdf`, '_blank') }}
                                                            className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-white/15 transition-colors shrink-0"
                                                            title="Apri PDF"
                                                        >
                                                            <Eye size={14} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); window.open(`/api/bills/${b.id}/pdf?download=1`, '_blank') }}
                                                            className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-white/15 transition-colors shrink-0"
                                                            title="Scarica PDF"
                                                        >
                                                            <Download size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {/* Pagination */}
                        {filtered.length > 0 && (
                            <div className="flex items-center justify-between pt-4 mt-2 shrink-0 border-t border-slate-100 dark:border-white/5">
                                <p className="text-[12px] text-slate-500">
                                    {filtered.length <= itemsPerPage ? (
                                        <>
                                            <span className="font-bold text-[#0A2540] dark:text-white">{filtered.length}</span> {filtered.length === 1 ? 'bolletta' : 'bollette'}
                                        </>
                                    ) : (
                                        <>
                                            Mostrando <span className="font-bold text-[#0A2540] dark:text-white">{(currentPage - 1) * itemsPerPage + 1}</span> - <span className="font-bold text-[#0A2540] dark:text-white">{Math.min(currentPage * itemsPerPage, filtered.length)}</span> di <span className="font-bold text-[#0A2540] dark:text-white">{filtered.length}</span> bollette
                                        </>
                                    )}
                                </p>
                                <div className="flex items-center gap-4">
                                    {totalPages > 1 && (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                                disabled={currentPage === 1}
                                                className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/15 transition-colors disabled:opacity-40 flex items-center justify-center"
                                                aria-label="Pagina precedente"
                                            >
                                                <ChevronLeft size={16} />
                                            </button>
                                            <div className="flex items-center gap-1">
                                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                                    <button
                                                        key={p}
                                                        onClick={() => setCurrentPage(p)}
                                                        className={cn(
                                                            "w-9 h-9 rounded-[10px] text-[12px] font-bold transition-all duration-200 flex items-center justify-center",
                                                            currentPage === p
                                                                ? "bg-[#1E5BFF]/15 text-[#1E5BFF] ring-2 ring-[#1E5BFF]/20"
                                                                : "text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10"
                                                        )}
                                                    >
                                                        {p}
                                                    </button>
                                                ))}
                                            </div>
                                            <button
                                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                                disabled={currentPage === totalPages}
                                                className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/15 transition-colors disabled:opacity-40 flex items-center justify-center"
                                                aria-label="Pagina successiva"
                                            >
                                                <ChevronRight size={16} />
                                            </button>
                                        </div>
                                    )}
                                    <label className="flex items-center gap-1.5 text-[12px] text-slate-500">
                                        <span>Righe</span>
                                        <select
                                            value={itemsPerPage}
                                            onChange={e => setItemsPerPage(Number(e.target.value))}
                                            className="bg-slate-100 dark:bg-white/10 rounded-lg px-2 py-1 text-[12px] font-bold text-[#0A2540] dark:text-white outline-none"
                                        >
                                            <option value={8}>8</option>
                                            <option value={16}>16</option>
                                            <option value={32}>32</option>
                                            <option value={64}>64</option>
                                        </select>
                                    </label>
                                </div>
                            </div>
                        )}
                        </div>
                    </div>
                    {/* End of constrained container */}
                </main>
            </div>

        </>
    )
}

function RangeCalendar({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
    const initial = from ? new Date(from) : new Date()
    const [viewYear, setViewYear] = useState(initial.getFullYear())
    const [viewMonth, setViewMonth] = useState(initial.getMonth())
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const fromDate = from ? new Date(from) : null
    const toDate = to ? new Date(to) : null

    const monthNames = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
    const weekDays = ['lu', 'ma', 'me', 'gi', 've', 'sa', 'do']

    const firstOfMonth = new Date(viewYear, viewMonth, 1)
    const startOffset = (firstOfMonth.getDay() + 6) % 7
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const daysInPrev = new Date(viewYear, viewMonth, 0).getDate()

    const cells: { date: Date; current: boolean }[] = []
    for (let i = startOffset - 1; i >= 0; i--) {
        cells.push({ date: new Date(viewYear, viewMonth - 1, daysInPrev - i), current: false })
    }
    for (let d = 1; d <= daysInMonth; d++) {
        cells.push({ date: new Date(viewYear, viewMonth, d), current: true })
    }
    while (cells.length % 7 !== 0 || cells.length < 42) {
        const last = cells[cells.length - 1].date
        cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), current: false })
        if (cells.length >= 42) break
    }

    const inRange = (d: Date) => fromDate && toDate && d >= fromDate && d <= toDate
    const isStart = (d: Date) => fromDate && d.toDateString() === fromDate.toDateString()
    const isEnd = (d: Date) => toDate && d.toDateString() === toDate.toDateString()

    const handleClick = (d: Date) => {
        const s = fmt(d)
        if (!from || (from && to)) { onChange(s, ''); return }
        if (new Date(s).getTime() < new Date(from).getTime()) { onChange(s, from); return }
        onChange(from, s)
    }

    const nav = (delta: number) => {
        const m = viewMonth + delta
        const y = viewYear + Math.floor(m / 12)
        setViewMonth(((m % 12) + 12) % 12)
        setViewYear(y)
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <button onClick={() => nav(-1)} className="w-6 h-6 rounded-md hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center text-slate-500">
                    <ChevronLeft size={12} />
                </button>
                <p className="text-[11px] font-bold text-[#0A2540] dark:text-white capitalize">{monthNames[viewMonth]} {viewYear}</p>
                <button onClick={() => nav(1)} className="w-6 h-6 rounded-md hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center text-slate-500">
                    <ChevronRight size={12} />
                </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 mb-0.5">
                {weekDays.map(w => (
                    <p key={w} className="text-[9px] font-bold uppercase text-slate-400 text-center">{w}</p>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
                {cells.map((c, i) => {
                    const r = inRange(c.date)
                    const s = isStart(c.date)
                    const e = isEnd(c.date)
                    const isToday = c.date.toDateString() === new Date().toDateString()
                    return (
                        <button
                            key={i}
                            onClick={() => handleClick(c.date)}
                            className={cn(
                                "h-7 rounded-md text-[11px] font-bold transition-colors",
                                !c.current && "text-slate-300 dark:text-slate-600",
                                c.current && !r && !s && !e && "text-[#0A2540] dark:text-white hover:bg-slate-100 dark:hover:bg-white/10",
                                r && !s && !e && "bg-[#1E5BFF]/10 text-[#1E5BFF]",
                                (s || e) && "bg-[#1E5BFF] text-white",
                                isToday && !s && !e && !r && "ring-1 ring-[#1E5BFF]/40"
                            )}
                        >
                            {c.date.getDate()}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

function KpiCard({ theme, label, sub, value, cta, onCta, danger }: {
    theme: 'green' | 'white'
    label: string; sub: string; value: string
    cta?: string; onCta?: () => void
    danger?: boolean
}) {
    const isGreen = theme === 'green'
    return (
        <div className={cn(
            "rounded-[2rem] p-5 flex flex-col justify-between min-h-[140px]",
            isGreen ? "text-[#0A2540]" : "bg-white dark:bg-[#1A1D23]"
        )} style={isGreen ? { background: 'linear-gradient(135deg, #C6F36B 0%, #84cc16 100%)' } : undefined}>
            <div className="flex items-start justify-between">
                <div>
                    <p className={cn("text-[15px] font-bold", isGreen ? "text-[#0A2540]" : "text-[#0A2540] dark:text-white")}>{label}</p>
                    <p className={cn("text-[11px] mt-0.5", isGreen ? "text-[#0A2540]/60" : danger ? "text-rose-500 font-bold" : "text-slate-400")}>{sub}</p>
                </div>
                {danger && <AlertCircle size={18} className="text-rose-500" />}
            </div>
            <div className="flex items-end justify-between">
                <p className={cn(
                    "text-4xl font-extrabold tracking-tight",
                    isGreen ? "text-[#0A2540]" : "text-[#0A2540] dark:text-white"
                )}>{value}</p>
                {cta && (
                    <button
                        onClick={onCta}
                        className={cn(
                            "px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors",
                            isGreen ? "bg-[#0A2540] text-white hover:bg-[#143356]" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                    >{cta}</button>
                )}
            </div>
        </div>
    )
}

// ====== Mobile-style charts (mirrored from MobileHome) ======

function SpesaLineChart({ chartData, bills, monthYear, isAll }: { chartData: any; bills: Bill[]; monthYear: (d: string) => string; isAll?: boolean }) {
    const chartRef = useRef<HTMLDivElement>(null)
    const [chartSize, setChartSize] = useState({ width: 0, height: 0 })
    const [selectedExpenseIndex, setSelectedExpenseIndex] = useState<number | null>(chartData.lastRealIndex !== -1 ? chartData.lastRealIndex : null)

    useLayoutEffect(() => {
        const el = chartRef.current
        if (!el) return
        const update = () => setChartSize({ width: el.clientWidth, height: el.clientHeight })
        update()
        const ro = new ResizeObserver(update)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    const selectedSlot = selectedExpenseIndex !== null ? chartData.slots[selectedExpenseIndex] : null
    const selectedBill = (selectedSlot as any)?.bill
    const displayPrice = selectedBill ? Number(selectedBill.importo || 0) : Number(chartData.lastBill?.importo || 0)
    const displayDate = selectedBill ? monthYear(selectedBill.data_emissione) : (chartData.lastBill ? monthYear(chartData.lastBill.data_emissione) : '')

    const maxCost = Math.max(...bills.map((b: any) => Number(b.importo || 0)), 1)
    const margin = 15
    const width = 300 - (margin * 2)
    const realSlots = chartData.slots
        .map((slot: any, slotIdx: number) => ({ slot, slotIdx }))
        .filter(({ slot }: any) => !!slot.bill && Number(slot.bill.importo || 0) > 0)
    const realCount = realSlots.length
    const realStep = realCount > 1 ? width / (realCount - 1) : 0

    const realPoints = realSlots.map(({ slot, slotIdx }: any, i: number) => {
        const bill = slot.bill
        const val = Number(bill.importo || 0)
        const y = val > 0 ? 100 - ((val / maxCost) * 70 + 15) : 85
        const x = realCount > 1 ? margin + i * realStep : margin + width
        return { x, y, cost: val, slotIdx, label: slot.label, key: slot.key }
    })

    type LinePoint = { x: number; y: number; ghost: boolean }
    const buildRamp = (endY: number): LinePoint[] => {
        const startY = 100
        const steps = 5
        return Array.from({ length: steps }, (_, i) => {
            const t = i / (steps - 1)
            const ease = 1 - Math.pow(1 - t, 1.6)
            return {
                x: margin + width * t,
                y: startY - (startY - endY) * ease,
                ghost: i !== steps - 1,
            }
        })
    }

    const isEmpty = realPoints.length === 0
    const linePoints: LinePoint[] = realPoints.length === 1
        ? buildRamp(realPoints[0].y)
        : realPoints.map((p: any) => ({ x: p.x, y: p.y, ghost: false }))

    const linePath = linePoints.length >= 2
        ? linePoints.reduce((acc: string, p: LinePoint, i: number, arr: LinePoint[]) => {
            if (i === 0) return `M ${p.x},${p.y}`
            const prev = arr[i - 1]
            const dx = p.x - prev.x
            return `${acc} C ${prev.x + dx / 2},${prev.y} ${p.x - dx / 2},${p.y} ${p.x},${p.y}`
        }, '')
        : ''
    const areaPath = linePoints.length >= 2
        ? `${linePath} L ${linePoints[linePoints.length - 1].x},100 L ${linePoints[0].x},100 Z`
        : ''
    const ghostPoints = linePoints.filter((p: LinePoint) => p.ghost)
    const activePoint = realPoints.find((p: any) => p.slotIdx === selectedExpenseIndex)
        ?? realPoints[realPoints.length - 1]
        ?? null

    const handleScrub = (clientX: number, rect: DOMRect) => {
        if (realPoints.length === 0) return
        const x = Math.max(0, Math.min(rect.width, clientX - rect.left))
        let closest = realPoints[0]
        let closestDist = Infinity
        for (const p of realPoints) {
            const px = (p.x / 300) * rect.width
            const dist = Math.abs(px - x)
            if (dist < closestDist) { closestDist = dist; closest = p }
        }
        if (closest.slotIdx !== selectedExpenseIndex) setSelectedExpenseIndex(closest.slotIdx)
    }

    const placeholderLine = 'M 15,70 C 60,55 100,80 150,55 S 240,70 285,50'

    return (
        <div className="flex-1 flex flex-col relative h-full">
            {isAll && (
                <div className="absolute inset-0 z-[60] bg-white/70 dark:bg-[#1A1D23]/70 backdrop-blur-md rounded-[2rem] flex items-center justify-center text-center p-4">
                    <p className="text-[11px] font-bold text-[#0A2540] dark:text-white bg-white dark:bg-[#2A2D35] px-4 py-2 rounded-full shadow-xl ring-1 ring-slate-200 dark:ring-white/10">
                        Seleziona una fornitura per vedere il grafico
                    </p>
                </div>
            )}
            <div className="flex items-start justify-between mb-2">
                <div>
                    <p className="text-[9px] font-bold tracking-widest text-slate-400 uppercase mb-0.5">Andamento Spesa</p>
                    <h3 className="text-2xl font-bold text-[#0A2540] dark:text-white tracking-tight leading-none">
                        € {displayPrice.toFixed(2).replace('.', ',')}
                    </h3>
                    {displayDate && <p className="text-[10px] text-[#1E5BFF] dark:text-[#93C5FD] font-bold uppercase tracking-wider mt-1">{displayDate}</p>}
                </div>
            </div>

            <div ref={chartRef} className="h-24 max-w-md mx-auto w-full mt-2 relative touch-none select-none">
                <svg viewBox="0 0 300 100" className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="spendingGradientBolletteV2" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#93C5FD" stopOpacity="0.32" />
                            <stop offset="100%" stopColor="#93C5FD" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    {isEmpty ? (
                        <path d={placeholderLine} fill="none" stroke="rgba(100,116,139,0.5)" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                    ) : (
                        <>
                            {areaPath && <path d={areaPath} fill="url(#spendingGradientBolletteV2)" />}
                            {linePath && (
                                <path d={linePath} fill="none" stroke="#93C5FD" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="drop-shadow-[0_2px_4px_rgba(147,197,253,0.4)]" />
                            )}
                            {ghostPoints.map((p: any, i: number) => (
                                <circle key={`ghost-${i}`} cx={p.x} cy={p.y} r="2" fill="#93C5FD" opacity="0.45" />
                            ))}
                        </>
                    )}
                </svg>

                <div
                    className="absolute inset-0 z-40 cursor-crosshair"
                    onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); handleScrub(e.clientX, e.currentTarget.getBoundingClientRect()) }}
                    onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) handleScrub(e.clientX, e.currentTarget.getBoundingClientRect()) }}
                />

                {activePoint && chartSize.width > 0 && (
                    <div className="absolute top-0 bottom-0 w-px pointer-events-none z-10 transition-transform duration-300 ease-out will-change-transform"
                        style={{ transform: `translateX(${(activePoint.x / 300) * chartSize.width}px)`, backgroundImage: 'repeating-linear-gradient(to bottom, rgba(147,197,253,0.5) 0 4px, transparent 4px 8px)' }} />
                )}
                {activePoint && chartSize.width > 0 && (
                    <div className="absolute top-0 left-0 pointer-events-none z-20 transition-transform duration-300 ease-out will-change-transform"
                        style={{ transform: `translate3d(${(activePoint.x / 300) * chartSize.width}px, ${(activePoint.y / 100) * chartSize.height}px, 0)` }}>
                        <div className="absolute -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-[2.5px] border-[#93C5FD] shadow-[0_2px_8px_rgba(147,197,253,0.55)]" />
                    </div>
                )}
                {activePoint && chartSize.width > 0 && (
                    <div className="absolute top-0 left-0 bg-[#93C5FD] text-white dark:text-[#0A2540] px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-lg pointer-events-none z-30 whitespace-nowrap transition-transform duration-300 ease-out will-change-transform"
                        style={{ transform: `translate3d(${(activePoint.x / 300) * chartSize.width}px, ${(activePoint.y / 100) * chartSize.height - 16}px, 0) translate(-50%, -100%)` }}>
                        €{activePoint.cost.toFixed(2).replace('.', ',')}
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#93C5FD] rotate-45" />
                    </div>
                )}
            </div>

            <div className="flex justify-center gap-4 mt-1 max-w-md mx-auto w-full h-4">
                {realPoints.map((p: any) => (
                    <span key={p.key}
                        className={cn("text-[8px] font-bold uppercase tracking-tighter w-12 text-center transition-colors duration-200",
                            selectedExpenseIndex === p.slotIdx ? "text-[#1E5BFF] dark:text-[#93C5FD]" : "text-slate-400")}>
                        {p.label}
                    </span>
                ))}
            </div>
        </div>
    )
}

function ConsumoBarChart({ chartData, isAll }: { chartData: any; isAll?: boolean }) {
    const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(chartData.lastRealIndex !== -1 ? chartData.lastRealIndex : null)

    return (
        <div className="flex-1 flex flex-col relative overflow-hidden h-full">
            {isAll && (
                <div className="absolute inset-0 z-[60] bg-white/70 dark:bg-[#1A1D23]/70 backdrop-blur-md rounded-[2rem] flex items-center justify-center text-center p-4">
                    <p className="text-[11px] font-bold text-[#0A2540] dark:text-white bg-white dark:bg-[#2A2D35] px-4 py-2 rounded-full shadow-xl ring-1 ring-slate-200 dark:ring-white/10">
                        Seleziona una fornitura per vedere il grafico
                    </p>
                </div>
            )}
            <div className="flex items-start justify-between mb-2">
                <div>
                    <p className="text-[9px] font-bold tracking-widest text-slate-400 uppercase mb-0.5">Consumo mensile</p>
                    <h3 className="text-2xl font-bold text-[#0A2540] dark:text-white tracking-tight leading-none">
                        {chartData.lastBill?.consumo || '0'} <span className="text-xs font-medium text-slate-400">mc</span>
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium mt-1">Ultimi 6 mesi</p>
                </div>
            </div>

            <div className="flex-1 flex items-end justify-between gap-3 min-h-0 mt-2 w-full">
                {chartData.slots.map((slot: any, i: number) => {
                    const isSelected = selectedBarIndex === i
                    const hasData = slot.value !== null
                    const heightPct = hasData
                        ? ((slot.value as number) / chartData.max) * 100
                        : chartData.placeholderHeights[i % chartData.placeholderHeights.length]
                    return (
                        <div key={slot.key} className="flex-1 flex flex-col items-center justify-end h-full relative cursor-pointer" onClick={() => hasData && setSelectedBarIndex(i)}>
                            {isSelected && hasData && (
                                <span className="absolute px-2 py-0.5 rounded-md bg-[#93C5FD] text-white dark:text-black text-[10px] font-bold whitespace-nowrap z-10 shadow-sm animate-in fade-in zoom-in duration-200" style={{ bottom: `calc(${Math.max(heightPct, 20)}% + 14px)` }}>
                                    {slot.value} mc
                                </span>
                            )}
                            <div
                                className="w-full rounded-xl relative overflow-hidden transition-[height] duration-300"
                                style={{ height: `${Math.max(heightPct, hasData ? 25 : 35)}%` }}
                            >
                                {hasData ? (
                                    <>
                                        <div className="absolute inset-0 bg-blue-100 dark:bg-blue-900/30" />
                                        <div className={cn("absolute inset-0 bg-gradient-to-t from-[#1E5BFF] to-[#60A5FA] transition-opacity duration-300", isSelected ? "opacity-100" : "opacity-0")} />
                                    </>
                                ) : (
                                    <div className="absolute inset-0 bg-slate-100 dark:bg-white/5" />
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
            <div className="flex justify-between gap-3 mt-2 w-full shrink-0">
                {chartData.slots.map((slot: any, i: number) => (
                    <span key={slot.key}
                        className={cn("flex-1 text-center text-[9px] font-bold uppercase tracking-tighter transition-colors duration-200",
                            selectedBarIndex === i ? "text-[#1E5BFF]" : "text-slate-400")}>
                        {slot.label}
                    </span>
                ))}
            </div>
        </div>
    )
}

function SuppliesCarousel({ supplies, selectedUlm, setSelectedUlm, supplyIndex, setSupplyIndex }: {
    supplies: any[]
    selectedUlm: string | 'all'
    setSelectedUlm: (v: string | 'all') => void
    supplyIndex: number
    setSupplyIndex: (i: number) => void
}) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const scrollingRef = useRef(false)
    const scrollTimer = useRef<any>(null)
    const dragState = useRef<{ startX: number; startScroll: number; pointerId: number; moved: boolean } | null>(null)
    
    const [searchQuery, setSearchQuery] = useState('')
    const [scrollLeft, setScrollLeft] = useState(0)
    const [clientWidth, setClientWidth] = useState(0)

    useEffect(() => {
        if (scrollRef.current) {
            setClientWidth(scrollRef.current.clientWidth)
            const initialIdx = searchQuery 
                ? 0 
                : (selectedUlm === 'all' ? 0 : supplies.findIndex(s => s.ulm === selectedUlm) + 1)
            scrollRef.current.scrollLeft = initialIdx * scrollRef.current.clientWidth
            setScrollLeft(initialIdx * scrollRef.current.clientWidth)
        }
    }, [supplies, searchQuery, selectedUlm])

    const filteredSupplies = useMemo(() => {
        if (!searchQuery) return supplies
        const query = searchQuery.toLowerCase().trim()
        return supplies.filter(s =>
            (s.address || '').toLowerCase().includes(query) ||
            (s.city || '').toLowerCase().includes(query) ||
            (s.ulm || '').toLowerCase().includes(query) ||
            (s.codice_ulm || '').toLowerCase().includes(query)
        )
    }, [supplies, searchQuery])

    // Slide 0 = "all" intro (only when not searching), slides 1..n = each filtered fornitura
    const totalSlides = searchQuery ? filteredSupplies.length : supplies.length + 1
    const safeIndex = Math.min(supplyIndex, Math.max(0, totalSlides - 1))

    const applySelection = (i: number) => {
        if (!searchQuery) {
            if (i === 0) setSelectedUlm('all')
            else setSelectedUlm(supplies[i - 1]?.ulm || 'all')
        } else {
            setSelectedUlm(filteredSupplies[i]?.ulm || 'all')
        }
    }

    const scrollToIndex = (i: number) => {
        const el = scrollRef.current
        if (!el) return
        const w = el.clientWidth
        scrollingRef.current = true
        el.scrollTo({ left: i * w, behavior: 'smooth' })
        setSupplyIndex(i)
        applySelection(i)
        clearTimeout(scrollTimer.current)
        scrollTimer.current = setTimeout(() => { scrollingRef.current = false }, 400)
    }

    const handleScroll = () => {
        const el = scrollRef.current
        if (!el) return
        setScrollLeft(el.scrollLeft)
        setClientWidth(el.clientWidth)
        if (scrollingRef.current) return
        const w = el.clientWidth
        if (w <= 0) return
        const idx = Math.round(el.scrollLeft / w)
        if (idx !== safeIndex && idx >= 0 && idx < totalSlides) {
            setSupplyIndex(idx)
            applySelection(idx)
        }
    }

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        const el = scrollRef.current
        if (!el) return
        // Don't hijack drag on interactive children (buttons, anchors, inputs)
        const target = e.target as HTMLElement
        if (target.closest('button, a, input')) return
        dragState.current = {
            startX: e.clientX,
            startScroll: el.scrollLeft,
            pointerId: e.pointerId,
            moved: false,
        }
        el.setPointerCapture(e.pointerId)
        el.style.scrollSnapType = 'none'
    }

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const el = scrollRef.current
        const d = dragState.current
        if (!el || !d || d.pointerId !== e.pointerId) return
        const dx = e.clientX - d.startX
        if (Math.abs(dx) > 4) d.moved = true
        el.scrollLeft = d.startScroll - dx
    }

    const finishDrag = (e: React.PointerEvent<HTMLDivElement>) => {
        const el = scrollRef.current
        const d = dragState.current
        if (!el || !d || d.pointerId !== e.pointerId) return
        const w = el.clientWidth
        const idx = Math.max(0, Math.min(totalSlides - 1, Math.round(el.scrollLeft / w)))
        scrollingRef.current = true
        el.scrollTo({ left: idx * w, behavior: 'smooth' })
        setSupplyIndex(idx)
        applySelection(idx)
        clearTimeout(scrollTimer.current)
        scrollTimer.current = setTimeout(() => {
            scrollingRef.current = false
            if (el) el.style.scrollSnapType = 'x mandatory'
        }, 400)
        try { el.releasePointerCapture(d.pointerId) } catch {}
        dragState.current = null
    }

    useEffect(() => {
        const el = scrollRef.current
        if (!el || supplies.length === 0) return
        const w = el.clientWidth
        el.scrollLeft = safeIndex * w
    }, [supplies.length])

    // Reset snap index and auto-select when searching
    useEffect(() => {
        setSupplyIndex(0)
        const el = scrollRef.current
        if (el) {
            el.scrollLeft = 0
        }
        if (searchQuery) {
            if (filteredSupplies.length > 0) {
                setSelectedUlm(filteredSupplies[0].ulm || 'all')
            } else {
                setSelectedUlm('all')
            }
        } else {
            setSelectedUlm('all')
        }
    }, [searchQuery])

    if (supplies.length === 0) {
        return (
            <div className="col-span-12 lg:col-span-4 relative overflow-hidden bg-white dark:from-[#1A1D23] dark:to-[#15171C] dark:bg-gradient-to-br rounded-[2rem] p-4 flex flex-col h-full min-h-[110px] shadow-[0_1px_2px_rgba(10,37,64,0.04)]">
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-[12px] text-slate-400">Nessuna fornitura</p>
                </div>
            </div>
        )
    }

    return (
        <div className="col-span-12 lg:col-span-4 relative overflow-hidden bg-white dark:from-[#1A1D23] dark:to-[#15171C] dark:bg-gradient-to-br rounded-[2rem] p-4 flex flex-col h-full min-h-[110px] shadow-[0_1px_2px_rgba(10,37,64,0.04)]">
            <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-[#1E5BFF]/5 blur-2xl pointer-events-none" />

            {/* Search Input for Quick Filtering */}
            {supplies.length > 3 && (
                <div className="mb-2 relative group shrink-0 z-10">
                    <input
                        type="text"
                        placeholder="Filtra forniture per indirizzo, ULM..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-9 w-full pl-9 pr-8 rounded-full bg-slate-100 dark:bg-white/10 text-[12px] text-slate-700 dark:text-slate-200 placeholder:text-slate-500 outline-none focus:ring-2 ring-[#1E5BFF]/20 transition-all"
                    />
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#93C5FD] transition-colors" />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            )}

            <div
                ref={scrollRef}
                onScroll={handleScroll}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={finishDrag}
                onPointerCancel={finishDrag}
                className="flex-1 flex overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 cursor-grab active:cursor-grabbing select-none touch-pan-x"
                style={{ scrollSnapType: 'x mandatory' }}
            >
                {filteredSupplies.length === 0 && searchQuery ? (
                    <div className="shrink-0 w-full snap-center px-4 flex items-center justify-center">
                        <div className="text-center p-4">
                            <p className="text-[12px] font-bold text-slate-400">Nessuna corrispondenza</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Prova con un altro indirizzo o ULM</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Intro slide (shown only when not searching) */}
                        {!searchQuery && (() => {
                            const cardIdx = 0
                            const distance = clientWidth > 0
                                ? Math.abs(scrollLeft - cardIdx * clientWidth) / clientWidth
                                : (safeIndex === cardIdx ? 0 : 1)
                            const progress = Math.max(0, Math.min(1, 1 - distance))

                            return (
                                <div className="shrink-0 w-full snap-center px-4">
                                    <div
                                        className="relative rounded-2xl p-4 flex flex-col h-full justify-center transition-all overflow-hidden text-white shadow-[0_4px_16px_rgba(30,91,255,0.08)] animate-gradient-shift"
                                        style={{
                                            background: 'linear-gradient(135deg, #064E3B 0%, #065F46 50%, #1E5BFF 100%)',
                                            transform: `scale(${0.98 + 0.02 * progress})`,
                                            opacity: 0.7 + 0.3 * progress,
                                            transition: 'transform 220ms ease-out, opacity 220ms ease-out',
                                            color: `color-mix(in srgb, currentColor, #ffffff ${progress * 100}%)`
                                        }}
                                    >
                                        {/* Inactive overlay — bg-slate-50/80 (light) or bg-[#1A1D23] (dark) */}
                                        <div
                                            className="absolute inset-0 bg-slate-50/80 dark:bg-[#1A1D23] border border-slate-100 dark:border-white/5 rounded-2xl pointer-events-none"
                                            style={{
                                                opacity: 1 - progress,
                                                transition: 'opacity 220ms ease-out'
                                            }}
                                        />

                                        <div className="absolute top-3 right-3 z-10">
                                            {/* Inactive badge */}
                                            <span
                                                className="text-[10px] px-2.5 py-1 rounded-full bg-[#1E5BFF]/10 text-[#1E5BFF] dark:text-[#93C5FD] dark:bg-white/10 transition-all"
                                                style={{ opacity: 1 - progress }}
                                            >
                                                {supplies.length} fornitur{supplies.length === 1 ? 'a' : 'e'}
                                            </span>
                                            {/* Active badge */}
                                            <span
                                                className="absolute inset-0 flex items-center justify-center text-[10px] px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white transition-all whitespace-nowrap"
                                                style={{ opacity: progress }}
                                            >
                                                {supplies.length} fornitur{supplies.length === 1 ? 'a' : 'e'}
                                            </span>
                                        </div>

                                        <p className="text-[14px] font-bold leading-snug z-10">
                                            Tutte le forniture
                                        </p>
                                        <p className={cn(
                                            "text-[12px] mt-1 z-10",
                                            safeIndex === 0 ? "text-white/80" : "text-slate-400 dark:text-slate-500"
                                        )}>
                                            Scorri per filtrare per fornitura.
                                        </p>

                                        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl" style={{ opacity: progress }}>
                                            <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-emerald-400/20 blur-3xl animate-wave-pulse" />
                                            <div className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl animate-wave-pulse" style={{ animationDelay: '2.5s' }} />
                                            <div className="absolute bottom-0 left-0 w-full h-24 overflow-hidden">
                                                <div className="absolute bottom-0 left-0 w-[200%] h-full flex animate-wave-slide reverse opacity-15" style={{ animationDuration: '25s' }}>
                                                    <svg className="w-1/2 h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
                                                        <path fill="#ffffff" d="M0,160 C240,160 480,60 720,160 C960,260 1200,160 1440,160 L1440,320 L0,320 Z" />
                                                    </svg>
                                                    <svg className="w-1/2 h-full -ml-[1px]" viewBox="0 0 1440 320" preserveAspectRatio="none">
                                                        <path fill="#ffffff" d="M0,160 C240,160 480,60 720,160 C960,260 1200,160 1440,160 L1440,320 L0,320 Z" />
                                                    </svg>
                                                </div>
                                                <div className="absolute bottom-0 left-0 w-[200%] h-full flex animate-wave-slide opacity-25" style={{ animationDuration: '18s' }}>
                                                    <svg className="w-1/2 h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
                                                        <path fill="#ffffff" d="M0,200 C360,200 480,100 720,200 C960,300 1080,200 1440,200 L1440,320 L0,320 Z" />
                                                    </svg>
                                                    <svg className="w-1/2 h-full -ml-[1px]" viewBox="0 0 1440 320" preserveAspectRatio="none">
                                                        <path fill="#ffffff" d="M0,200 C360,200 480,100 720,200 C960,300 1080,200 1440,200 L1440,320 L0,320 Z" />
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })()}
                        
                        {(searchQuery ? filteredSupplies : supplies).map((s: any, idx: number) => {
                            const status = getContractStatus(s.stadio)
                            const cardIdx = searchQuery ? idx : idx + 1
                            const distance = clientWidth > 0
                                ? Math.abs(scrollLeft - cardIdx * clientWidth) / clientWidth
                                : (safeIndex === cardIdx ? 0 : 1)
                            const progress = Math.max(0, Math.min(1, 1 - distance))

                            const inactiveStatusCls = STATUS_SOFT_CLASS[status.color]
                            const activeStatusCls = STATUS_GLASS_CLASS[status.color]

                            return (
                                <div key={s.id} className="shrink-0 w-full snap-center px-4">
                                    <div
                                        className="rounded-2xl p-3 flex flex-col h-full overflow-hidden relative text-white shadow-[0_4px_16px_rgba(30,91,255,0.08)] animate-gradient-shift"
                                        style={{
                                            background: 'linear-gradient(135deg, #064E3B 0%, #065F46 50%, #1E5BFF 100%)',
                                            transform: `scale(${0.98 + 0.02 * progress})`,
                                            opacity: 0.7 + 0.3 * progress,
                                            transition: 'transform 220ms ease-out, opacity 220ms ease-out',
                                            color: `color-mix(in srgb, currentColor, #ffffff ${progress * 100}%)`
                                        }}
                                    >
                                        {/* Inactive overlay — bg-slate-50/80 (light) or bg-[#1A1D23] (dark) */}
                                        <div
                                            className="absolute inset-0 bg-slate-50/80 dark:bg-[#1A1D23] border border-slate-100 dark:border-white/5 rounded-2xl pointer-events-none"
                                            style={{
                                                opacity: 1 - progress,
                                                transition: 'opacity 220ms ease-out'
                                            }}
                                        />

                                        <div className="flex items-center justify-between gap-2 mb-1.5 z-10">
                                            <span
                                                className="text-[10px] font-bold uppercase tracking-[0.18em] truncate"
                                                style={{
                                                    color: `color-mix(in srgb, #64748B ${(1 - progress) * 100}%, rgba(255,255,255,0.8) ${progress * 100}%)`
                                                }}
                                            >
                                                Fornitura
                                            </span>

                                            <div className="relative shrink-0 h-6 flex items-center">
                                                {/* Inactive Status Badge */}
                                                <span
                                                    className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap cursor-default transition-opacity", inactiveStatusCls)}
                                                    style={{ opacity: 1 - progress }}
                                                    title={`Contratto ${status.label}`}
                                                >
                                                    Contratto {status.label}
                                                </span>
                                                {/* Active Status Badge */}
                                                <span
                                                    className={cn("absolute right-0 text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap cursor-default transition-opacity", activeStatusCls)}
                                                    style={{ opacity: progress }}
                                                    title={`Contratto ${status.label}`}
                                                >
                                                    Contratto {status.label}
                                                </span>
                                            </div>
                                        </div>
                                        <div
                                            className="mb-1.5 z-10 leading-snug"
                                            style={{
                                                color: `color-mix(in srgb, currentColor, #ffffff ${progress * 100}%)`
                                            }}
                                        >
                                            <p className="text-[14px] font-bold break-words whitespace-normal">
                                                {s.address || 'Utenza'}
                                            </p>
                                            {s.city && (
                                                <p className="text-[11px] font-medium opacity-70 truncate">
                                                    {s.city}
                                                </p>
                                            )}
                                        </div>
                                        <div className="relative mt-auto z-10 h-7">
                                            {/* Inactive ULM */}
                                            <div className="absolute inset-0" style={{ opacity: 1 - progress, pointerEvents: progress > 0.5 ? 'none' : 'auto' }}>
                                                <CodeBadge value={s.codice_ulm || (s.cif ? String(s.cif).slice(-6) : s.ulm)} label="ULM" copyable light={false} />
                                            </div>
                                            {/* Active ULM */}
                                            <div className="absolute inset-0" style={{ opacity: progress, pointerEvents: progress <= 0.5 ? 'none' : 'auto' }}>
                                                <CodeBadge value={s.codice_ulm || (s.cif ? String(s.cif).slice(-6) : s.ulm)} label="ULM" copyable light={true} />
                                            </div>
                                        </div>

                                        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl" style={{ opacity: progress }}>
                                            <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-emerald-400/20 blur-3xl animate-wave-pulse" />
                                            <div className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl animate-wave-pulse" style={{ animationDelay: '2.5s' }} />
                                            <div className="absolute bottom-0 left-0 w-full h-24 overflow-hidden">
                                                <div className="absolute bottom-0 left-0 w-[200%] h-full flex animate-wave-slide reverse opacity-15" style={{ animationDuration: '25s' }}>
                                                    <svg className="w-1/2 h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
                                                        <path fill="#ffffff" d="M0,160 C240,160 480,60 720,160 C960,260 1200,160 1440,160 L1440,320 L0,320 Z" />
                                                    </svg>
                                                    <svg className="w-1/2 h-full -ml-[1px]" viewBox="0 0 1440 320" preserveAspectRatio="none">
                                                        <path fill="#ffffff" d="M0,160 C240,160 480,60 720,160 C960,260 1200,160 1440,160 L1440,320 L0,320 Z" />
                                                    </svg>
                                                </div>
                                                <div className="absolute bottom-0 left-0 w-[200%] h-full flex animate-wave-slide opacity-25" style={{ animationDuration: '18s' }}>
                                                    <svg className="w-1/2 h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
                                                        <path fill="#ffffff" d="M0,200 C360,200 480,100 720,200 C960,300 1080,200 1440,200 L1440,320 L0,320 Z" />
                                                    </svg>
                                                    <svg className="w-1/2 h-full -ml-[1px]" viewBox="0 0 1440 320" preserveAspectRatio="none">
                                                        <path fill="#ffffff" d="M0,200 C360,200 480,100 720,200 C960,300 1080,200 1440,200 L1440,320 L0,320 Z" />
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </>
                )}
            </div>

            {/* Segmented progress bar */}
            {totalSlides > 1 && (
                <div className="flex items-center gap-1 mt-3 shrink-0">
                    {Array.from({ length: totalSlides }).map((_, i: number) => (
                        <button
                            key={i}
                            onClick={() => scrollToIndex(i)}
                            className={cn(
                                "flex-1 h-1.5 rounded-full transition-colors duration-200",
                                i === safeIndex
                                    ? "bg-[#93C5FD] dark:bg-[#93C5FD]"
                                    : "bg-slate-200 hover:bg-slate-300 dark:bg-white/15 dark:hover:bg-white/25"
                            )}
                            title={i === 0 && !searchQuery ? 'Tutte' : `Fornitura ${searchQuery ? i + 1 : i}`}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

function InfoBadge({ label, value, full }: { label: string; value: string; full?: boolean }) {
    return (
        <div className={cn(
            "px-3 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 flex flex-col",
            full ? "w-full" : "min-w-[90px]"
        )}>
            <span className="text-[9px] font-medium text-white/40 uppercase tracking-[0.1em] leading-none mb-1.5">{label}</span>
            <span className="text-[12px] font-medium text-white leading-none truncate">{value}</span>
        </div>
    )
}
