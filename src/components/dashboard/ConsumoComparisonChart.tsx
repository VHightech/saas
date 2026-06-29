'use client'

import { useRef, useState, useLayoutEffect } from 'react'
import { cn } from '@/lib/utils'
import { smoothPath } from '@/lib/chart-path'
import { robustScale, niceCeil } from '@/lib/bill-chart'

const MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

const fmtAxis = (n: number) =>
    n >= 10000
        ? `${(n / 1000).toLocaleString('it-IT', { maximumFractionDigits: 0 })}k`
        : Math.round(n).toLocaleString('it-IT')

interface ConsumoComparisonChartProps {
    /** Current-year monthly consumo (12 values) → bars. */
    curByMonth: number[]
    /** Previous-year monthly consumo (12 values) → dashed line. */
    prevByMonth: number[]
    currentYear: number
    prevYear: number
    hasCompare: boolean
    selected: number | null
    onSelect: (i: number) => void
    /** Tailwind height for the plot area (e.g. 'h-44' mobile, 'h-64' desktop). */
    heightClass?: string
}

/**
 * Year-over-year consumo chart shared by mobile + desktop Confronto. Mirrors
 * YearlyConsumoChart's quality: a left mc axis with reference ticks, gridlines,
 * an outlier-resistant scale with headroom, and a smooth dashed comparison line.
 */
export function ConsumoComparisonChart({
    curByMonth,
    prevByMonth,
    currentYear,
    prevYear,
    hasCompare,
    selected,
    onSelect,
    heightClass = 'h-44',
}: ConsumoComparisonChartProps) {
    const scale = niceCeil(robustScale([...curByMonth, ...prevByMonth]))
    const yOf = (v: number) => 100 - (Math.min(v, scale) / scale) * 100

    const prevPts = prevByMonth
        .map((v, i) => ({ x: (i + 0.5) * (100 / 12), y: yOf(v), v, i }))
        .filter(p => p.v > 0)
    const prevPath = smoothPath(prevPts)

    const plotRef = useRef<HTMLDivElement>(null)
    const [size, setSize] = useState({ width: 0, height: 0 })
    useLayoutEffect(() => {
        const el = plotRef.current
        if (!el) return
        const update = () => setSize({ width: el.clientWidth, height: el.clientHeight })
        update()
        const ro = new ResizeObserver(update)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    return (
        <div>
            <div className="flex gap-1 items-stretch">
                {/* Left axis — consumo (mc) */}
                <div className={cn('w-9 shrink-0 relative', heightClass)}>
                    <span className="absolute top-0 right-0 text-[8px] font-medium text-slate-400 leading-none tabular-nums">{fmtAxis(scale)}</span>
                    <span className="absolute top-1/2 right-0 -translate-y-1/2 text-[8px] font-medium text-slate-300 dark:text-slate-600 leading-none tabular-nums">{fmtAxis(scale / 2)}</span>
                    <span className="absolute bottom-0 right-0 text-[8px] font-medium text-slate-400 leading-none tabular-nums">0</span>
                </div>

                {/* Plot */}
                <div ref={plotRef} className={cn('flex-1 relative', heightClass)}>
                    {[0, 0.5, 1].map((f) => (
                        <div
                            key={f}
                            className="absolute left-0 right-0 border-t border-dashed border-slate-200/70 dark:border-white/10"
                            style={{ top: `${f * 100}%` }}
                        />
                    ))}

                    {/* Bars — current year */}
                    <div className="absolute inset-0 flex items-end justify-between gap-1.5">
                        {curByMonth.map((v, i) => {
                            const clipped = v > scale * 1.001
                            const pct = Math.min((v / scale) * 100, 100)
                            const isSel = selected === i
                            return (
                                <div
                                    key={i}
                                    className="flex-1 h-full relative flex flex-col justify-end items-center cursor-pointer"
                                    onClick={() => onSelect(i)}
                                    onMouseEnter={() => onSelect(i)}
                                >
                                    {clipped && (
                                        <span className="absolute top-0 left-1/2 -translate-x-1/2 text-[8px] leading-none text-[#1E5BFF] dark:text-[#93C5FD] z-10" title="Oltre scala">▲</span>
                                    )}
                                    <div
                                        className={cn(
                                            'w-full rounded-t-md transition-all duration-200',
                                            v > 0
                                                ? (isSel ? 'bg-gradient-to-t from-[#1E5BFF] to-[#60A5FA]' : 'bg-blue-200 dark:bg-blue-900/40')
                                                : 'bg-transparent'
                                        )}
                                        style={{ height: `${v > 0 ? Math.max(pct, 3) : 0}%` }}
                                    />
                                </div>
                            )
                        })}
                    </div>

                    {/* Previous-year comparison line (smooth, dashed) */}
                    {hasCompare && prevPath && (
                        <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
                            <path
                                d={prevPath}
                                fill="none"
                                stroke="#E89B3C"
                                strokeWidth="1.5"
                                strokeDasharray="3 3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                vectorEffect="non-scaling-stroke"
                            />
                        </svg>
                    )}

                    {/* Previous-year dots (HTML so they stay round) */}
                    {hasCompare && size.width > 0 && prevPts.map((p) => (
                        <div
                            key={`p-${p.i}`}
                            className="absolute top-0 left-0 pointer-events-none z-10"
                            style={{ transform: `translate3d(${(p.x / 100) * size.width}px, ${(p.y / 100) * size.height}px, 0)` }}
                        >
                            <div className={cn(
                                'absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-white border-2 border-[#E89B3C] transition-all',
                                selected === p.i ? 'w-3 h-3 shadow-[0_2px_8px_rgba(232,155,60,0.5)]' : 'w-2 h-2'
                            )} />
                        </div>
                    ))}
                </div>
            </div>

            {/* Month labels — aligned under the plot (match the axis gutter) */}
            <div className="flex gap-1 mt-2">
                <div className="w-9 shrink-0" />
                <div className="flex-1 flex justify-between gap-1.5">
                    {MONTHS.map((m, i) => (
                        <span
                            key={m}
                            className={cn(
                                'flex-1 text-center text-[8px] font-bold uppercase tracking-tighter transition-colors',
                                selected === i ? 'text-[#1E5BFF] dark:text-[#93C5FD]' : 'text-slate-400'
                            )}
                        >
                            {m}
                        </span>
                    ))}
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100 dark:border-white/5">
                <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-t from-[#1E5BFF] to-[#60A5FA]" />
                    <span className="text-[11px] font-bold text-slate-500">{currentYear}</span>
                </span>
                {hasCompare && (
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 border-t-2 border-dashed border-[#E89B3C]" />
                        <span className="text-[11px] font-bold text-slate-500">{prevYear}</span>
                    </span>
                )}
            </div>
        </div>
    )
}
