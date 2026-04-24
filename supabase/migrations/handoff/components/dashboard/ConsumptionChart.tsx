'use client'

/**
 * Consumption chart — recharts-based, responsive, with period filter.
 * Drop into src/components/dashboard/widgets/ConsumptionChart.tsx
 *
 * Data shape: ConsumptionBucket[] (see src/types/dashboard-extended.ts)
 * Returned by useConsumption(bills, monthsBack).
 */

import * as React from 'react'
import {
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, ReferenceLine,
} from 'recharts'
import type { ConsumptionBucket } from '@/types/dashboard-extended'
import { fmtEur, fmtM3 } from '@/lib/format'

type Period = '1M' | '3M' | '6M' | '1Y'
type Metric = 'volume' | 'cost'

export interface ConsumptionChartProps {
    data: ConsumptionBucket[]
    period?: Period
    onPeriodChange?: (p: Period) => void
    metric?: Metric
    onMetricChange?: (m: Metric) => void
    height?: number
}

const PERIODS: Array<[Period, number]> = [['1M', 1], ['3M', 3], ['6M', 6], ['1Y', 12]]

export function ConsumptionChart({
    data, period = '1Y', onPeriodChange,
    metric = 'volume', onMetricChange, height = 260,
}: ConsumptionChartProps) {
    const months = PERIODS.find(([k]) => k === period)?.[1] ?? 12
    const sliced = data.slice(-months)
    const key = metric === 'volume' ? 'value' : 'cost'
    const unit = metric === 'volume' ? 'm³' : '€'

    const avg = sliced.length
        ? sliced.reduce((s, b) => s + (b[key] as number), 0) / sliced.length
        : 0

    return (
        <div className="rounded-2xl border border-[var(--acq-ink-soft)] bg-[var(--acq-surface)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                    <div className="text-xs font-semibold tracking-wider uppercase text-[var(--acq-ink-sub)]">
                        Consumi {metric === 'volume' ? 'idrici' : '€'}
                    </div>
                    <div className="font-[var(--acq-font-display)] text-2xl md:text-3xl tracking-tight text-[var(--acq-ink)] mt-1">
                        {metric === 'volume' ? fmtM3(sliced.reduce((s, b) => s + b.value, 0)) : fmtEur(sliced.reduce((s, b) => s + b.cost, 0))}
                    </div>
                    <div className="text-xs text-[var(--acq-ink-sub)] mt-1">
                        Media mensile: {metric === 'volume' ? fmtM3(avg) : fmtEur(avg)}
                    </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                    <div className="inline-flex rounded-lg bg-[var(--acq-ink-soft)] p-0.5">
                        {(['volume', 'cost'] as const).map(m => (
                            <button key={m}
                                onClick={() => onMetricChange?.(m)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${metric === m
                                    ? 'bg-[var(--acq-surface)] text-[var(--acq-ink)] shadow-sm'
                                    : 'text-[var(--acq-ink-sub)]'}`}>
                                {m === 'volume' ? 'm³' : '€'}
                            </button>
                        ))}
                    </div>
                    <div className="inline-flex rounded-lg bg-[var(--acq-ink-soft)] p-0.5">
                        {PERIODS.map(([p]) => (
                            <button key={p}
                                onClick={() => onPeriodChange?.(p)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${period === p
                                    ? 'bg-[var(--acq-surface)] text-[var(--acq-ink)] shadow-sm'
                                    : 'text-[var(--acq-ink-sub)]'}`}>
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <ResponsiveContainer width="100%" height={height}>
                <AreaChart data={sliced} margin={{ top: 8, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="acqFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--acq-blue)" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="var(--acq-blue)" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--acq-ink-hair)" />
                    <XAxis dataKey="monthLabel" axisLine={false} tickLine={false}
                        tick={{ fontSize: 11, fill: 'var(--acq-ink-sub)', fontFamily: 'var(--acq-font-sans)' }} />
                    <YAxis axisLine={false} tickLine={false}
                        tick={{ fontSize: 11, fill: 'var(--acq-ink-sub)', fontFamily: 'var(--acq-font-sans)' }} />
                    <Tooltip
                        content={({ active, payload }) => {
                            if (!active || !payload?.length) return null
                            const b = payload[0].payload as ConsumptionBucket
                            return (
                                <div className="rounded-lg border border-[var(--acq-ink-soft)] bg-[var(--acq-surface)] px-3 py-2 shadow-lg">
                                    <div className="text-xs font-semibold text-[var(--acq-ink)] capitalize">{b.monthLabel}</div>
                                    <div className="text-sm text-[var(--acq-ink)] tabular-nums">
                                        {metric === 'volume' ? fmtM3(b.value) : fmtEur(b.cost)}
                                    </div>
                                    {b.previousYearValue !== undefined && (
                                        <div className="text-xs text-[var(--acq-ink-sub)] mt-1">
                                            Anno scorso: {metric === 'volume' ? fmtM3(b.previousYearValue) : '—'}
                                        </div>
                                    )}
                                </div>
                            )
                        }} />
                    <ReferenceLine y={avg} stroke="var(--acq-amber)" strokeDasharray="4 3" />
                    <Area type="monotone" dataKey={key} stroke="var(--acq-blue)" strokeWidth={2}
                        fill="url(#acqFill)" activeDot={{ r: 4, fill: 'var(--acq-blue)' }} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    )
}
