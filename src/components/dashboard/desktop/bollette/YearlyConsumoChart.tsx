'use client'

import { useEffect, useRef, useState, useLayoutEffect } from 'react'
import { cn } from '@/lib/utils'
import { smoothPath } from '@/lib/chart-path'
import type { YearlyChartData } from '@/lib/bill-chart'

interface YearlyConsumoChartProps {
    data: YearlyChartData
    years: number[]
    selectedYear: number
    onSelectYear: (year: number) => void
    formatEuro: (n: number) => string
}

/**
 * Combined month-by-month chart: bars = spesa (€), overlaid line = consumo (mc),
 * across the 12 calendar months of the selected year. A year selector switches
 * the dataset. Hover/click a month to inspect its values.
 */
export function YearlyConsumoChart({ data, years, selectedYear, onSelectYear, formatEuro }: YearlyConsumoChartProps) {
    const { months, spesaScale, consumoScale, totalSpesa, totalConsumo, hasData } = data

    // Default the inspected month to the last one that has data.
    const lastWithData = months.reduce((acc, m, i) => (m.count > 0 ? i : acc), -1)
    const [active, setActive] = useState<number | null>(lastWithData === -1 ? null : lastWithData)

    useEffect(() => {
        const last = months.reduce((acc, m, i) => (m.count > 0 ? i : acc), -1)
        setActive(last === -1 ? null : last)
    }, [selectedYear, months])

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

    const activeMonth = active !== null ? months[active] : null
    const headSpesa = activeMonth ? activeMonth.spesa : totalSpesa
    const headConsumo = activeMonth ? activeMonth.consumo : totalConsumo
    const headLabel = activeMonth ? `${activeMonth.label} ${selectedYear}` : `Totale ${selectedYear}`

    // Consumo line shares the bars' 0→100 vertical scale (0 at the bottom,
    // consumoScale at the top) so the line height is anchored to the right-hand
    // mc axis. Only months with a real reading are plotted (smooth waves).
    const consumoY = (v: number) => 100 - (Math.min(v, consumoScale) / consumoScale) * 100
    const consumoPts = months
        .map((m, i) => ({ x: (i + 0.5) * (100 / 12), y: consumoY(m.consumo), consumo: m.consumo, i }))
        .filter(p => months[p.i].count > 0)
    const consumoPath = smoothPath(consumoPts)

    // Axis tick labels: full grouped number up to 9.999, then "k" above.
    const fmtAxis = (n: number) =>
        n >= 10000
            ? `${(n / 1000).toLocaleString('it-IT', { maximumFractionDigits: 0 })}k`
            : Math.round(n).toLocaleString('it-IT')

    return (
        <div className="flex-1 flex flex-col min-h-0 h-full">
            {/* Header: value + year tabs */}
            <div className="flex items-start justify-between gap-2 mb-1">
                <div className="min-w-0">
                    <p className="text-[9px] font-bold tracking-widest text-slate-400 uppercase mb-0.5">
                        Spesa &amp; consumo mensile
                    </p>
                    <div className="flex items-baseline gap-2 flex-wrap">
                        <h3 className="text-2xl font-bold text-[#0A2540] dark:text-white tracking-tight leading-none">
                            {formatEuro(headSpesa)}
                        </h3>
                        <span className="text-[13px] font-bold text-indigo-500 dark:text-indigo-400 tabular-nums whitespace-nowrap">
                            {headConsumo.toLocaleString('it-IT', { maximumFractionDigits: 1 })} mc
                        </span>
                    </div>
                    <p className="text-[10px] text-[#1E5BFF] dark:text-[#93C5FD] font-bold uppercase tracking-wider mt-1">
                        {headLabel}
                    </p>
                </div>

                {years.length > 0 && (
                    <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-white/5 p-0.5 rounded-lg shrink-0">
                        {years.map(y => (
                            <button
                                key={y}
                                onClick={() => onSelectYear(y)}
                                className={cn(
                                    "px-2.5 h-7 rounded-md text-[12px] font-bold transition-colors",
                                    y === selectedYear
                                        ? "bg-white dark:bg-white/15 text-[#1E5BFF] dark:text-[#93C5FD] shadow-sm"
                                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white"
                                )}
                            >
                                {y}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Plot with € (left) and mc (right) axis references */}
            <div className="flex-1 min-h-0 flex gap-1 mt-1">
                {/* Left axis — spesa (€) */}
                {hasData && (
                    <div className="w-8 shrink-0 relative">
                        <span className="absolute top-0 right-0 text-[8px] font-medium text-slate-400 leading-none tabular-nums">€{fmtAxis(spesaScale)}</span>
                        <span className="absolute top-1/2 right-0 -translate-y-1/2 text-[8px] font-medium text-slate-300 dark:text-slate-600 leading-none tabular-nums">€{fmtAxis(spesaScale / 2)}</span>
                        <span className="absolute bottom-0 right-0 text-[8px] font-medium text-slate-400 leading-none tabular-nums">0</span>
                    </div>
                )}

                <div ref={plotRef} className="flex-1 min-h-0 relative">
                {/* Reference gridlines */}
                {hasData && [0, 0.5, 1].map((f) => (
                    <div
                        key={f}
                        className="absolute left-0 right-0 border-t border-dashed border-slate-200/70 dark:border-white/10"
                        style={{ top: `${f * 100}%` }}
                    />
                ))}
                {!hasData && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center text-center">
                        <p className="text-[11px] font-bold text-slate-400">
                            Nessun dato per il {selectedYear}
                        </p>
                    </div>
                )}

                {/* Bars (spesa) */}
                <div className={cn("absolute inset-0 flex items-end justify-between gap-1.5", !hasData && "opacity-30")}>
                    {months.map((m, i) => {
                        const isSelected = active === i
                        const clipped = m.spesa > spesaScale * 1.001
                        const pct = Math.min((m.spesa / spesaScale) * 100, 100)
                        return (
                            <div
                                key={m.month}
                                className="flex-1 h-full relative flex flex-col justify-end items-center cursor-pointer group"
                                onClick={() => m.count > 0 && setActive(i)}
                                onMouseEnter={() => m.count > 0 && setActive(i)}
                            >
                                {clipped && (
                                    <span
                                        className="absolute top-0 left-1/2 -translate-x-1/2 text-[8px] leading-none text-[#1E5BFF] dark:text-[#93C5FD] z-10"
                                        title="Oltre scala"
                                    >
                                        ▲
                                    </span>
                                )}
                                <div
                                    className="w-full rounded-t-md relative overflow-hidden transition-[height] duration-300"
                                    style={{ height: `${m.count > 0 ? Math.max(pct, 4) : 2}%` }}
                                >
                                    <div className="absolute inset-0 bg-blue-100 dark:bg-blue-900/30" />
                                    {m.count > 0 && (
                                        <div className={cn(
                                            "absolute inset-0 bg-gradient-to-t from-[#1E5BFF] to-[#60A5FA] transition-opacity duration-300",
                                            isSelected ? "opacity-100" : "opacity-70 group-hover:opacity-90"
                                        )} />
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Consumo line overlay (smooth waves through real readings) */}
                {hasData && consumoPath && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
                        <path
                            d={consumoPath}
                            fill="none"
                            stroke="#6366f1"
                            strokeWidth="1.5"
                            strokeDasharray="3 3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                            className="opacity-80"
                        />
                    </svg>
                )}

                {/* Consumo dots (HTML so they stay round) */}
                {hasData && size.width > 0 && consumoPts.map((p) => (
                    <div
                        key={`c-${p.i}`}
                        className="absolute top-0 left-0 pointer-events-none z-10"
                        style={{ transform: `translate3d(${(p.x / 100) * size.width}px, ${(p.y / 100) * size.height}px, 0)` }}
                    >
                        <div className={cn(
                            "absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-white border-2 border-indigo-500 transition-all",
                            active === p.i ? "w-3 h-3 shadow-[0_2px_8px_rgba(99,102,241,0.5)]" : "w-2 h-2"
                        )} />
                    </div>
                ))}

                {/* Active month tooltip */}
                {activeMonth && size.width > 0 && (
                    <div
                        className="absolute top-0 left-0 z-20 pointer-events-none transition-transform duration-200"
                        style={{ transform: `translate3d(${((active! + 0.5) * (100 / 12) / 100) * size.width}px, 0, 0) translateX(-50%)` }}
                    >
                        <div className="bg-[#0A2540] dark:bg-white text-white dark:text-[#0A2540] px-2.5 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap shadow-lg leading-tight text-center">
                            <div>{formatEuro(activeMonth.spesa)}</div>
                            <div className="text-indigo-300 dark:text-indigo-600">{activeMonth.consumo.toLocaleString('it-IT', { maximumFractionDigits: 1 })} mc</div>
                        </div>
                    </div>
                )}
                </div>

                {/* Right axis — consumo (mc) */}
                {hasData && (
                    <div className="w-9 shrink-0 relative">
                        <span className="absolute top-0 left-0 text-[8px] font-medium text-indigo-400 leading-none tabular-nums">{fmtAxis(consumoScale)}</span>
                        <span className="absolute top-1/2 left-0 -translate-y-1/2 text-[8px] font-medium text-indigo-300 dark:text-indigo-500/70 leading-none tabular-nums">{fmtAxis(consumoScale / 2)}</span>
                        <span className="absolute bottom-0 left-0 text-[8px] font-medium text-indigo-400 leading-none tabular-nums">0</span>
                    </div>
                )}
            </div>

            {/* Month labels — aligned under the plot (match the axis gutters) */}
            <div className="flex gap-1 mt-2 shrink-0">
                {hasData && <div className="w-8 shrink-0" />}
                <div className="flex-1 flex justify-between gap-1.5">
                    {months.map((m, i) => (
                        <span
                            key={m.month}
                            className={cn(
                                "flex-1 text-center text-[8px] font-bold uppercase tracking-tighter transition-colors",
                                active === i ? "text-[#1E5BFF] dark:text-[#93C5FD]" : "text-slate-400"
                            )}
                        >
                            {m.label}
                        </span>
                    ))}
                </div>
                {hasData && <div className="w-9 shrink-0" />}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 mt-1.5 shrink-0">
                <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-t from-[#1E5BFF] to-[#60A5FA]" />
                    <span className="text-[10px] font-bold text-slate-500">Spesa (€)</span>
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-3 border-t-2 border-dashed border-indigo-500" />
                    <span className="text-[10px] font-bold text-slate-500">Consumo (mc)</span>
                </span>
            </div>
        </div>
    )
}
