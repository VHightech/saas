'use client'

import React, { useMemo, useState, useRef, useLayoutEffect } from 'react'
import { cn } from '@/lib/utils'
import { useDashboard } from '@/components/dashboard/dashboard-context'
import type { Bill } from '@/types/dashboard'

interface DesktopSidePanelProps {
    allBills: Bill[]
}

export function DesktopSidePanel({ allBills }: DesktopSidePanelProps) {
    const { supplies, selectedSupply, setSelectedSupply } = useDashboard()

    const chartRef = useRef<HTMLDivElement>(null)
    const [chartSize, setChartSize] = useState({ width: 0, height: 0 })
    const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null)
    const [selectedExpenseIndex, setSelectedExpenseIndex] = useState<number | null>(null)

    // Filter bills by selected supply
    const bills = useMemo(() => {
        if (selectedSupply === 'all') return allBills
        return allBills.filter(b => b.ulm === selectedSupply)
    }, [allBills, selectedSupply])

    useLayoutEffect(() => {
        const el = chartRef.current
        if (!el) return
        const update = () => setChartSize({ width: el.clientWidth, height: el.clientHeight })
        update()
        const ro = new ResizeObserver(update)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    const monthYear = (date: string) => {
        const d = new Date(date)
        return d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
    }

    const monthLabel = (d: Date) =>
        d.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '')

    const chartData = useMemo(() => {
        const SLOT_COUNT = 6
        const MIN_PLACEHOLDERS = 2
        const MAX_REAL = SLOT_COUNT - MIN_PLACEHOLDERS
        const placeholderHeights = [55, 72, 48, 65, 58, 70]

        const recent = [...bills]
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
    }, [bills])

    React.useEffect(() => {
        if (chartData.lastRealIndex !== -1) {
            setSelectedBarIndex(chartData.lastRealIndex)
            setSelectedExpenseIndex(chartData.lastRealIndex)
        } else {
            setSelectedBarIndex(null)
            setSelectedExpenseIndex(null)
        }
    }, [chartData.lastRealIndex])

    const trendData = useMemo(() => {
        const maxCost = Math.max(...bills.map(b => Number(b.importo || 0)), 1)
        const margin = 15
        const width = 300 - (margin * 2)

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

        const placeholderLine = 'M 15,70 C 60,55 100,80 150,40 S 240,75 285,50'
        const placeholderArea = `${placeholderLine} L 285,100 L 15,100 Z`
        const isEmpty = realPoints.length === 0

        return { realPoints, linePath, areaPath, placeholderLine, placeholderArea, isEmpty }
    }, [bills, chartData.slots])

    const activePoint = trendData.realPoints.find(p => p.slotIdx === selectedExpenseIndex) ?? null

    const handleScrub = (clientX: number, rect: DOMRect) => {
        if (trendData.realPoints.length === 0) return
        const x = Math.max(0, Math.min(rect.width, clientX - rect.left))
        let closest = trendData.realPoints[0]
        let closestDist = Infinity
        for (const p of trendData.realPoints) {
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

    const selectedSlot = selectedExpenseIndex !== null ? chartData.slots[selectedExpenseIndex] : null
    const selectedBill = (selectedSlot as any)?.bill
    const displayPrice = selectedBill ? Number(selectedBill.importo || 0) : Number(chartData.lastBill?.importo || 0)
    const displayDate = selectedBill ? monthYear(selectedBill.data_emissione) : (chartData.lastBill ? monthYear(chartData.lastBill.data_emissione) : '')

    const totalBills = bills.length
    const totalAmount = bills.reduce((sum, b) => sum + (Number(b.importo) || 0), 0)
    const totalConsumption = bills.reduce((sum, b) => sum + (Number(b.consumo) || 0), 0)

    // Truncate long ULM codes for pill display
    const truncateUlm = (ulm: string) => ulm.length > 10 ? `…${ulm.slice(-8)}` : ulm

    return (
        <div className="flex flex-col gap-4">

            {/* Supply Switcher — horizontal scrollable pills */}
            {supplies.length > 0 && (
                <div className="bg-white dark:bg-[#1A1D23] rounded-[2rem] p-4">
                    <p className="text-[9px] font-bold tracking-widest text-slate-400 uppercase mb-3">Fornitura</p>
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                        <button
                            onClick={() => setSelectedSupply('all')}
                            className={cn(
                                "shrink-0 px-4 py-2 rounded-xl text-[11px] font-bold tracking-tight transition-all duration-200",
                                selectedSupply === 'all'
                                    ? "bg-[#0A2540] dark:bg-white text-white dark:text-[#0A2540]"
                                    : "bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10"
                            )}
                        >
                            Tutte
                        </button>
                        {supplies.map((ulm) => (
                            <button
                                key={ulm}
                                onClick={() => setSelectedSupply(ulm)}
                                className={cn(
                                    "shrink-0 px-4 py-2 rounded-xl text-[11px] font-bold font-mono tracking-tight transition-all duration-200",
                                    selectedSupply === ulm
                                        ? "bg-[#1E5BFF] text-white"
                                        : "bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10"
                                )}
                                title={ulm}
                            >
                                {truncateUlm(ulm)}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Riepilogo Contabile */}
            <div className="bg-white dark:bg-[#1A1D23] rounded-[2rem] p-6">
                <p className="text-[9px] font-bold tracking-widest text-slate-400 uppercase mb-4">Riepilogo Contabile</p>
                <div className="grid grid-cols-2 gap-4 mb-5">
                    <div>
                        <p className="text-3xl font-black text-[#0A2540] dark:text-white tracking-tight">{totalBills}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#1E5BFF] dark:text-[#93C5FD] mt-0.5">Bollette</p>
                    </div>
                    <div>
                        <p className="text-3xl font-black text-[#0A2540] dark:text-white tracking-tight">{totalConsumption.toLocaleString('it-IT')}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#1E5BFF] dark:text-[#93C5FD] mt-0.5">Consumo (MC)</p>
                    </div>
                </div>
                <div className="pt-4 border-t border-slate-100 dark:border-white/5">
                    <p className="text-[9px] font-bold tracking-widest text-slate-400 uppercase mb-1">Importo Totale</p>
                    <p className="text-3xl font-black text-[#0A2540] dark:text-white tracking-tight">
                        {totalAmount.toFixed(2).replace('.', ',')} <span className="text-lg font-bold text-slate-400">€</span>
                    </p>
                </div>
            </div>

            {/* Andamento Spesa — SVG line chart */}
            <div className="bg-white dark:bg-[#1A1D23] rounded-[2rem] p-6">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <p className="text-[9px] font-bold tracking-widest text-slate-400 uppercase mb-0.5">Andamento Spesa</p>
                        <h3 className="text-2xl font-black text-[#0A2540] dark:text-white tracking-tight">
                            € {displayPrice.toFixed(2).replace('.', ',')}
                        </h3>
                        {displayDate && (
                            <p className="text-[10px] text-[#1E5BFF] dark:text-[#93C5FD] font-bold uppercase tracking-wider mt-0.5">
                                {displayDate}
                            </p>
                        )}
                    </div>
                </div>

                <div ref={chartRef} className="h-32 mt-4 mb-8 relative select-none">
                    <svg viewBox="0 0 300 100" className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" preserveAspectRatio="none">
                        <defs>
                            <linearGradient id="deskSpendGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#84cc16" stopOpacity="0.32" />
                                <stop offset="100%" stopColor="#84cc16" stopOpacity="0" />
                            </linearGradient>
                            <pattern id="deskPlaceholderStripes" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                                <rect width="6" height="6" fill="transparent" />
                                <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(100,116,139,0.35)" strokeWidth="1" />
                            </pattern>
                        </defs>
                        {trendData.isEmpty ? (
                            <>
                                <path d={trendData.placeholderArea} fill="url(#deskPlaceholderStripes)" opacity="0.5" />
                                <path d={trendData.placeholderLine} fill="none" stroke="rgba(100,116,139,0.5)" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                            </>
                        ) : (
                            <>
                                {trendData.areaPath && <path d={trendData.areaPath} fill="url(#deskSpendGrad)" />}
                                {trendData.linePath && (
                                    <path d={trendData.linePath} fill="none" stroke="#84cc16" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="drop-shadow-[0_2px_4px_rgba(132,204,22,0.4)]" />
                                )}
                            </>
                        )}
                    </svg>

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

                    {activePoint && chartSize.width > 0 && (
                        <div
                            className="absolute top-0 bottom-0 w-px pointer-events-none z-10 transition-transform duration-300 ease-out will-change-transform"
                            style={{
                                transform: `translateX(${(activePoint.x / 300) * chartSize.width}px)`,
                                backgroundImage: 'repeating-linear-gradient(to bottom, rgba(132,204,22,0.4) 0 4px, transparent 4px 8px)',
                            }}
                        />
                    )}

                    {activePoint && chartSize.width > 0 && (
                        <div
                            className="absolute top-0 left-0 pointer-events-none z-20 transition-transform duration-300 ease-out will-change-transform"
                            style={{ transform: `translate3d(${(activePoint.x / 300) * chartSize.width}px, ${(activePoint.y / 100) * chartSize.height}px, 0)` }}
                        >
                            <div className="absolute -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-[2.5px] border-[#84cc16] shadow-[0_2px_8px_rgba(132,204,22,0.55)]" />
                        </div>
                    )}

                    {activePoint && chartSize.width > 0 && (
                        <div
                            className="absolute top-0 left-0 bg-[#C6F36B] text-[#0A2540] px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-lg pointer-events-none z-30 whitespace-nowrap transition-transform duration-300 ease-out will-change-transform"
                            style={{ transform: `translate3d(${(activePoint.x / 300) * chartSize.width}px, ${(activePoint.y / 100) * chartSize.height - 16}px, 0) translate(-50%, -100%)` }}
                        >
                            €{activePoint.cost.toFixed(2).replace('.', ',')}
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#C6F36B] rotate-45" />
                        </div>
                    )}

                    <div className="absolute -bottom-6 left-0 right-0 h-4">
                        {trendData.realPoints.map((p) => (
                            <span
                                key={p.key}
                                className={cn(
                                    "absolute text-[8px] font-bold uppercase tracking-tighter w-12 text-center transition-colors duration-200",
                                    selectedExpenseIndex === p.slotIdx ? "text-[#84cc16]" : "text-slate-400"
                                )}
                                style={{ left: `${(p.x / 300) * 100}%`, transform: 'translateX(-50%)' }}
                            >
                                {p.label}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Consumo mensile — bar chart */}
            <div className="bg-white dark:bg-[#1A1D23] rounded-[2rem] p-6">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <p className="text-[9px] font-bold tracking-widest text-slate-400 uppercase mb-0.5">Consumo mensile</p>
                        <h3 className="text-2xl font-black text-[#0A2540] dark:text-white tracking-tight">
                            {chartData.lastBill?.consumo || '0'} <span className="text-xs font-medium text-slate-400">mc</span>
                        </h3>
                        <p className="text-[10px] text-slate-400 font-medium mt-1">Ultimi 6 mesi</p>
                    </div>
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
                                <div className="w-full rounded-xl relative overflow-hidden transition-[height] duration-300" style={{ height: `${Math.max(heightPct, hasData ? 20 : 12)}%` }}>
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
                <div className="flex justify-between gap-2 mt-2">
                    {chartData.slots.map((slot, i) => (
                        <span key={slot.key} className={cn("flex-1 text-center text-[8px] font-bold uppercase tracking-tighter transition-colors duration-200", selectedBarIndex === i ? "text-[#1E5BFF]" : "text-slate-400")}>
                            {slot.label}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    )
}
