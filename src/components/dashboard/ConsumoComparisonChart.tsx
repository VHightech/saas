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
import { robustScale, niceCeil } from '@/lib/bill-chart'

const MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

const fmtAxis = (n: number) =>
    n >= 10000
        ? `${(n / 1000).toLocaleString('it-IT', { maximumFractionDigits: 0 })}k`
        : Math.round(n).toLocaleString('it-IT')

const fmtMc = (n: number) => n.toLocaleString('it-IT', { maximumFractionDigits: n < 10 ? 1 : 0 })

const chartConfig = {
    cur: { label: 'Anno corrente', color: '#1E5BFF' },
    prev: { label: 'Anno precedente', color: '#E89B3C' },
} satisfies ChartConfig

interface ConsumoComparisonChartProps {
    curByMonth: number[]
    prevByMonth: number[]
    currentYear: number
    prevYear: number
    hasCompare: boolean
    heightClass?: string
}

/**
 * Year-over-year consumo chart (Recharts / shadcn) shared by mobile + desktop
 * Confronto: bars = current year, dashed line + soft area = previous year, on a
 * single mc axis with reference ticks, gridlines and an outlier-resistant scale.
 */
export function ConsumoComparisonChart({
    curByMonth,
    prevByMonth,
    currentYear,
    prevYear,
    hasCompare,
    heightClass = 'h-52',
}: ConsumoComparisonChartProps) {
    const scale = niceCeil(robustScale([...curByMonth, ...prevByMonth]))

    const data = MONTHS.map((m, i) => ({
        month: m,
        cur: curByMonth[i] || 0,
        prev: hasCompare && prevByMonth[i] > 0 ? prevByMonth[i] : null,
    }))

    return (
        <div>
            <ChartContainer config={chartConfig} className={cn('w-full aspect-auto', heightClass)}>
                <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
                    <defs>
                        <linearGradient id="fillCur" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#60A5FA" stopOpacity={1} />
                            <stop offset="100%" stopColor="#1E5BFF" stopOpacity={0.85} />
                        </linearGradient>
                        <linearGradient id="fillPrev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#E89B3C" stopOpacity={0.22} />
                            <stop offset="100%" stopColor="#E89B3C" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="currentColor" className="text-slate-200/60 dark:text-white/10" />
                    <XAxis
                        dataKey="month"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={6}
                        tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
                    />
                    <YAxis
                        domain={[0, scale]}
                        allowDataOverflow
                        width={34}
                        tickCount={3}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 8, fill: '#94a3b8' }}
                        tickFormatter={(v) => fmtAxis(v)}
                    />
                    <ChartTooltip
                        cursor={{ fill: 'rgba(30,91,255,0.07)', radius: 6 }}
                        content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null
                            const c = payload.find(p => p.dataKey === 'cur')?.value as number | undefined
                            const p = payload.find(pp => pp.dataKey === 'prev')?.value as number | undefined
                            return (
                                <div className="rounded-lg border border-slate-200/60 dark:border-white/10 bg-white dark:bg-[#1A1D23] px-2.5 py-1.5 text-xs shadow-xl">
                                    <div className="font-bold text-[#0A2540] dark:text-white mb-1">{label}</div>
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-sm bg-gradient-to-t from-[#1E5BFF] to-[#60A5FA]" />
                                        <span className="text-slate-500 dark:text-slate-400">{currentYear}</span>
                                        <span className="ml-auto font-mono font-medium tabular-nums text-[#0A2540] dark:text-white">{fmtMc(c ?? 0)} mc</span>
                                    </div>
                                    {hasCompare && (
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="w-2.5 border-t-2 border-dashed border-[#E89B3C]" />
                                            <span className="text-slate-500 dark:text-slate-400">{prevYear}</span>
                                            <span className="ml-auto font-mono font-medium tabular-nums text-[#B45309] dark:text-[#E89B3C]">{fmtMc(p ?? 0)} mc</span>
                                        </div>
                                    )}
                                </div>
                            )
                        }}
                    />
                    <Bar
                        dataKey="cur"
                        fill="url(#fillCur)"
                        fillOpacity={0.9}
                        radius={[6, 6, 0, 0]}
                        maxBarSize={30}
                        activeBar={{ fillOpacity: 1, stroke: '#1E5BFF', strokeOpacity: 0.25, strokeWidth: 4 }}
                        animationDuration={900}
                        animationEasing="ease-out"
                    />
                    {hasCompare && (
                        <Area
                            dataKey="prev"
                            type="monotone"
                            fill="url(#fillPrev)"
                            stroke="none"
                            connectNulls
                            animationDuration={1000}
                            animationEasing="ease-out"
                        />
                    )}
                    {hasCompare && (
                        <Line
                            dataKey="prev"
                            type="monotone"
                            stroke="var(--color-prev)"
                            strokeWidth={2.5}
                            strokeDasharray="5 3"
                            connectNulls
                            dot={{ r: 2.5, fill: '#fff', stroke: 'var(--color-prev)', strokeWidth: 2 }}
                            activeDot={{ r: 5, fill: 'var(--color-prev)', stroke: '#fff', strokeWidth: 2 }}
                            animationDuration={1100}
                            animationEasing="ease-out"
                        />
                    )}
                </ComposedChart>
            </ChartContainer>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 mt-2">
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
