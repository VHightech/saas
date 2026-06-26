'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import React from 'react'
import { BarChart3, LifeBuoy, Files, LogOut, Layers } from 'lucide-react'
import { BillListItem } from './BillListItem'
import { cn } from '@/lib/utils'
import { formatEuro, monthYear } from '@/lib/format'
import { buildYearlyChartData, availableBillYears } from '@/lib/bill-chart'
import { consumptionAdvice, type AdviceLevel } from '@/lib/consumption-advice'
import { YearlyConsumoChart } from '@/components/dashboard/desktop/bollette/YearlyConsumoChart'
import type { Profile, Bill } from '@/types/dashboard'

interface MobileHomeProps {
    profile: Profile
    bills: Bill[]
    supplies?: any[]
    stats: {
        firstName: string
        fullName: string
        clientCode: string
        lastConsumption: number
        percentageBadge: React.ReactNode
    }
    unpaidCount?: number
    onGoToBollette: () => void
    onGoToConfronto: () => void
    onGoToSupporto: () => void
    onGoToProfilo: () => void
    onSelectBill: (bill: Bill) => void
    onPay?: (bill: Bill) => void
    selectedSupplyId?: string
    onSelectSupply?: (id: string) => void
    onLogout?: () => void
}

export function MobileHome({ profile, bills = [], supplies = [], stats, unpaidCount = 0, onGoToBollette, onGoToConfronto, onGoToSupporto, onGoToProfilo, onSelectBill, onPay, selectedSupplyId, onSelectSupply, onLogout }: MobileHomeProps) {
    const getSupplyId = (s: any) => s?.ulm || 'all'

    const carouselItems = useMemo(() => {
        if (!supplies || supplies.length <= 1) return supplies || []
        return [
            {
                ulm: 'all',
                address: 'Tutte le forniture',
                isVirtualAll: true
            },
            ...supplies
        ]
    }, [supplies])

    // Initialize with correct index from context to prevent flickering
    const [selectedIdx, setSelectedIdx] = useState(() => {
        const items = carouselItems || []
        if (selectedSupplyId && items.length > 0) {
            const idx = items.findIndex(s => getSupplyId(s) === selectedSupplyId)
            return idx !== -1 ? idx : 0
        }
        return 0
    })

    const scrollRef = useRef<HTMLDivElement>(null)
    const [selectedYear, setSelectedYear] = useState<number | null>(null)
    // Live scroll position for smooth gradient / scale / color interpolation
    // between supply cards as the user swipes.
    const [scrollLeft, setScrollLeft] = useState(0)
    const [cardStep, setCardStep] = useState(0)
    useEffect(() => {
        if (scrollRef.current) setCardStep(scrollRef.current.clientWidth + 12)
    }, [carouselItems.length])

    // Sync scroll position on mount or when selectedSupplyId changes
    useEffect(() => {
        const items = carouselItems || []
        if (selectedSupplyId && items.length > 0 && scrollRef.current) {
            const idx = items.findIndex(s => getSupplyId(s) === selectedSupplyId)
            if (idx !== -1) {
                const cardWidth = scrollRef.current.clientWidth
                scrollRef.current.scrollLeft = idx * (cardWidth + 12)
                setSelectedIdx(idx)
            }
        }
    }, [selectedSupplyId, carouselItems])

    // Coalesce scroll events to one update per animation frame so we don't
    // re-render the whole view multiple times per frame while swiping.
    const rafRef = useRef<number | null>(null)
    const handleScroll = () => {
        if (rafRef.current !== null) return
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null
            const el = scrollRef.current
            if (!el) return
            const sl = el.scrollLeft
            const cardWidth = el.clientWidth
            setScrollLeft(sl)
            setCardStep(cardWidth + 12)
            const newIdx = Math.round(sl / (cardWidth + 12))
            if (newIdx !== selectedIdx && newIdx >= 0 && newIdx < carouselItems.length) {
                setSelectedIdx(newIdx)
                if (carouselItems[newIdx]) {
                    onSelectSupply?.(getSupplyId(carouselItems[newIdx]))
                }
            }
        })
    }
    useEffect(() => () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }, [])

    const currentSupply = carouselItems[selectedIdx] || carouselItems[0]
    const initials = useMemo(() => {
        const name = stats.fullName || stats.firstName || 'U'
        const parts = name.trim().split(/\s+/)
        return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'U'
    }, [stats.fullName, stats.firstName])


    const sortedBills = useMemo(() => {
        const supplyUlm = currentSupply?.ulm
        // Only show bills that actually belong to the currently-viewed supply.
        // If the supply has no ulm (registered supply not linked to any bill),
        // show nothing — never leak bills from other (e.g. unregistered) ULMs.
        if (!supplyUlm) return []
        if (supplyUlm === 'all') {
            return [...bills].sort((a, b) => new Date(b.data_emissione).getTime() - new Date(a.data_emissione).getTime())
        }
        return bills
            .filter((b: any) => b.ulm === supplyUlm)
            .sort((a, b) => new Date(b.data_emissione).getTime() - new Date(a.data_emissione).getTime())
    }, [bills, currentSupply])

    // Month-by-month spesa + consumo for the selected single supply. "all" shows
    // the prompt to pick one (no aggregate graph on mobile home).
    const graphBills = useMemo(() => {
        const supplyUlm = currentSupply?.ulm
        if (!supplyUlm || supplyUlm === 'all') return []
        return bills.filter((b: any) => b.ulm === supplyUlm)
    }, [bills, currentSupply])

    const chartYears = useMemo(() => availableBillYears(graphBills), [graphBills])

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

    // Confronto is only meaningful for a single fornitura; surface its advice as
    // an alert badge on the quick action, and disable it on the "all" overview.
    const confrontoDisabled = !currentSupply?.ulm || currentSupply.ulm === 'all'
    const advice = useMemo(() => consumptionAdvice(graphBills), [graphBills])
    const confrontoAlert: AdviceLevel | null = confrontoDisabled
        ? null
        : advice.level === 'alert' || advice.level === 'warn'
            ? advice.level
            : null

    return (
        <div className="px-4 pb-8 space-y-4">
            {/* Header Row */}
            <div className="pt-4 flex items-center justify-between">
                <button
                    onClick={onGoToProfilo}
                    className="w-12 h-12 rounded-full bg-gradient-to-br from-[#0A2540] to-[#1E5BFF] flex items-center justify-center text-white font-bold text-sm shadow-md border-2 border-white/10 active:scale-90 transition-transform shrink-0"
                >
                    {initials}
                </button>

                <button
                    onClick={onLogout}
                    className="w-12 h-12 rounded-full bg-red-500/25 dark:bg-red-500/20 backdrop-blur-md border border-red-400/40 dark:border-red-400/30 shadow-sm flex items-center justify-center text-red-600 dark:text-red-400 active:scale-90 transition-transform shrink-0 pl-0.5"
                >
                    <LogOut size={22} strokeWidth={2.5} />
                </button>
            </div>

            {/* Supply Card Slider */}
            <div className="relative mb-6">
                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className={cn(
                        "flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-3",
                        carouselItems.length === 1 && "justify-center overflow-x-hidden snap-none"
                    )}
                >
                    {carouselItems.map((s, idx) => {
                        const isActive = idx === selectedIdx
                        // Smooth per-card "centeredness" — 1 when perfectly centered,
                        // 0 when one card width away. Drives gradient fade / scale /
                        // text color so swipes feel continuous instead of snapping.
                        const distance = cardStep > 0
                            ? Math.abs(scrollLeft - idx * cardStep) / cardStep
                            : (isActive ? 0 : 1)
                        const progress = Math.max(0, Math.min(1, 1 - distance))
                        const inactiveColor = '#94A3B8'
                        const activeColor = '#FFFFFF'
                        const isAll = getSupplyId(s) === 'all'

                        return (
                            <div
                                key={`supply-hero-${idx}`}
                                onClick={() => {
                                    onSelectSupply?.(getSupplyId(s))
                                    setSelectedIdx(idx)
                                    if (scrollRef.current) {
                                        const cardWidth = scrollRef.current.clientWidth
                                        scrollRef.current.scrollTo({
                                            left: idx * (cardWidth + 12),
                                            behavior: 'smooth'
                                        })
                                    }
                                }}
                                className="snap-center w-full min-w-full shrink-0"
                            >
                                <div
                                    className="relative overflow-hidden rounded-[2rem] p-5 flex flex-col justify-between h-48 animate-gradient-shift"
                                    style={{
                                        background: isAll
                                            ? 'linear-gradient(135deg, #0A2540 0%, #1A365D 50%, #1E5BFF 100%)'
                                            : 'linear-gradient(135deg, #064E3B 0%, #065F46 50%, #1E5BFF 100%)',
                                        // Driven directly by scroll position — NO transition, so the
                                        // card tracks the finger 1:1 instead of easing in late.
                                        // Off-centre cards blur for a depth-of-field swipe feel.
                                        transform: `scale(${0.95 + 0.05 * progress})`,
                                        opacity: 0.5 + 0.5 * progress,
                                        filter: `blur(${(1 - progress) * 2.5}px)`,
                                        // Ease only the blur so it doesn't strobe during fast swipes;
                                        // scale/opacity stay finger-tracked (no positional lag).
                                        transition: 'filter 160ms ease-out',
                                        willChange: 'transform, opacity, filter',
                                    }}
                                >
                                    {/* White inactive overlay — fades out as the card centers */}
                                    <div
                                        className="absolute inset-0 bg-white dark:bg-[#1A1D23] pointer-events-none"
                                        style={{ opacity: 1 - progress, willChange: 'opacity' }}
                                    />

                                    <div className="relative z-10 flex flex-col h-full justify-between" style={{ color: `color-mix(in srgb, ${inactiveColor} ${(1 - progress) * 100}%, ${activeColor} ${progress * 100}%)` }}>
                                        {isAll ? (
                                            <div className="w-full h-full flex flex-col items-center justify-center">
                                                <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-3 shadow-[0_8px_16px_rgba(0,0,0,0.1)] border border-white/20">
                                                    <Layers className="text-white opacity-90" strokeWidth={1.5} size={28} />
                                                </div>
                                                <h3 className="text-[17px] font-black tracking-tight uppercase text-white/95">
                                                    Panoramica Utenze
                                                </h3>
                                                <p className="text-[13px] font-medium opacity-80 mt-1.5 text-center">
                                                    Riepilogo globale di {supplies.length} {supplies.length === 1 ? 'fornitura collegata' : 'forniture collegate'}
                                                </p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <p className="text-[14px] font-bold mb-0.5 opacity-70">Fornitura</p>
                                                        <h3 className="text-lg font-bold tracking-tight leading-tight truncate max-w-[240px]">{s.address}</h3>
                                                        {s.city && (
                                                            <p className="text-[13px] font-medium opacity-60 mt-0.5">{s.city}</p>
                                                        )}
                                                        <div className="mt-3 flex flex-col gap-2">
                                                            {(s.codice_cliente || s.client_code) && (
                                                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl w-fit bg-white/20 backdrop-blur-md border border-white/25 shadow-sm">
                                                                    <span className="text-[11px] font-bold uppercase tracking-[0.1em] opacity-60">Codice Cliente</span>
                                                                    <span className="text-[13px] font-mono font-bold tracking-wider uppercase">
                                                                        {s.codice_cliente || s.client_code}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {s.cif && (
                                                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl w-fit bg-white/20 backdrop-blur-md border border-white/25 shadow-sm">
                                                                    <span className="text-[11px] font-bold uppercase tracking-[0.1em] opacity-60">CIF</span>
                                                                    <span className="text-[13px] font-mono font-bold tracking-wider uppercase">
                                                                        {s.cif}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div
                                                        className="w-14 h-14 flex items-center justify-center shrink-0 overflow-hidden"
                                                        style={{
                                                            // Track the swipe continuously instead of a delayed 500ms
                                                            // toggle that only fired after the card snapped.
                                                            transform: `scale(${1 + 0.25 * progress})`,
                                                            filter: `grayscale(${1 - progress})`,
                                                            opacity: 0.4 + 0.6 * progress,
                                                            willChange: 'transform, opacity, filter',
                                                        }}
                                                    >
                                                        <img
                                                            src="/acq_favicon.ico"
                                                            alt="Acquambiente"
                                                            className="w-full h-full object-contain"
                                                            loading="eager"
                                                            // @ts-ignore
                                                            fetchPriority="high"
                                                        />
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[2rem]" style={{ opacity: progress, willChange: 'opacity' }}>
                                            <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-emerald-400/20 blur-3xl animate-wave-pulse" />
                                            <div className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl animate-wave-pulse" style={{ animationDelay: '2.5s' }} />
                                            <div className="absolute bottom-0 left-0 w-full h-24 overflow-hidden">
                                                <div className="absolute bottom-0 left-0 w-[200%] h-full flex animate-wave-slide reverse opacity-15" style={{ animationDuration: '25s' }}>
                                                    <svg className="w-1/2 h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
                                                        <path fill="#ffffff" d="M0,160 C240,160 480,60 720,160 C960,260 1200,160 1440,160 L1440,320 L0,320 Z" />
                                                    </svg>
                                                    <svg className="w-1/2 h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
                                                        <path fill="#ffffff" d="M0,160 C240,160 480,60 720,160 C960,260 1200,160 1440,160 L1440,320 L0,320 Z" />
                                                    </svg>
                                                </div>
                                                <div className="absolute bottom-0 left-0 w-[200%] h-full flex animate-wave-slide opacity-25" style={{ animationDuration: '18s' }}>
                                                    <svg className="w-1/2 h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
                                                        <path fill="#ffffff" d="M0,200 C360,200 480,100 720,200 C960,300 1080,200 1440,200 L1440,320 L0,320 Z" />
                                                    </svg>
                                                    <svg className="w-1/2 h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
                                                        <path fill="#ffffff" d="M0,200 C360,200 480,100 720,200 C960,300 1080,200 1440,200 L1440,320 L0,320 Z" />
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                </div>
                {carouselItems.length > 1 && (
                    <div className="flex flex-col items-center mt-4">
                        <div className="flex justify-center gap-2 items-center">
                            {carouselItems.map((s, i) => {
                                const isVirtualAll = s.isVirtualAll
                                const activeColor = isVirtualAll ? 'bg-slate-700 dark:bg-slate-300' : 'bg-blue-600 dark:bg-blue-400'
                                const inactiveColor = isVirtualAll ? 'bg-slate-400 dark:bg-slate-600' : 'bg-blue-300 dark:bg-blue-800'
                                return (
                                    <div
                                        key={`dot-${i}`}
                                        className={cn(
                                            "h-2 rounded-full transition-all duration-300 shrink-0",
                                            selectedIdx === i 
                                                ? `w-8 ${activeColor}` 
                                                : `w-2 ${inactiveColor}`
                                        )}
                                    />
                                )
                            })}
                        </div>
                        <p className="text-[11px] font-medium text-slate-400 mt-2.5 flex items-center gap-1.5">
                            Scorri per selezionare una fornitura
                        </p>
                    </div>
                )}
            </div>

            <div className="flex items-stretch justify-between gap-1">
                <QuickAction
                    icon={<Files />}
                    label="Bollette"
                    onClick={onGoToBollette}
                    badge={unpaidCount > 0 ? unpaidCount : undefined}
                />
                <QuickAction
                    icon={<BarChart3 />}
                    label="Confronto"
                    onClick={onGoToConfronto}
                    disabled={confrontoDisabled}
                    alertLevel={confrontoAlert}
                />
                <QuickAction icon={<LifeBuoy />} label="Supporto" onClick={onGoToSupporto} />
            </div>

            <div key={`supply-content-${selectedIdx}`} className="space-y-4 animate-content-in">
            <div>
                <div className="bg-white dark:bg-[#1A1D23] rounded-[2rem] overflow-hidden">
                    {sortedBills.slice(0, 3).length === 0 ? (
                        <p className="text-center py-8 text-[14px] text-slate-400 font-medium">Nessuna bolletta</p>
                    ) : (
                        <>
                            {sortedBills.slice(0, 3).map((bill: any, billIdx: number) => (
                                <BillListItem
                                    key={`home-bill-${billIdx}-${bill.id ?? 'x'}`}
                                    bill={bill}
                                    onSelect={onSelectBill}
                                    monthYear={monthYear}
                                    formatEuro={formatEuro}
                                />
                            ))}
                            {sortedBills.length >= 3 && (
                                <button
                                    onClick={onGoToBollette}
                                    className="w-full py-4 text-slate-500 dark:text-slate-400 text-[12px] font-bold uppercase hover:bg-slate-50 dark:hover:bg-white/5 transition-all border-t border-slate-100 dark:border-white/5"
                                >
                                    Vedi tutto
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Combined month-by-month spesa + consumo for the selected supply.
                "all" keeps the prompt to pick a single fornitura. */}
            <div className="bg-white dark:bg-[#1A1D23] rounded-[2rem] p-5">
                {currentSupply?.ulm === 'all' ? (
                    <div>
                        <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mb-0.5">Spesa &amp; consumo</p>
                        <div className="h-40 mt-4 flex items-center justify-center text-center px-6 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                            <p className="text-[13px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                                Seleziona una singola fornitura per visualizzare il grafico.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="h-[20rem]">
                        <YearlyConsumoChart
                            data={yearlyData}
                            years={chartYears}
                            selectedYear={selectedYear ?? new Date().getFullYear()}
                            onSelectYear={setSelectedYear}
                            formatEuro={formatEuro}
                        />
                    </div>
                )}
            </div>
            </div>
            <div className="pb-32" />
        </div>
    )
}

function QuickAction({ icon, label, onClick, badge, disabled, alertLevel }: { icon: React.ReactNode; label: string; onClick?: () => void; badge?: number; disabled?: boolean; alertLevel?: AdviceLevel | null }) {
    return (
        <button
            onClick={disabled ? undefined : onClick}
            disabled={disabled}
            aria-disabled={disabled}
            className={cn(
                "flex-1 min-w-0 flex flex-col items-center justify-center gap-1.5 py-1 px-1 transition-all",
                disabled ? "opacity-40 cursor-not-allowed" : "active:scale-[0.97]"
            )}
        >
            <div className={cn(
                "relative w-16 h-16 rounded-full flex items-center justify-center",
                disabled
                    ? "bg-slate-200 dark:bg-white/5 text-slate-400 dark:text-slate-500"
                    : "bg-slate-100 dark:bg-white/10 text-[#1E5BFF] dark:text-[#93C5FD]"
            )}>
                {React.cloneElement(icon as React.ReactElement<{ size?: number; strokeWidth?: number }>, { size: 28, strokeWidth: 1.6 })}
                {badge !== undefined && (
                    <span
                        className="absolute aspect-square w-6 min-w-[24px] rounded-full bg-[#1E5BFF] text-white text-[12px] font-black flex items-center justify-center shadow-sm"
                        style={{ top: '7px', right: '7px', transform: 'translate(50%, -50%)', padding: badge >= 10 ? '0 5px' : 0 }}
                    >
                        {badge}
                    </span>
                )}
                {alertLevel && (
                    <span
                        className={cn(
                            "absolute w-6 h-6 rounded-full text-white text-[14px] font-black flex items-center justify-center shadow-sm ring-2 ring-white dark:ring-[#0F1115]",
                            alertLevel === 'alert' ? "bg-red-500" : "bg-orange-500"
                        )}
                        style={{ top: '7px', right: '7px', transform: 'translate(50%, -50%)' }}
                        title={alertLevel === 'alert' ? 'Consumi in forte aumento' : 'Consumi in aumento'}
                    >
                        !
                    </span>
                )}
            </div>
            <span className="text-[14px] font-semibold text-slate-400 dark:text-slate-400 leading-tight text-center">{label}</span>
        </button>
    )
}
