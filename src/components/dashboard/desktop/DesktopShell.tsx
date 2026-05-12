'use client'

import { useMemo, useState } from 'react'
import React from 'react'
import { FileText, Download, Home, Building2, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { initiatePagoPAPayment } from '@/actions/payment-actions'
import { MobileBollettaDetail } from '@/components/dashboard/mobile/MobileBollettaDetail'
import { useDashboard } from '@/components/dashboard/dashboard-context'
import { DesktopSidebar } from '@/components/dashboard/desktop/DesktopSidebar'
import { WaveHero } from '@/components/dashboard/desktop/WaveHero'
import type { Profile, Bill } from '@/types/dashboard'

export interface UserSupply {
    codice_cliente?: string
    cif?: string
    address?: string
    city?: string
    ulm?: string
    [key: string]: any
}

interface DesktopShellProps {
    profile: Profile
    bills: Bill[]
    supplies?: UserSupply[]
    stats: {
        firstName: string
        fullName: string
        clientCode: string
        fiscalCode?: string
        address?: string
        email?: string
        phone?: string
        lastConsumption: number
        percentageBadge: React.ReactNode
    }
}

export function DesktopShell({ bills, supplies = [], stats }: DesktopShellProps) {
    const { selectedSupply, setSelectedSupply } = useDashboard()

    const [selectedBill, setSelectedBill] = useState<Bill | null>(null)
    const [isPaying, setIsPaying] = useState(false)
    const [range, setRange] = useState<'12M' | '6M' | '3M'>('12M')

    const { firstName, lastName } = useMemo(() => {
        const name = (stats.fullName || stats.firstName || '').trim()
        const parts = name.split(/\s+/)
        return {
            firstName: parts[0] || '',
            lastName: parts.slice(1).join(' ')
        }
    }, [stats.fullName, stats.firstName])

    const monthYear = (date: string) =>
        new Date(date).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
    const formatEuro = (n: number) => `€${n.toFixed(2).replace('.', ',')}`

    // Bills filtered to selected supply (or all)
    const supplyBills = useMemo(() => {
        if (selectedSupply === 'all') return bills
        return bills.filter(b => b.ulm === selectedSupply)
    }, [bills, selectedSupply])

    const sortedBills = useMemo(() =>
        [...supplyBills].sort((a, b) => new Date(b.data_emissione).getTime() - new Date(a.data_emissione).getTime())
    , [supplyBills])

    const nextBill = useMemo(() => {
        return sortedBills.find((b: any) => (b.status || 'unpaid') === 'unpaid') || sortedBills[0]
    }, [sortedBills])

    const currentYear = new Date().getFullYear()
    const yearStats = useMemo(() => {
        const thisYear = supplyBills.filter(b => new Date(b.data_emissione).getFullYear() === currentYear)
        const lastYear = supplyBills.filter(b => new Date(b.data_emissione).getFullYear() === currentYear - 1)
        const sum = (arr: Bill[]) => arr.reduce((s, b) => s + Number((b as any).importo || 0), 0)
        const total = sum(thisYear)
        const prev = sum(lastYear)
        const delta = prev > 0 ? ((total - prev) / prev) * 100 : 0
        return { total, prev, delta }
    }, [supplyBills, currentYear])

    // Monthly consumption (last N months based on range)
    const months = range === '3M' ? 3 : range === '6M' ? 6 : 12
    const consumoSeries = useMemo(() => {
        const now = new Date()
        const series: Array<{ label: string; value: number | null; ym: string }> = []
        for (let i = months - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
            const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            const bill = supplyBills.find(b => {
                const bd = new Date(b.data_emissione)
                return bd.getFullYear() === d.getFullYear() && bd.getMonth() === d.getMonth()
            })
            series.push({
                label: d.toLocaleDateString('it-IT', { month: 'short' }).replace('.', ''),
                value: bill ? Number(bill.consumo || 0) : null,
                ym
            })
        }
        return series
    }, [supplyBills, months])

    const consumoStats = useMemo(() => {
        const vals = consumoSeries.map(s => s.value).filter((v): v is number => v !== null && v > 0)
        if (vals.length === 0) return { media: 0, picco: 0, picMese: '-', totale: 0 }
        const totale = vals.reduce((a, b) => a + b, 0)
        const media = totale / vals.length
        const max = Math.max(...vals)
        const picMese = consumoSeries.find(s => s.value === max)?.label || '-'
        return { media: Math.round(media), picco: max, picMese, totale }
    }, [consumoSeries])

    const maxConsumo = Math.max(...consumoSeries.map(s => s.value || 0), 1)

    const handlePay = async (bill: Bill) => {
        if (isPaying) return
        setIsPaying(true)
        try {
            const amount = Number((bill as any).importo || 0)
            const result = await initiatePagoPAPayment(bill.id, amount)
            if ('error' in result && result.error) {
                alert(result.error)
                return
            }
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
            <div className="hidden lg:block">
                <MobileBollettaDetail
                    bill={selectedBill}
                    supply={matchingSupply}
                    onBack={() => setSelectedBill(null)}
                    onPay={handlePay}
                    isPaying={isPaying}
                    onNext={onNext}
                    onPrev={onPrev}
                    allBills={bills}
                    onSelectBill={setSelectedBill}
                />
            </div>
        )
    }

    const dueDate = (nextBill as any)?.scadenza || (nextBill as any)?.data_scadenza
    const dueDateLabel = dueDate ? new Date(dueDate).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'

    return (
        <div className="hidden lg:block h-screen overflow-hidden bg-[#F5F1EA] dark:bg-[#0F1115]">
            <DesktopSidebar />

            {/* MAIN — content shifted right by collapsed sidebar width */}
            <main className="ml-20 h-full overflow-hidden flex flex-col">
                {/* TOP BAR */}
                <div className="px-8 pt-6 pb-5 shrink-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Bentornato</p>
                    <h1 className="text-3xl font-bold text-[#0A2540] dark:text-white tracking-tight">
                        Ciao, {firstName}{lastName && <> <span className="text-[#1E5BFF]">{lastName}</span></>}.
                    </h1>
                </div>

                {/* GRID */}
                <div className="flex-1 min-h-0 px-8 pb-6 grid grid-cols-12 grid-rows-2 gap-5">
                    {/* Next bill hero */}
                    <WaveHero className="col-span-8 row-span-1 p-6 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="w-2 h-2 rounded-full bg-[#84cc16]" />
                                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-200/80">
                                    Prossima Bolletta {nextBill && (nextBill as any).status === 'unpaid' && '- In Scadenza'}
                                </p>
                            </div>
                            <div className="text-6xl font-extrabold tracking-tight leading-none mb-4">
                                {nextBill ? formatEuro(Number((nextBill as any).importo || 0)) : '€ -'}
                            </div>
                            <div className="grid grid-cols-4 gap-4">
                                <Meta label="Scadenza" value={dueDateLabel} />
                                <Meta label="Consumo" value={nextBill ? `${(nextBill as any).consumo || 0} m³` : '-'} />
                                <Meta label="Fornitura" value={(nextBill as any)?.ulm || '-'} mono />
                                <Meta label="Ciclo" value={nextBill ? monthYear((nextBill as any).data_emissione) : '-'} />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-5">
                            <button
                                onClick={() => nextBill && handlePay(nextBill)}
                                disabled={!nextBill || isPaying || (nextBill as any).status === 'paid'}
                                className="h-11 px-5 rounded-xl bg-[#C6F36B] text-[#0A2540] text-[13px] font-bold hover:bg-[#B5E35A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Paga con PagoPA
                            </button>
                            <button
                                onClick={() => nextBill && setSelectedBill(nextBill)}
                                disabled={!nextBill}
                                className="h-11 px-5 rounded-xl bg-white/15 backdrop-blur-md text-white text-[13px] font-bold flex items-center gap-2 hover:bg-white/20 transition-colors disabled:opacity-50"
                            >
                                <Download size={14} /> Scarica PDF
                            </button>
                        </div>
                    </WaveHero>

                    {/* Right column: Forniture + Spesa */}
                    <div className="col-span-4 row-span-1 flex flex-col gap-5 min-h-0">
                        <div className="bg-white dark:bg-[#1A1D23] rounded-[2rem] p-5 shrink-0 flex flex-col max-h-[55%]">
                            <p className="text-[9px] font-bold tracking-widest text-slate-400 uppercase mb-3">Le tue forniture</p>
                            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-2">
                                {supplies.length === 0 && (
                                    <p className="text-[11px] text-slate-400 text-center py-4">Nessuna fornitura</p>
                                )}
                                {supplies.map((s, i) => {
                                    const isActive = (s.ulm || 'all') === selectedSupply || (selectedSupply === 'all' && i === 0)
                                    return (
                                        <button
                                            key={i}
                                            onClick={() => setSelectedSupply(s.ulm || 'all')}
                                            className={cn(
                                                "w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors text-left",
                                                isActive ? "bg-slate-50 dark:bg-white/5" : "hover:bg-slate-50 dark:hover:bg-white/5"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                                                isActive ? "bg-[#1E5BFF] text-white" : "bg-slate-100 dark:bg-white/5 text-slate-400"
                                            )}>
                                                {/^(uff|via roma|corso)/i.test(s.address || '') ? <Building2 size={16} /> : <Home size={16} />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[12px] font-bold text-[#0A2540] dark:text-white truncate">{s.address || `Fornitura ${i + 1}`}</p>
                                                {s.city && <p className="text-[10px] text-slate-400 truncate">{s.city}</p>}
                                            </div>
                                            {s.ulm && (
                                                <span className="text-[9px] font-mono font-bold text-slate-400 uppercase shrink-0">{s.ulm}</span>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="bg-white dark:bg-[#1A1D23] rounded-[2rem] p-5 shrink-0">
                            <p className="text-[9px] font-bold tracking-widest text-slate-400 uppercase mb-1">Spesa {currentYear}</p>
                            <div className="flex items-end justify-between">
                                <div>
                                    <h3 className="text-2xl font-bold text-[#0A2540] dark:text-white tracking-tight">
                                        {formatEuro(yearStats.total)}
                                    </h3>
                                    <div className={cn(
                                        "flex items-center gap-1 text-[10px] font-bold mt-1",
                                        yearStats.delta >= 0 ? "text-rose-500" : "text-emerald-500"
                                    )}>
                                        {yearStats.delta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                                        {yearStats.delta >= 0 ? '+' : ''}{yearStats.delta.toFixed(1)}% vs {currentYear - 1}
                                    </div>
                                </div>
                                <Sparkline series={consumoSeries.map(s => s.value || 0)} />
                            </div>
                        </div>
                    </div>

                    {/* Consumo chart */}
                    <div className="col-span-8 row-span-1 bg-white dark:bg-[#1A1D23] rounded-[2rem] p-5 flex flex-col min-h-0">
                        <div className="flex items-start justify-between mb-2 shrink-0">
                            <div>
                                <h3 className="text-lg font-bold text-[#0A2540] dark:text-white tracking-tight">Consumo mensile</h3>
                                <p className="text-[10px] text-slate-400 font-medium">Metri cubi · {currentYear} · passa il mouse sulle barre</p>
                            </div>
                            <div className="flex gap-1 bg-slate-50 dark:bg-white/5 rounded-lg p-1">
                                {(['12M', '6M', '3M'] as const).map(r => (
                                    <button
                                        key={r}
                                        onClick={() => setRange(r)}
                                        className={cn(
                                            "px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors",
                                            range === r ? "bg-white dark:bg-white/10 text-[#0A2540] dark:text-white" : "text-slate-400"
                                        )}
                                    >{r}</button>
                                ))}
                            </div>
                        </div>
                        <ConsumoBars series={consumoSeries} maxValue={maxConsumo} />
                        <div className="grid grid-cols-4 gap-4 pt-3 border-t border-slate-100 dark:border-white/5 shrink-0">
                            <Meta dark label="Media mensile" value={`${consumoStats.media} m³`} />
                            <Meta dark label="Picco" value={`${consumoStats.picco} m³ · ${consumoStats.picMese}`} />
                            <Meta dark label="Totale anno" value={`${consumoStats.totale} m³`} />
                            <Meta dark label="Previsione" value={`~${consumoStats.media} m³`} />
                        </div>
                    </div>

                    {/* Recent bills */}
                    <div className="col-span-4 row-span-1 bg-white dark:bg-[#1A1D23] rounded-[2rem] p-5 flex flex-col min-h-0">
                        <div className="flex items-center justify-between mb-3 shrink-0">
                            <h3 className="text-lg font-bold text-[#0A2540] dark:text-white tracking-tight">Bollette recenti</h3>
                            <button className="text-[10px] font-bold text-[#1E5BFF] hover:underline">Tutte →</button>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-1">
                            {sortedBills.length === 0 ? (
                                <p className="text-[11px] text-slate-400 text-center py-6">Nessuna bolletta</p>
                            ) : (
                                sortedBills.slice(0, 5).map((bill: any) => (
                                    <button
                                        key={bill.id}
                                        onClick={() => setSelectedBill(bill)}
                                        className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left"
                                    >
                                        <div className={cn(
                                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                                            bill.status === 'paid' ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-500"
                                        )}>
                                            <FileText size={14} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[12px] font-bold text-[#0A2540] dark:text-white capitalize truncate">{monthYear(bill.data_emissione)}</p>
                                            <p className="text-[9px] font-mono text-slate-400 truncate">
                                                {(bill.idboll || bill.id).toString().slice(0, 12)} · {bill.consumo || 0} m³
                                            </p>
                                        </div>
                                        <p className="text-[12px] font-bold text-[#0A2540] dark:text-white shrink-0">
                                            {formatEuro(Number(bill.importo || 0))}
                                        </p>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}

function Meta({ label, value, mono, dark }: { label: string; value: string; mono?: boolean; dark?: boolean }) {
    return (
        <div>
            <p className={cn(
                "text-[9px] font-bold uppercase tracking-widest mb-0.5",
                dark ? "text-slate-400" : "text-emerald-200/60"
            )}>{label}</p>
            <p className={cn(
                "text-[13px] font-bold truncate",
                dark ? "text-[#0A2540] dark:text-white" : "text-white",
                mono && "font-mono uppercase"
            )}>{value}</p>
        </div>
    )
}

function Sparkline({ series }: { series: number[] }) {
    const max = Math.max(...series, 1)
    const w = 80
    const h = 32
    const step = series.length > 1 ? w / (series.length - 1) : 0
    const points = series.map((v, i) => `${i * step},${h - (v / max) * h}`).join(' ')
    return (
        <svg viewBox={`0 0 ${w} ${h}`} className="w-20 h-8">
            <polyline points={points} fill="none" stroke="#84cc16" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

function ConsumoBars({ series, maxValue }: { series: Array<{ label: string; value: number | null; ym: string }>; maxValue: number }) {
    const [hover, setHover] = useState<number | null>(null)
    const lastRealIdx = series.reduce((acc, s, i) => s.value !== null ? i : acc, -1)
    const activeIdx = hover ?? lastRealIdx

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex items-end justify-between gap-1.5 flex-1 min-h-0 pt-6">
                {series.map((s, i) => {
                    const isActive = i === activeIdx
                    const hasData = s.value !== null
                    const heightPct = hasData ? (s.value! / maxValue) * 100 : 8
                    return (
                        <div
                            key={s.ym}
                            className="flex-1 h-full flex flex-col items-center justify-end relative cursor-pointer"
                            onMouseEnter={() => hasData && setHover(i)}
                            onMouseLeave={() => setHover(null)}
                        >
                            {isActive && hasData && (
                                <span className="absolute px-1.5 py-0.5 rounded-md bg-[#C6F36B] text-[#0A2540] text-[9px] font-bold whitespace-nowrap z-10" style={{ bottom: `calc(${Math.max(heightPct, 15)}% + 8px)` }}>
                                    {s.value} m³
                                </span>
                            )}
                            <div
                                className={cn(
                                    "w-full rounded-md transition-colors",
                                    !hasData ? "bg-slate-100 dark:bg-white/5" :
                                    isActive ? "bg-gradient-to-t from-[#0A2540] to-[#1E5BFF]" : "bg-blue-200/80 dark:bg-blue-900/40"
                                )}
                                style={{ height: `${Math.max(heightPct, hasData ? 12 : 8)}%` }}
                            />
                        </div>
                    )
                })}
            </div>
            <div className="flex justify-between gap-1.5 pt-1.5 pb-2">
                {series.map((s, i) => (
                    <span
                        key={s.ym}
                        className={cn(
                            "flex-1 text-center text-[9px] font-bold uppercase tracking-tighter capitalize",
                            i === activeIdx ? "text-[#1E5BFF]" : "text-slate-400"
                        )}
                    >
                        {s.label}
                    </span>
                ))}
            </div>
        </div>
    )
}
