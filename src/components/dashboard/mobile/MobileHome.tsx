'use client'

import { useMemo, useState, useEffect, useLayoutEffect, useRef } from 'react'
import React from 'react'
import { BarChart3, LifeBuoy, CheckCircle2, Files, FileText, LogOut } from 'lucide-react'
import { BillListItem } from './BillListItem'
import { cn } from '@/lib/utils'
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

    // Initialize with correct index from context to prevent flickering
    const [selectedIdx, setSelectedIdx] = useState(() => {
        const items = supplies || []
        if (selectedSupplyId && items.length > 0) {
            const idx = items.findIndex(s => getSupplyId(s) === selectedSupplyId)
            return idx !== -1 ? idx : 0
        }
        return 0
    })

    const scrollRef = useRef<HTMLDivElement>(null)
    const chartRef = useRef<HTMLDivElement>(null)
    const [chartSize, setChartSize] = useState({ width: 0, height: 0 })
    const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null)
    const [selectedExpenseIndex, setSelectedExpenseIndex] = useState<number | null>(null)

    useLayoutEffect(() => {
        const el = chartRef.current
        if (!el) return
        const update = () => setChartSize({ width: el.clientWidth, height: el.clientHeight })
        update()
        const ro = new ResizeObserver(update)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    // Sync scroll position on mount or when selectedSupplyId changes
    useEffect(() => {
        const items = supplies || []
        if (selectedSupplyId && items.length > 0 && scrollRef.current) {
            const idx = items.findIndex(s => getSupplyId(s) === selectedSupplyId)
            if (idx !== -1) {
                const cardWidth = scrollRef.current.clientWidth
                scrollRef.current.scrollLeft = idx * (cardWidth + 12)
                setSelectedIdx(idx)
            }
        }
    }, [selectedSupplyId, supplies])

    const handleScroll = () => {
        if (!scrollRef.current) return
        const scrollLeft = scrollRef.current.scrollLeft
        const cardWidth = scrollRef.current.clientWidth
        const newIdx = Math.round(scrollLeft / (cardWidth + 12))
        if (newIdx !== selectedIdx && newIdx >= 0 && newIdx < supplies.length) {
            setSelectedIdx(newIdx)
            if (supplies[newIdx]) {
                onSelectSupply?.(getSupplyId(supplies[newIdx]))
            }
        }
    }

    const currentSupply = supplies[selectedIdx] || supplies[0]
    const initials = useMemo(() => {
        const name = stats.fullName || stats.firstName || 'U'
        const parts = name.trim().split(/\s+/)
        return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'U'
    }, [stats.fullName, stats.firstName])

    const monthYear = (date: string) => {
        const d = new Date(date)
        return d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
    }

    const formatEuro = (n: number) => `${n.toFixed(2).replace('.', ',')} €`

    const sortedBills = useMemo(() => {
        const supplyUlm = currentSupply?.ulm
        // Only show bills that actually belong to the currently-viewed supply.
        // If the supply has no ulm (registered supply not linked to any bill),
        // show nothing — never leak bills from other (e.g. unregistered) ULMs.
        if (!supplyUlm) return []
        return bills
            .filter((b: any) => b.ulm === supplyUlm)
            .sort((a, b) => new Date(b.data_emissione).getTime() - new Date(a.data_emissione).getTime())
    }, [bills, currentSupply])

    const chartData = useMemo(() => {
        const SLOT_COUNT = 6
        const MIN_PLACEHOLDERS = 2
        const MAX_REAL = SLOT_COUNT - MIN_PLACEHOLDERS
        const placeholderHeights = [55, 72, 48, 65, 58, 70]
        const monthLabel = (d: Date) =>
            d.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '')

        const supplyUlm = currentSupply?.ulm
        const supplyBills = supplyUlm
            ? bills.filter((b: any) => b.ulm === supplyUlm)
            : []

        const recent = [...supplyBills]
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
        // Index of the last slot that actually has a bill (-1 if none)
        const lastRealIndex = slots.reduce((acc, s, i) => (s as any).bill ? i : acc, -1)
        const lastBill = recent.length > 0 ? recent[recent.length - 1] : null

        return { slots, max, lastRealIndex, placeholderHeights, lastBill }
    }, [bills, currentSupply])

    useEffect(() => {
        if (chartData.lastRealIndex !== -1) {
            setSelectedBarIndex(chartData.lastRealIndex)
            setSelectedExpenseIndex(chartData.lastRealIndex)
        } else {
            // Empty supply — clear stale selection from the previous one
            setSelectedBarIndex(null)
            setSelectedExpenseIndex(null)
        }
    }, [chartData.lastRealIndex])

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
                        supplies.length === 1 && "justify-center overflow-x-hidden snap-none"
                    )}
                >
                    {supplies.map((s, idx) => {
                        const isActive = idx === selectedIdx
                        const supplyId = getSupplyId(s)
                        const supplyBills = bills.filter((b: any) => (b.ulm === supplyId))
                        const latestBill = supplyBills.sort((a, b) => new Date(b.data_emissione).getTime() - new Date(a.data_emissione).getTime())[0]

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
                                    className={cn(
                                        "relative overflow-hidden rounded-[2rem] p-5 transition-all duration-500 flex flex-col justify-between h-48 animate-gradient-shift",
                                        isActive ? "text-white scale-100" : "bg-white/50 dark:bg-emerald-950/20 text-slate-400 scale-[0.95] opacity-50"
                                    )}
                                    style={isActive ? { background: 'linear-gradient(135deg, #064E3B 0%, #065F46 50%, #1E5BFF 100%)' } : {}}
                                >
                                    <div className="relative z-10 flex flex-col h-full justify-between">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className={cn(
                                                    "text-[13px] font-bold mb-0.5",
                                                    isActive ? "text-emerald-200/60" : "text-slate-400"
                                                )}>Fornitura</p>
                                                <h3 className={cn(
                                                    "text-lg font-bold tracking-tight leading-tight truncate max-w-[240px]",
                                                    isActive ? "text-white" : "text-[#0A2540] dark:text-white"
                                                )}>{s.address}</h3>
                                                {s.city && (
                                                    <p className={cn(
                                                        "text-[11px] font-medium opacity-60 mt-0.5",
                                                        isActive ? "text-emerald-100" : "text-slate-500"
                                                    )}>{s.city}</p>
                                                )}
                                                <div className="mt-3 flex flex-col gap-2">
                                                    {(s.codice_cliente || s.client_code) && (
                                                        <div className={cn(
                                                            "flex items-center gap-2 px-3 py-1.5 rounded-xl w-fit transition-all duration-300",
                                                            isActive ? "bg-white/20 backdrop-blur-md border border-white/20 text-white shadow-sm" : "bg-slate-50 dark:bg-white/5 text-slate-500"
                                                        )}>
                                                            <span className="text-[9px] font-bold uppercase tracking-[0.1em] opacity-60">Codice Cliente</span>
                                                            <span className="text-[12px] font-mono font-bold tracking-wider uppercase">
                                                                {s.codice_cliente || s.client_code}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {s.cif && (
                                                        <div className={cn(
                                                            "flex items-center gap-2 px-3 py-1.5 rounded-xl w-fit transition-all duration-300",
                                                            isActive ? "bg-white/20 backdrop-blur-md border border-white/20 text-white shadow-sm" : "bg-slate-100 dark:bg-white/5 text-slate-500"
                                                        )}>
                                                            <span className="text-[9px] font-bold uppercase tracking-[0.1em] opacity-60">CIF</span>
                                                            <span className="text-[12px] font-mono font-bold tracking-wider uppercase">
                                                                {s.cif}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className={cn(
                                                "w-14 h-14 flex items-center justify-center shrink-0 overflow-hidden transition-all duration-500",
                                                isActive ? "scale-125 grayscale-0" : "scale-100 grayscale opacity-40"
                                            )}>
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

                                        <div className="flex items-end justify-between">
                                            {latestBill && (
                                                <div>
                                                    <p className={cn(
                                                        "text-[9px] font-bold tracking-[0.2em] uppercase mb-1",
                                                        isActive ? "text-emerald-200/60" : "text-slate-400"
                                                    )}>Ultima bolletta</p>
                                                    <div className="flex items-baseline gap-2">
                                                        <span className={cn(
                                                            "text-2xl font-bold tracking-tight",
                                                            isActive ? "text-white" : "text-[#0A2540] dark:text-white"
                                                        )}>€{Number(latestBill.importo || 0).toFixed(2).replace('.', ',')}</span>
                                                        {isActive && (latestBill as any).status === 'unpaid' && (
                                                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#1E5BFF] text-white uppercase tracking-wider">In attesa</span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {isActive && (
                                        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[2rem]">
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
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
                {supplies.length > 1 && (
                    <div className="flex justify-center gap-1.5 mt-4">
                        {supplies.map((_, i) => (
                            <div
                                key={`dot-${i}`}
                                className={cn(
                                    "h-1.5 rounded-full transition-all duration-300",
                                    selectedIdx === i ? "w-6 bg-[#0A2540] dark:bg-[#1E5BFF]" : "w-1.5 bg-slate-200 dark:bg-white/10"
                                )}
                            />
                        ))}
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
                <QuickAction icon={<BarChart3 />} label="Confronto" onClick={onGoToConfronto} />
                <QuickAction icon={<LifeBuoy />} label="Supporto" onClick={onGoToSupporto} />
            </div>

            <div key={`supply-content-${selectedIdx}`} className="space-y-4 animate-content-in">
            <div>
                <div className="bg-white dark:bg-[#1A1D23] rounded-[2rem] overflow-hidden">
                    {sortedBills.slice(0, 3).length === 0 ? (
                        <p className="text-center py-8 text-xs text-slate-400 font-medium">Nessuna bolletta</p>
                    ) : (
                        <>
                            {sortedBills.slice(0, 3).map((bill: any) => (
                                <BillListItem 
                                    key={bill.id}
                                    bill={bill}
                                    onSelect={onSelectBill}
                                    monthYear={monthYear}
                                    formatEuro={formatEuro}
                                />
                            ))}
                            {sortedBills.length > 0 && (
                                <button
                                    onClick={onGoToBollette}
                                    className="w-full py-4 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase hover:bg-slate-50 dark:hover:bg-white/5 transition-all border-t border-slate-100 dark:border-white/5"
                                >
                                    Vedi tutto
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-[#1A1D23] rounded-[2rem] p-5">
                <div className="flex items-start justify-between mb-4">
                    {(() => {
                        const selectedSlot = selectedExpenseIndex !== null ? chartData.slots[selectedExpenseIndex] : null
                        const selectedBill = (selectedSlot as any)?.bill
                        const displayPrice = selectedBill ? Number(selectedBill.importo || 0) : Number(chartData.lastBill?.importo || 0)
                        const displayDate = selectedBill ? monthYear(selectedBill.data_emissione) : (chartData.lastBill ? monthYear(chartData.lastBill.data_emissione) : '')

                        return (
                            <div>
                                <p className="text-[9px] font-bold tracking-widest text-slate-400 uppercase mb-0.5">Andamento Spesa</p>
                                <h3 className="text-2xl font-bold text-[#0A2540] dark:text-white tracking-tight">
                                    € {displayPrice.toFixed(2).replace('.', ',')}
                                </h3>
                                {displayDate && (
                                    <p className="text-[10px] text-[#1E5BFF] dark:text-[#93C5FD] font-bold uppercase tracking-wider mt-0.5">
                                        {displayDate}
                                    </p>
                                )}
                            </div>
                        )
                    })()}
                </div>

                <div ref={chartRef} className="h-32 mt-4 mb-8 relative touch-none select-none">
                    {(() => {
                        const supplyUlm = currentSupply?.ulm
                        const supplyBills = supplyUlm
                            ? bills.filter((b: any) => b.ulm === supplyUlm)
                            : []
                        const maxCost = Math.max(...supplyBills.map(b => Number(b.importo || 0)), 1)

                        const margin = 15
                        const width = 300 - (margin * 2)

                        // Hide placeholder months — span real bills across the full width
                        const realSlots = chartData.slots
                            .map((slot, slotIdx) => ({ slot, slotIdx }))
                            .filter(({ slot }) => !!(slot as any).bill)

                        const realCount = realSlots.length
                        const realStep = realCount > 1 ? width / (realCount - 1) : 0

                        const realPoints = realSlots.map(({ slot, slotIdx }, i) => {
                            const bill = (slot as any).bill
                            const val = Number(bill.importo || 0)
                            const y = val > 0 ? 100 - ((val / maxCost) * 70 + 15) : 85
                            const x = realCount > 1 ? margin + i * realStep : margin + width / 2
                            return { x, y, cost: val, slotIdx, label: (slot as any).label, key: (slot as any).key }
                        })

                        const linePath = realPoints.length >= 2
                            ? realPoints.reduce((acc, p, i, arr) => {
                                if (i === 0) return `M ${p.x},${p.y}`
                                const prev = arr[i - 1]
                                const dx = p.x - prev.x
                                return `${acc} C ${prev.x + dx / 2},${prev.y} ${p.x - dx / 2},${p.y} ${p.x},${p.y}`
                            }, '')
                            : ''

                        const areaPath = realPoints.length >= 2
                            ? `${linePath} L ${realPoints[realPoints.length - 1].x},100 L ${realPoints[0].x},100 Z`
                            : ''

                        const activePoint = realPoints.find(p => p.slotIdx === selectedExpenseIndex) ?? null

                        const handleScrub = (clientX: number, rect: DOMRect) => {
                            if (realPoints.length === 0) return
                            const x = Math.max(0, Math.min(rect.width, clientX - rect.left))
                            let closest = realPoints[0]
                            let closestDist = Infinity
                            for (const p of realPoints) {
                                const px = (p.x / 300) * rect.width
                                const dist = Math.abs(px - x)
                                if (dist < closestDist) {
                                    closestDist = dist
                                    closest = p
                                }
                            }
                            if (closest.slotIdx !== selectedExpenseIndex) {
                                setSelectedExpenseIndex(closest.slotIdx)
                            }
                        }

                        // Placeholder curve when there's no data — purely cosmetic
                        const placeholderLine = 'M 15,70 C 60,55 100,80 150,40 S 240,75 285,50'
                        const placeholderArea = `${placeholderLine} L 285,100 L 15,100 Z`
                        const isEmpty = realPoints.length === 0

                        return (
                            <>
                                <svg viewBox="0 0 300 100" className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" preserveAspectRatio="none">
                                    <defs>
                                        <linearGradient id="spendingGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                            <stop offset="0%" stopColor="#84cc16" stopOpacity="0.32" />
                                            <stop offset="100%" stopColor="#84cc16" stopOpacity="0" />
                                        </linearGradient>
                                        <pattern id="placeholderStripes" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                                            <rect width="6" height="6" fill="transparent" />
                                            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(100,116,139,0.35)" strokeWidth="1" />
                                        </pattern>
                                    </defs>
                                    {isEmpty ? (
                                        <>
                                            <path d={placeholderArea} fill="url(#placeholderStripes)" opacity="0.5" />
                                            <path
                                                d={placeholderLine}
                                                fill="none"
                                                stroke="rgba(100,116,139,0.5)"
                                                strokeWidth="1.5"
                                                strokeDasharray="4 3"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                vectorEffect="non-scaling-stroke"
                                            />
                                        </>
                                    ) : (
                                        <>
                                            {areaPath && <path d={areaPath} fill="url(#spendingGradient)" />}
                                            {linePath && (
                                                <path
                                                    d={linePath}
                                                    fill="none"
                                                    stroke="#84cc16"
                                                    strokeWidth="2.5"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    vectorEffect="non-scaling-stroke"
                                                    className="drop-shadow-[0_2px_4px_rgba(132,204,22,0.4)]"
                                                />
                                            )}
                                        </>
                                    )}
                                </svg>

                                {/* Touch / mouse scrub overlay */}
                                <div
                                    className="absolute inset-0 z-40 cursor-crosshair"
                                    onPointerDown={(e) => {
                                        e.currentTarget.setPointerCapture(e.pointerId)
                                        handleScrub(e.clientX, e.currentTarget.getBoundingClientRect())
                                    }}
                                    onPointerMove={(e) => {
                                        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                                            handleScrub(e.clientX, e.currentTarget.getBoundingClientRect())
                                        }
                                    }}
                                />

                                {/* Vertical crosshair */}
                                {activePoint && chartSize.width > 0 && (
                                    <div
                                        className="absolute top-0 bottom-0 w-px pointer-events-none z-10 transition-transform duration-300 ease-out will-change-transform"
                                        style={{
                                            transform: `translateX(${(activePoint.x / 300) * chartSize.width}px)`,
                                            backgroundImage: 'repeating-linear-gradient(to bottom, rgba(132,204,22,0.4) 0 4px, transparent 4px 8px)',
                                        }}
                                    />
                                )}

                                {/* Active dot — solid, no ripple */}
                                {activePoint && chartSize.width > 0 && (
                                    <div
                                        className="absolute top-0 left-0 pointer-events-none z-20 transition-transform duration-300 ease-out will-change-transform"
                                        style={{
                                            transform: `translate3d(${(activePoint.x / 300) * chartSize.width}px, ${(activePoint.y / 100) * chartSize.height}px, 0)`,
                                        }}
                                    >
                                        <div className="absolute -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-[2.5px] border-[#84cc16] shadow-[0_2px_8px_rgba(132,204,22,0.55)]" />
                                    </div>
                                )}

                                {/* Floating tooltip — green badge */}
                                {activePoint && chartSize.width > 0 && (
                                    <div
                                        className="absolute top-0 left-0 bg-[#C6F36B] text-[#0A2540] px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-lg pointer-events-none z-30 whitespace-nowrap transition-transform duration-300 ease-out will-change-transform"
                                        style={{
                                            transform: `translate3d(${(activePoint.x / 300) * chartSize.width}px, ${(activePoint.y / 100) * chartSize.height - 16}px, 0) translate(-50%, -100%)`,
                                        }}
                                    >
                                        €{activePoint.cost.toFixed(2).replace('.', ',')}
                                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#C6F36B] rotate-45" />
                                    </div>
                                )}

                                {/* Month labels — only real-data months */}
                                <div className="absolute -bottom-6 left-0 right-0 h-4">
                                    {realPoints.map((p) => (
                                        <span
                                            key={p.key}
                                            className={cn(
                                                "absolute text-[8px] font-bold uppercase tracking-tighter w-12 text-center transition-colors duration-200",
                                                selectedExpenseIndex === p.slotIdx ? "text-[#84cc16]" : "text-slate-400"
                                            )}
                                            style={{
                                                left: `${(p.x / 300) * 100}%`,
                                                transform: 'translateX(-50%)'
                                            }}
                                        >
                                            {p.label}
                                        </span>
                                    ))}
                                </div>
                            </>
                        )
                    })()}
                </div>
            </div>

            <div className="bg-white dark:bg-[#1A1D23] rounded-[2rem] p-5">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <p className="text-[9px] font-bold tracking-widest text-slate-400 uppercase mb-0.5">Consumo mensile</p>
                        <h3 className="text-2xl font-bold text-[#0A2540] dark:text-white tracking-tight">
                            {chartData.lastBill?.consumo || '0'} <span className="text-xs font-medium text-slate-400">mc</span>
                        </h3>
                        <p className="text-[10px] text-slate-400 font-medium mt-1">Ultimi 6 mesi</p>
                    </div>
                    {chartData.lastBill && stats.percentageBadge}
                </div>

                <div className="flex items-end justify-between gap-2.5 h-40 mb-3 pt-4">
                    {chartData.slots.map((slot, i) => {
                        const isSelected = selectedBarIndex === i
                        const hasData = slot.value !== null
                        const heightPct = hasData ? ((slot.value as number) / chartData.max) * 100 : chartData.placeholderHeights[i % chartData.placeholderHeights.length]
                        return (
                            <div key={slot.key} className="flex-1 flex flex-col items-center justify-end h-full relative cursor-pointer" onClick={() => hasData && setSelectedBarIndex(i)}>
                                {isSelected && hasData && (
                                    <span className="absolute px-2 py-0.5 rounded-md bg-[#C6F36B] text-[#0A2540] text-[10px] font-bold whitespace-nowrap z-10 shadow-sm animate-in fade-in zoom-in duration-200" style={{ bottom: `calc(${Math.max(heightPct, 20)}% + 14px)` }}>
                                        {slot.value} mc
                                    </span>
                                )}
                                <div
                                    className="w-full rounded-xl relative overflow-hidden transition-[height] duration-300"
                                    style={{ height: `${Math.max(heightPct, hasData ? 20 : 12)}%` }}
                                >
                                    {hasData ? (
                                        <>
                                            <div className="absolute inset-0 bg-blue-200 dark:bg-blue-900/30" />
                                            <div className={cn(
                                                "absolute inset-0 bg-gradient-to-t from-[#1E5BFF] to-[#60A5FA] transition-opacity duration-300",
                                                isSelected ? "opacity-100" : "opacity-0"
                                            )} />
                                        </>
                                    ) : (
                                        <div
                                            className="absolute inset-0 bg-slate-50 dark:bg-white/5"
                                            style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent 0, transparent 5px, rgba(100, 116, 139, 0.4) 5px, rgba(100, 116, 139, 0.4) 7px)' }}
                                        />
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
                <div className="flex justify-between gap-2 mt-2">
                    {chartData.slots.map((slot, i) => (
                        <span
                            key={slot.key}
                            className={cn(
                                "flex-1 text-center text-[8px] font-bold uppercase tracking-tighter transition-colors duration-200",
                                selectedBarIndex === i ? "text-[#1E5BFF]" : "text-slate-400"
                            )}
                        >
                            {slot.label}
                        </span>
                    ))}
                </div>
            </div>
            </div>
            <div className="pb-32" />
        </div>
    )
}

function QuickAction({ icon, label, onClick, badge }: { icon: React.ReactNode; label: string; onClick?: () => void; badge?: number }) {
    return (
        <button
            onClick={onClick}
            className="flex-1 min-w-0 flex flex-col items-center justify-center gap-1.5 py-1 px-1 active:scale-[0.97] transition-all"
        >
            <div className="relative w-16 h-16 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-[#1E5BFF] dark:text-[#93C5FD]">
                {React.cloneElement(icon as React.ReactElement<{ size?: number; strokeWidth?: number }>, { size: 28, strokeWidth: 1.6 })}
                {badge !== undefined && (
                    <span
                        className="absolute aspect-square w-6 min-w-[24px] rounded-full bg-[#1E5BFF] text-white text-[12px] font-black flex items-center justify-center shadow-sm"
                        style={{ top: '7px', right: '7px', transform: 'translate(50%, -50%)', padding: badge >= 10 ? '0 5px' : 0 }}
                    >
                        {badge}
                    </span>
                )}
            </div>
            <span className="text-[13px] font-semibold text-slate-400 dark:text-slate-400 leading-tight text-center">{label}</span>
        </button>
    )
}
