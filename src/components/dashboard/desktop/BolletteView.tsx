'use client'

import { useMemo, useState, useLayoutEffect, useRef, useEffect } from 'react'
import { FileText, CheckCircle2, AlertCircle, Search, Download, Home, Building2, LineChart, BarChart3, Sun, Moon, Eye, CreditCard, Copy } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { DesktopSidebar } from '@/components/dashboard/desktop/DesktopSidebar'
import { WaveHero } from '@/components/dashboard/desktop/WaveHero'
import { MobileBollette } from '@/components/dashboard/mobile/MobileBollette'
import { MobileBollettaDetail } from '@/components/dashboard/mobile/MobileBollettaDetail'
import { initiatePagoPAPayment } from '@/actions/payment-actions'
import type { Profile, Bill } from '@/types/dashboard'
import type { UserSupply } from '@/components/dashboard/desktop/DesktopShell'

interface BolletteViewProps {
    profile: Profile
    bills: Bill[]
    supplies?: UserSupply[]
}

type StatusFilter = 'all' | 'paid' | 'unpaid'

function getSupplyStatus(stadio?: string | null): { label: string; dot: string; glow: string } {
    switch (stadio) {
        case '03': return { label: 'Attivo', dot: 'bg-emerald-500', glow: 'shadow-[0_0_8px_rgba(16,185,129,0.6)]' }
        case '04': return { label: 'In Lavorazione', dot: 'bg-amber-500', glow: 'shadow-[0_0_8px_rgba(245,158,11,0.6)]' }
        case '05': return { label: 'Chiuso', dot: 'bg-slate-400', glow: 'shadow-[0_0_8px_rgba(148,163,184,0.5)]' }
        case '08': return { label: 'Annullato', dot: 'bg-rose-500', glow: 'shadow-[0_0_8px_rgba(244,63,94,0.6)]' }
        default: return { label: stadio || '—', dot: 'bg-slate-300', glow: '' }
    }
}

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

    const [activeGraph, setActiveGraph] = useState<'spesa' | 'consumo'>('spesa')
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 8
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
        return list
    }, [sorted, filterStatus, search, selectedUlm])

    const paginated = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage
        return filtered.slice(start, start + itemsPerPage)
    }, [filtered, currentPage, itemsPerPage])

    const totalPages = Math.ceil(filtered.length / itemsPerPage)

    const monthYear = (date: string) =>
        new Date(date).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
    const formatEuro = (n: number) => `€${n.toFixed(2).replace('.', ',')}`

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
            <div className="hidden lg:block min-h-screen bg-white dark:bg-[#0F1115]">
                <DesktopSidebar />

                <main className="ml-20 h-screen overflow-hidden flex flex-col">
                    <div className="max-w-[1440px] w-full mx-auto flex-1 flex flex-col p-6 space-y-5 overflow-hidden">
                        <div className="shrink-0 space-y-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Storico</p>
                                <h1 className="text-3xl font-bold text-[#0A2540] dark:text-white tracking-tight">Le tue bollette</h1>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Theme Toggle */}
                                <button
                                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                                    className="h-10 w-10 rounded-xl bg-white dark:bg-[#1A1D23] flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
                                    title="Cambia tema"
                                >
                                    {themeMounted && theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                                </button>


                            </div>
                        </div>

                        {/* TOP ROW: OVERVIEW + FORNITURE + GRAPHS (Condensed) */}
                        <div className="grid grid-cols-12 gap-5 mb-5 h-[200px]">
                            {/* Left Widget: Overview */}
                            <div className="col-span-12 lg:col-span-4 flex flex-col">
                                <WaveHero className="p-4 flex flex-col justify-between h-full min-h-[110px]">
                                    <div>
                                        <div className="flex flex-col">
                                            <p className="text-[11px] font-medium text-white/50 uppercase tracking-[0.2em] mb-4 h-5 flex items-center">Ultima Bolletta</p>
                                            <p className="text-5xl font-medium tracking-tighter text-white mb-6">{formatEuro(totals.latestAmount)}</p>
                                            <div className="flex gap-3">
                                                <InfoBadge label="CIF" value={displayCif} />
                                                <InfoBadge label="Codice" value={displayCodice} />
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

                            {/* Middle Widget: Forniture List */}
                            <div className="col-span-12 lg:col-span-3 relative overflow-hidden bg-gradient-to-br from-white to-slate-50 dark:from-[#1A1D23] dark:to-[#15171C] rounded-[2rem] p-4 flex flex-col h-full min-h-[110px] shadow-[0_1px_2px_rgba(10,37,64,0.04)]">
                                <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-[#1E5BFF]/5 blur-2xl pointer-events-none" />
                                <div className="flex items-center justify-between mb-3 h-5 relative">
                                    <h2 className="text-[11px] font-medium text-slate-400 uppercase tracking-[0.2em]">Forniture</h2>
                                    <div className="flex items-center gap-1.5">
                                        {selectedUlm !== 'all' && (
                                            <button
                                                onClick={() => setSelectedUlm('all')}
                                                className="text-[9px] font-semibold text-slate-500 hover:text-[#1E5BFF] bg-slate-100 dark:bg-white/5 hover:bg-[#1E5BFF]/10 px-2 py-0.5 rounded-full transition-colors"
                                                title="Mostra tutte"
                                            >
                                                Tutte
                                            </button>
                                        )}
                                        <span className={cn(
                                            "text-[9px] font-semibold px-2 py-0.5 rounded-full",
                                            selectedUlm === 'all' ? "text-[#1E5BFF] bg-[#1E5BFF]/10" : "text-slate-400 bg-slate-100 dark:bg-white/5"
                                        )}>
                                            {supplies.length}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 relative">
                                    <div className="space-y-1.5">
                                        {supplies.map((s: any) => {
                                            const isActive = selectedUlm === s.ulm
                                            const status = getSupplyStatus(s.stadio)
                                            return (
                                                <div key={s.id}
                                                    onClick={() => setSelectedUlm(s.ulm)}
                                                    className={cn(
                                                        "p-2.5 rounded-xl transition-all cursor-pointer relative group/item",
                                                        isActive
                                                            ? "bg-gradient-to-r from-[#1E5BFF]/10 to-[#1E5BFF]/0 shadow-[0_4px_12px_rgba(30,91,255,0.08)]"
                                                            : "bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-2 mb-1.5">
                                                        <div className={cn(
                                                            "w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                                                            isActive ? "bg-[#1E5BFF] text-white" : "bg-slate-100 dark:bg-white/10 text-slate-400"
                                                        )}>
                                                            {/^(uff|via roma|corso)/i.test(s.address || '') ? <Building2 size={11} /> : <Home size={11} />}
                                                        </div>
                                                        <p className={cn("text-[10px] font-semibold truncate flex-1", isActive ? "text-[#1E5BFF]" : "text-[#0A2540] dark:text-white")}>
                                                            {s.address || 'Utenza'}
                                                        </p>
                                                        <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", status.dot, status.glow)} title={status.label} />
                                                    </div>
                                                    <div className="flex items-center pl-8">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigator.clipboard.writeText(s.codice_cliente);
                                                            }}
                                                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white dark:bg-white/5 hover:bg-[#1E5BFF]/5 transition-all"
                                                            title="Copia codice"
                                                        >
                                                            <span className="text-[8px] font-medium text-slate-400 uppercase tracking-wider">Cod.</span>
                                                            <span className="text-[9px] font-semibold text-[#0A2540] dark:text-white font-mono">{s.codice_cliente}</span>
                                                            <Copy size={8} className="text-[#1E5BFF] opacity-40 group-hover/item:opacity-100 transition-opacity" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Right Widget: Graphs */}
                            <div className="col-span-12 lg:col-span-5 bg-slate-50 dark:bg-[#1A1D23] rounded-[2rem] p-4 flex flex-col h-full min-h-[110px]">
                                <div className="flex items-center justify-between mb-4 h-5">
                                    <div /> {/* Spacer */}
                                    <div className="flex items-center gap-1 bg-slate-50 dark:bg-white/5 p-1 rounded-xl scale-90 origin-right">
                                        <button
                                            onClick={() => setActiveGraph('spesa')}
                                            className={cn("p-1.5 rounded-lg transition-colors flex items-center gap-2", activeGraph === 'spesa' ? "bg-white dark:bg-white/10 text-[#1E5BFF]" : "text-slate-400 hover:text-slate-600")}
                                        >
                                            <LineChart size={14} />
                                        </button>
                                        <button
                                            onClick={() => setActiveGraph('consumo')}
                                            className={cn("p-1.5 rounded-lg transition-colors flex items-center gap-2", activeGraph === 'consumo' ? "bg-white dark:bg-white/10 text-[#1E5BFF]" : "text-slate-400 hover:text-slate-600")}
                                        >
                                            <BarChart3 size={14} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 flex flex-col min-h-0 scale-y-[0.9] origin-top translate-y-[-10px]">
                                    {activeGraph === 'spesa' ? (
                                        <SpesaLineChart chartData={chartData} bills={bills} monthYear={monthYear} isAll={selectedUlm === 'all'} />
                                    ) : (
                                        <ConsumoBarChart chartData={chartData} isAll={selectedUlm === 'all'} />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* TABLE SECTION — Scrollable */}
                    <div className="flex-1 min-h-0 bg-slate-50 dark:bg-[#1A1D23] rounded-[2rem] p-5 overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between mb-4 gap-4">
                            <div>
                                <h2 className="text-lg font-bold text-[#0A2540] dark:text-white">Elenco bollette</h2>
                                <p className="text-[11px] text-slate-400">{filtered.length} risultati</p>
                            </div>
                            <div className="flex items-center gap-2">

                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        placeholder="Cerca bollette"
                                        className="h-9 pl-9 pr-4 rounded-full bg-slate-50 dark:bg-white/5 text-[12px] outline-none focus:ring-2 ring-[#1E5BFF]/20 w-64"
                                    />
                                </div>
                                <button className="h-9 w-9 rounded-full bg-slate-50 dark:bg-white/5 text-slate-500 flex items-center justify-center hover:bg-slate-100 transition-colors" title="Esporta">
                                    <Download size={14} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar rounded-2xl">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                        <th className="px-4 py-3 font-bold">Bolletta</th>
                                        <th className="px-4 py-3 font-bold">Emissione</th>
                                        <th className="px-4 py-3 font-bold text-right">Importo</th>
                                        <th className="px-4 py-3 font-bold">Consumo</th>
                                        <th className="px-4 py-3 font-bold">Fornitura</th>
                                        <th className="px-4 py-3 font-bold">Stato</th>
                                        <th className="px-4 py-3 font-bold text-right"></th>
                                    </tr>
                                </thead>
                                <tbody className="text-[13px]">
                                    {paginated.length === 0 ? (
                                        <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">Nessuna bolletta</td></tr>
                                    ) : paginated.map((b: any, idx: number) => {
                                        const isPaid = b.status === 'paid'
                                        const billId = (b.idboll || b.id).toString()
                                        return (
                                            <tr key={b.id || idx} className="border-t border-slate-100 dark:border-white/5 hover:bg-slate-50/60 dark:hover:bg-white/5 transition-colors group">
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn(
                                                            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                                                            isPaid ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-[#1E5BFF]"
                                                        )}>
                                                            {isPaid ? <CheckCircle2 size={18} /> : <FileText size={18} />}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-[#0A2540] dark:text-white capitalize">{monthYear(b.data_emissione)}</p>
                                                            <p className="text-[10px] font-mono text-slate-400 truncate">{billId.slice(0, 16)}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-slate-500 dark:text-slate-400">
                                                    {new Date(b.data_emissione).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </td>
                                                <td className="px-4 py-4 text-right font-bold text-[#0A2540] dark:text-white tracking-tight">
                                                    {formatEuro(Number(b.importo || 0))}
                                                </td>
                                                <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{b.consumo || 0} m³</td>
                                                <td className="px-4 py-4 font-mono text-[12px] text-slate-500">{b.ulm || '-'}</td>
                                                <td className="px-4 py-4">
                                                    {isPaid ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[11px] font-bold">
                                                            <CheckCircle2 size={11} /> Pagata
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FEF3C7] text-[#92400E] text-[11px] font-bold">
                                                            In attesa
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => setSelectedBill(b)}
                                                            className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                                                            title="Apri dettaglio"
                                                        >
                                                            <Eye size={16} />
                                                        </button>
                                                        {!isPaid && (
                                                            <button
                                                                onClick={() => handlePay(b)}
                                                                disabled={isPaying}
                                                                className="h-9 w-9 rounded-xl bg-[#1E5BFF] text-white flex items-center justify-center hover:bg-[#1E5BFF]/90 transition-colors disabled:opacity-50 shadow-sm shadow-[#1E5BFF]/20"
                                                                title="Paga ora"
                                                            >
                                                                <CreditCard size={16} />
                                                            </button>
                                                        )}
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
                                    Mostrando <span className="font-bold text-[#0A2540] dark:text-white">{(currentPage - 1) * itemsPerPage + 1}</span> - <span className="font-bold text-[#0A2540] dark:text-white">{Math.min(currentPage * itemsPerPage, filtered.length)}</span> di <span className="font-bold text-[#0A2540] dark:text-white">{filtered.length}</span> bollette
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                        className="px-4 py-2 rounded-xl bg-slate-50 dark:bg-white/5 text-[12px] font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors disabled:opacity-40"
                                    >
                                        Precedente
                                    </button>
                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                            <button
                                                key={p}
                                                onClick={() => setCurrentPage(p)}
                                                className={cn(
                                                    "w-7 h-7 rounded-[8px] text-[10px] font-bold transition-all duration-200 flex items-center justify-center",
                                                    currentPage === p 
                                                        ? "bg-[#1E5BFF]/15 text-[#1E5BFF] ring-2 ring-[#1E5BFF]/20" 
                                                        : "text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                                                )}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-4 py-2 rounded-xl bg-slate-50 dark:bg-white/5 text-[12px] font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors disabled:opacity-40"
                                    >
                                        Successivo
                                    </button>
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
    const realSlots = chartData.slots.map((slot: any, slotIdx: number) => ({ slot, slotIdx })).filter(({ slot }: any) => !!slot.bill)
    const realCount = realSlots.length
    const realStep = realCount > 1 ? width / (realCount - 1) : 0

    const realPoints = realSlots.map(({ slot, slotIdx }: any, i: number) => {
        const bill = slot.bill
        const val = Number(bill.importo || 0)
        const y = val > 0 ? 100 - ((val / maxCost) * 70 + 15) : 85
        const x = realCount > 1 ? margin + i * realStep : margin + width / 2
        return { x, y, cost: val, slotIdx, label: slot.label, key: slot.key }
    })

    const linePath = realPoints.length >= 2
        ? realPoints.reduce((acc: string, p: any, i: number, arr: any[]) => {
            if (i === 0) return `M ${p.x},${p.y}`
            const prev = arr[i - 1]
            const dx = p.x - prev.x
            return `${acc} C ${prev.x + dx / 2},${prev.y} ${p.x - dx / 2},${p.y} ${p.x},${p.y}`
        }, '')
        : ''
    const areaPath = realPoints.length >= 2
        ? `${linePath} L ${realPoints[realPoints.length - 1].x},100 L ${realPoints[0].x},100 Z`
        : ''
    const activePoint = realPoints.find((p: any) => p.slotIdx === selectedExpenseIndex) ?? null

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

    const placeholderLine = 'M 15,70 C 60,55 100,80 150,40 S 240,75 285,50'
    const placeholderArea = `${placeholderLine} L 285,100 L 15,100 Z`
    const isEmpty = realPoints.length === 0

    return (
        <div className="flex-1 flex flex-col relative h-full px-4">
            {isAll && (
                <div className="absolute inset-0 z-[60] bg-white/40 dark:bg-[#1A1D23]/40 backdrop-blur-[3px] rounded-[2rem] flex items-center justify-center text-center p-4">
                    <p className="text-[11px] font-bold text-[#0A2540] dark:text-white bg-white dark:bg-[#2A2D35] px-4 py-2 rounded-full shadow-sm">
                        Seleziona una fornitura per vedere il grafico
                    </p>
                </div>
            )}
            <div className="flex items-start justify-between mb-2">
                <div>
                    <p className="text-[9px] font-bold tracking-widest text-slate-400 uppercase mb-0.5">Spesa</p>
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
                            <stop offset="0%" stopColor="#84cc16" stopOpacity="0.32" />
                            <stop offset="100%" stopColor="#84cc16" stopOpacity="0" />
                        </linearGradient>
                        <pattern id="placeholderStripesBolletteV2" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                            <rect width="6" height="6" fill="transparent" />
                            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(100,116,139,0.35)" strokeWidth="1" />
                        </pattern>
                    </defs>
                    {isEmpty ? (
                        <>
                            <path d={placeholderArea} fill="url(#placeholderStripesBolletteV2)" opacity="0.5" />
                            <path d={placeholderLine} fill="none" stroke="rgba(100,116,139,0.5)" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                        </>
                    ) : (
                        <>
                            {areaPath && <path d={areaPath} fill="url(#spendingGradientBolletteV2)" />}
                            {linePath && (
                                <path d={linePath} fill="none" stroke="#84cc16" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                            )}
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
                        style={{ transform: `translateX(${(activePoint.x / 300) * chartSize.width}px)`, backgroundImage: 'repeating-linear-gradient(to bottom, rgba(132,204,22,0.4) 0 4px, transparent 4px 8px)' }} />
                )}
                {activePoint && chartSize.width > 0 && (
                    <div className="absolute top-0 left-0 pointer-events-none z-20 transition-transform duration-300 ease-out will-change-transform"
                        style={{ transform: `translate3d(${(activePoint.x / 300) * chartSize.width}px, ${(activePoint.y / 100) * chartSize.height}px, 0)` }}>
                        <div className="absolute -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-[2.5px] border-[#84cc16]" />
                    </div>
                )}
                {activePoint && chartSize.width > 0 && (
                    <div className="absolute top-0 left-0 bg-[#C6F36B] text-[#0A2540] px-2.5 py-1 rounded-lg text-[10px] font-bold pointer-events-none z-30 whitespace-nowrap transition-transform duration-300 ease-out will-change-transform"
                        style={{ transform: `translate3d(${(activePoint.x / 300) * chartSize.width}px, ${(activePoint.y / 100) * chartSize.height - 16}px, 0) translate(-50%, -100%)` }}>
                        €{activePoint.cost.toFixed(2).replace('.', ',')}
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#C6F36B] rotate-45" />
                    </div>
                )}
            </div>

            <div className="flex justify-center gap-4 mt-1 max-w-md mx-auto w-full h-4">
                {realPoints.map((p: any) => (
                    <span key={p.key}
                        className={cn("text-[8px] font-bold uppercase tracking-tighter w-12 text-center transition-colors duration-200",
                            selectedExpenseIndex === p.slotIdx ? "text-[#84cc16]" : "text-slate-400")}>
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
        <div className="flex-1 flex flex-col relative overflow-hidden h-full px-4">
            {isAll && (
                <div className="absolute inset-0 z-[60] bg-white/40 dark:bg-[#1A1D23]/40 backdrop-blur-[3px] rounded-[2rem] flex items-center justify-center text-center p-4">
                    <p className="text-[11px] font-bold text-[#0A2540] dark:text-white bg-white dark:bg-[#2A2D35] px-4 py-2 rounded-full shadow-sm">
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

            <div className="flex items-end justify-center gap-5 h-24 mt-2 max-w-md mx-auto w-full">
                {chartData.slots.map((slot: any, i: number) => {
                    const isSelected = selectedBarIndex === i
                    const hasData = slot.value !== null
                    const heightPct = hasData
                        ? ((slot.value as number) / chartData.max) * 100
                        : chartData.placeholderHeights[i % chartData.placeholderHeights.length]
                    return (
                        <div key={slot.key} className="flex flex-col items-center justify-end h-full relative cursor-pointer" onClick={() => hasData && setSelectedBarIndex(i)}>
                            {isSelected && hasData && (
                                <span className="absolute px-2 py-0.5 rounded-md bg-[#C6F36B] text-[#0A2540] text-[10px] font-bold whitespace-nowrap z-10" style={{ bottom: `calc(${Math.max(heightPct, 20)}% + 14px)` }}>
                                    {slot.value} mc
                                </span>
                            )}
                            <div
                                className="w-10 rounded-xl relative overflow-hidden transition-[height] duration-300"
                                style={{ height: `${Math.max(heightPct, hasData ? 20 : 12)}%` }}
                            >
                                {hasData ? (
                                    <>
                                        <div className="absolute inset-0 bg-blue-200 dark:bg-blue-900/30" />
                                        <div className={cn("absolute inset-0 bg-gradient-to-t from-[#1E5BFF] to-[#60A5FA] transition-opacity duration-300", isSelected ? "opacity-100" : "opacity-0")} />
                                    </>
                                ) : (
                                    <div className="absolute inset-0 bg-slate-50 dark:bg-white/5" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent 0, transparent 5px, rgba(100, 116, 139, 0.4) 5px, rgba(100, 116, 139, 0.4) 7px)' }} />
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
            <div className="flex justify-center gap-5 mt-1 max-w-md mx-auto w-full">
                {chartData.slots.map((slot: any, i: number) => (
                    <span key={slot.key}
                        className={cn("w-10 text-center text-[8px] font-bold uppercase tracking-tighter transition-colors duration-200",
                            selectedBarIndex === i ? "text-[#1E5BFF]" : "text-slate-400")}>
                        {slot.label}
                    </span>
                ))}
            </div>
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
