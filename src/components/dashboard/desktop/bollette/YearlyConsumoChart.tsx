'use client'

import {
    Area,
    Bar,
    CartesianGrid,
    ComposedChart,
    Line,
    XAxis,
    YAxis,
} from 'recharts'
import { cn } from '@/lib/utils'
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart'
import type { YearlyChartData } from '@/lib/bill-chart'

interface YearlyConsumoChartProps {
    data: YearlyChartData
    years: number[]
    selectedYear: number
    onSelectYear: (year: number) => void
    formatEuro: (n: number) => string
}

const chartConfig = {
    spesa: { label: 'Spesa (€)', color: '#1E5BFF' },
    consumo: { label: 'Consumo (mc)', color: '#6366f1' },
} satisfies ChartConfig

const fmtAxis = (n: number) =>
    n >= 10000
        ? `${(n / 1000).toLocaleString('it-IT', { maximumFractionDigits: 0 })}k`
        : Math.round(n).toLocaleString('it-IT')

/**
 * Combined month-by-month chart (Recharts / shadcn): bars = spesa (€) on the
 * left axis, dashed line = consumo (mc) on the right axis, across the 12 months
 * of the selected year. A year selector switches the dataset.
 */
export function YearlyConsumoChart({ data, years, selectedYear, onSelectYear, formatEuro }: YearlyConsumoChartProps) {
    const { months, spesaScale, consumoScale, totalSpesa, totalConsumo, hasData } = data

    const chartData = months.map(m => ({
        month: m.label,
        spesa: m.spesa,
        // null on months without a bill so the line waves across real readings.
        consumo: m.count > 0 ? m.consumo : null,
    }))

    return (
        <div className="flex-1 flex flex-col min-h-0 h-full">
            {/* Header: totals + year tabs */}
            <div className="flex items-start justify-between gap-2 mb-1">
                <div className="min-w-0">
                    <p className="text-[9px] font-bold tracking-widest text-slate-400 uppercase mb-0.5">
                        Spesa &amp; consumo mensile
                    </p>
                    <div className="flex items-baseline gap-2 flex-wrap">
                        <h3 className="text-2xl font-bold text-[#0A2540] dark:text-white tracking-tight leading-none">
                            {formatEuro(totalSpesa)}
                        </h3>
                        <span className="text-[13px] font-bold text-indigo-500 dark:text-indigo-400 tabular-nums whitespace-nowrap">
                            {totalConsumo.toLocaleString('it-IT', { maximumFractionDigits: 1 })} mc
                        </span>
                    </div>
                    <p className="text-[10px] text-[#1E5BFF] dark:text-[#93C5FD] font-bold uppercase tracking-wider mt-1">
                        Totale {selectedYear}
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

            {/* Chart */}
            <div className="flex-1 min-h-0 mt-1">
                {!hasData ? (
                    <div className="h-full flex items-center justify-center text-center">
                        <p className="text-[11px] font-bold text-slate-400">Nessun dato per il {selectedYear}</p>
                    </div>
                ) : (
                    <ChartContainer config={chartConfig} className="h-full w-full aspect-auto">
                        <ComposedChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
                            <defs>
                                <linearGradient id="fillSpesa" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#60A5FA" stopOpacity={1} />
                                    <stop offset="100%" stopColor="#1E5BFF" stopOpacity={0.85} />
                                </linearGradient>
                                <linearGradient id="fillConsumo" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.22} />
                                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="currentColor" className="text-slate-200/60 dark:text-white/10" />
                            <XAxis
                                dataKey="month"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={6}
                                interval={0}
                                minTickGap={0}
                                tick={{ fontSize: 8, fontWeight: 700, fill: '#94a3b8' }}
                            />
                            <YAxis
                                yAxisId="spesa"
                                domain={[0, spesaScale]}
                                allowDataOverflow
                                width={34}
                                tickCount={3}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 8, fill: '#94a3b8' }}
                                tickFormatter={(v) => `€${fmtAxis(v)}`}
                            />
                            <YAxis
                                yAxisId="consumo"
                                orientation="right"
                                domain={[0, consumoScale]}
                                width={30}
                                tickCount={3}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 8, fill: '#818cf8' }}
                                tickFormatter={(v) => fmtAxis(v)}
                            />
                            <ChartTooltip
                                cursor={{ fill: 'rgba(30,91,255,0.07)', radius: 6 }}
                                content={({ active, payload, label }) => {
                                    if (!active || !payload?.length) return null
                                    const sp = payload.find(p => p.dataKey === 'spesa')?.value as number | undefined
                                    const co = payload.find(p => p.dataKey === 'consumo')?.value as number | undefined
                                    return (
                                        <div className="rounded-lg border border-slate-200/60 dark:border-white/10 bg-white dark:bg-[#1A1D23] px-2.5 py-1.5 text-xs shadow-xl">
                                            <div className="font-bold text-[#0A2540] dark:text-white mb-1">{label} {selectedYear}</div>
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-sm bg-gradient-to-t from-[#1E5BFF] to-[#60A5FA]" />
                                                <span className="text-slate-500 dark:text-slate-400">Spesa</span>
                                                <span className="ml-auto font-mono font-medium tabular-nums text-[#0A2540] dark:text-white">{formatEuro(sp ?? 0)}</span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="w-2.5 border-t-2 border-dashed border-indigo-500" />
                                                <span className="text-slate-500 dark:text-slate-400">Consumo</span>
                                                <span className="ml-auto font-mono font-medium tabular-nums text-indigo-500 dark:text-indigo-400">{(co ?? 0).toLocaleString('it-IT', { maximumFractionDigits: 1 })} mc</span>
                                            </div>
                                        </div>
                                    )
                                }}
                            />
                            <Bar
                                yAxisId="spesa"
                                dataKey="spesa"
                                fill="url(#fillSpesa)"
                                fillOpacity={0.9}
                                radius={[6, 6, 0, 0]}
                                maxBarSize={30}
                                activeBar={{ fillOpacity: 1, stroke: '#1E5BFF', strokeOpacity: 0.25, strokeWidth: 4 }}
                                animationDuration={900}
                                animationEasing="ease-out"
                            />
                            <Area
                                yAxisId="consumo"
                                dataKey="consumo"
                                type="monotone"
                                fill="url(#fillConsumo)"
                                stroke="none"
                                connectNulls
                                animationDuration={1000}
                                animationEasing="ease-out"
                            />
                            <Line
                                yAxisId="consumo"
                                dataKey="consumo"
                                type="monotone"
                                stroke="var(--color-consumo)"
                                strokeWidth={2.5}
                                strokeDasharray="5 3"
                                connectNulls
                                dot={{ r: 3, fill: 'var(--color-consumo)', stroke: '#fff', strokeWidth: 1.5 }}
                                activeDot={{ r: 5, fill: 'var(--color-consumo)', stroke: '#fff', strokeWidth: 2 }}
                                animationDuration={1100}
                                animationEasing="ease-out"
                            />
                        </ComposedChart>
                    </ChartContainer>
                )}
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
