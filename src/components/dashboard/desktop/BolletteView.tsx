'use client'

import { useMemo, useState, useRef, useEffect } from 'react'
import { FileText, CheckCircle2, Search, Eye, CreditCard, Droplets, X, ChevronLeft, ChevronRight, Calendar, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { billingTypeDisplay, DASHBOARD_TONE_CLASS } from '@/lib/billing-type'
import { formatEuro as formatEuroBase, monthYear } from '@/lib/format'
import { buildYearlyChartData, availableBillYears } from '@/lib/bill-chart'
import { DesktopSidebar } from '@/components/dashboard/desktop/DesktopSidebar'
import { useSidebarPin, sidebarMainOffset } from '@/components/dashboard/desktop/use-sidebar-pin'
import { RangeCalendar } from '@/components/dashboard/desktop/bollette/RangeCalendar'
import { YearlyConsumoChart } from '@/components/dashboard/desktop/bollette/YearlyConsumoChart'
import { SuppliesCarousel } from '@/components/dashboard/desktop/bollette/SuppliesCarousel'
import { InfoBadge } from '@/components/dashboard/desktop/bollette/InfoBadge'
import { WaveHero } from '@/components/dashboard/desktop/WaveHero'
import { MobileBollette } from '@/components/dashboard/mobile/MobileBollette'
import { MobileBollettaDetail } from '@/components/dashboard/mobile/MobileBollettaDetail'
import { initiatePagoPAPayment } from '@/actions/payment-actions'
import { PAGOPA_ENABLED } from '@/lib/features'
import type { Profile, Bill, UserSupply } from '@/types/dashboard'

interface BolletteViewProps {
    profile: Profile
    bills: Bill[]
    supplies?: UserSupply[]
}

type StatusFilter = 'all' | 'paid' | 'unpaid'

export function BolletteView({ bills: rawBills, supplies: rawSupplies = [], profile }: BolletteViewProps) {
    // Barra laterale bloccata aperta: il contenuto si sposta con lei.
    const { pinned } = useSidebarPin()
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

    const [selectedYear, setSelectedYear] = useState<number | null>(null)
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(8)
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [dateMenuOpen, setDateMenuOpen] = useState(false)
    const dateMenuRef = useRef<HTMLDivElement>(null)

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

    // Month-by-month spesa + consumo for the selected year. When "all" supplies
    // are selected the series aggregates across every supply (total monthly spend);
    // otherwise it's scoped to the chosen supply. The graph honours its own year
    // selector and is independent of the table's date filter.
    const graphBills = useMemo(
        () => (selectedUlm === 'all' ? bills : bills.filter((b: any) => b.ulm === selectedUlm)),
        [bills, selectedUlm]
    )

    const chartYears = useMemo(() => availableBillYears(graphBills), [graphBills])

    // Keep the selected year valid for the current supply/data. Default to the
    // most recent year that has data (fallback: current calendar year).
    useEffect(() => {
        if (chartYears.length === 0) {
            const cy = new Date().getFullYear()
            if (selectedYear !== cy) setSelectedYear(cy)
            return
        }
        if (selectedYear === null || !chartYears.includes(selectedYear)) {
            setSelectedYear(chartYears[0])
        }
    }, [chartYears, selectedYear])

    const yearlyData = useMemo(
        () => buildYearlyChartData(graphBills, selectedYear ?? new Date().getFullYear()),
        [graphBills, selectedYear]
    )

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

                <main className={cn(sidebarMainOffset(pinned), "h-screen overflow-hidden flex flex-col")}>
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

                            {/* Right Widget: Combined monthly spesa + consumo chart */}
                            <div className="col-span-12 lg:col-span-5 relative bg-white dark:bg-[#1A1D23] rounded-[2rem] p-4 flex flex-col h-full min-h-[110px]">
                                <YearlyConsumoChart
                                    data={yearlyData}
                                    years={chartYears}
                                    selectedYear={selectedYear ?? new Date().getFullYear()}
                                    onSelectYear={setSelectedYear}
                                    formatEuro={formatEuro}
                                />
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
                                                        const t = billingTypeDisplay(b.billing_type)
                                                        if (!t) return <span className="text-slate-400 dark:text-slate-600">-</span>
                                                        return (
                                                            <span className={cn(
                                                                'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider whitespace-nowrap',
                                                                DASHBOARD_TONE_CLASS[t.tone]
                                                            )}>
                                                                {t.label}
                                                            </span>
                                                        )
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
                                                            ) : (PAGOPA_ENABLED && b.expected_method === 'MP23') ? (
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
