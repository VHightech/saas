'use client'

import { useRef, useState, useLayoutEffect } from 'react'
import { cn } from '@/lib/utils'
import type { Bill } from '@/types/dashboard'

// ====== Mobile-style charts (mirrored from MobileHome) ======

interface SpesaLineChartProps {
    chartData: any
    bills: Bill[]
    monthYear: (d: string) => string
    isAll?: boolean
}

export function SpesaLineChart({ chartData, bills, monthYear, isAll }: SpesaLineChartProps) {
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

interface ConsumoBarChartProps {
    chartData: any
    isAll?: boolean
}

export function ConsumoBarChart({ chartData, isAll }: ConsumoBarChartProps) {
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
