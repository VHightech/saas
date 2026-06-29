'use client'

import { useMemo } from 'react'
import { ChevronLeft, Lightbulb, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDashboard } from '@/components/dashboard/dashboard-context'
import { consumptionAdvice, consumptionAdviceText } from '@/lib/consumption-advice'
import { ConsumoComparisonChart } from '@/components/dashboard/ConsumoComparisonChart'
import type { Bill } from '@/types/dashboard'
import type { UserSupply } from './MobileShell'

interface MobileConfrontoProps {
    bills: Bill[]
    supplies?: UserSupply[]
    onBack: () => void
}

const num = (v: unknown): number => parseFloat(String(v ?? 0).replace(',', '.')) || 0
const fmtMc = (n: number) => n.toLocaleString('it-IT', { maximumFractionDigits: n < 10 ? 1 : 0 })

export function MobileConfronto({ bills = [], supplies = [], onBack }: MobileConfrontoProps) {
    const { selectedSupply } = useDashboard()

    const supplyBills = useMemo(
        () => (selectedSupply && selectedSupply !== 'all' ? bills.filter((b: any) => b.ulm === selectedSupply) : []),
        [bills, selectedSupply]
    )
    const supply = useMemo(() => supplies.find((s: any) => s?.ulm === selectedSupply), [supplies, selectedSupply])

    const advice = useMemo(() => consumptionAdvice(supplyBills), [supplyBills])

    const { curByMonth, prevByMonth, currentYear, prevYear, hasCompare, curTotal, prevTotal } = useMemo(() => {
        const sumByMonth = (year: number) => {
            const arr = new Array(12).fill(0)
            supplyBills.forEach((b: any) => {
                const d = new Date(b.data_emissione)
                if (!Number.isNaN(d.getTime()) && d.getFullYear() === year) arr[d.getMonth()] += num(b.consumo)
            })
            return arr
        }
        const cy = advice.currentYear
        const py = advice.prevYear
        const cur = sumByMonth(cy)
        const prev = py ? sumByMonth(py) : new Array(12).fill(0)
        return {
            curByMonth: cur,
            prevByMonth: prev,
            currentYear: cy,
            prevYear: py,
            hasCompare: advice.hasData,
            curTotal: cur.reduce((a, b) => a + b, 0),
            prevTotal: prev.reduce((a, b) => a + b, 0),
        }
    }, [supplyBills, advice])

    const isLess = advice.diffPct < 0
    const empty = selectedSupply === 'all' || supplyBills.length === 0

    return (
        <div className="px-5 pt-4 pb-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button onClick={onBack} className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-[#0A2540] dark:text-white shrink-0 active:scale-90 transition-transform">
                    <ChevronLeft size={24} />
                </button>
                <div className="text-center min-w-0 px-2">
                    <p className="text-xl font-bold text-[#0A2540] dark:text-white leading-tight">Confronto consumi</p>
                    {supply?.address && (
                        <p className="text-[12px] font-medium text-slate-400 truncate">{supply.address}</p>
                    )}
                </div>
                <div className="w-12 shrink-0" />
            </div>

            {empty ? (
                <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-8 text-center">
                    <p className="text-sm text-slate-400 font-medium">
                        Seleziona una fornitura dalla home per confrontare i consumi.
                    </p>
                </div>
            ) : (
                <>
                    {/* Hero stat */}
                    {hasCompare ? (
                        <div className={cn(
                            'relative overflow-hidden rounded-3xl text-white p-6',
                            isLess ? 'bg-gradient-to-br from-[#1E7A5A] to-[#2EA67D]' : 'bg-gradient-to-br from-[#A6411F] to-[#D86B45]'
                        )}>
                            <div className="flex items-center gap-2 mb-2">
                                {isLess ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                                <span className="text-[10px] font-bold tracking-[0.2em] uppercase">
                                    {isLess ? 'Stai consumando meno' : 'Stai consumando di più'}
                                </span>
                            </div>
                            <p className="text-5xl font-bold tracking-tight mb-1">
                                {advice.diffPct > 0 ? '+' : ''}{advice.diffPct.toFixed(0)}%
                                <span className="text-base font-bold opacity-80"> vs {prevYear}</span>
                            </p>
                            <p className="text-xs font-medium opacity-80 mt-2">
                                {fmtMc(curTotal)} mc ({currentYear}) contro {fmtMc(prevTotal)} mc ({prevYear})
                            </p>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-6">
                            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-400 mb-1">Consumo {currentYear}</p>
                            <p className="text-4xl font-bold tracking-tight text-[#0A2540] dark:text-white flex items-baseline gap-2">
                                {fmtMc(curTotal)} <span className="text-base font-medium text-slate-400">mc</span>
                            </p>
                            <p className="text-xs font-medium text-slate-400 mt-2">
                                Il confronto con l&apos;anno precedente sarà disponibile appena avremo due anni di letture.
                            </p>
                        </div>
                    )}

                    {/* Chart */}
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-5">
                        <p className="text-sm font-bold text-[#0A2540] dark:text-white mb-4">Andamento mensile</p>
                        <ConsumoComparisonChart
                            curByMonth={curByMonth}
                            prevByMonth={prevByMonth}
                            currentYear={currentYear}
                            prevYear={prevYear}
                            hasCompare={hasCompare}
                            heightClass="h-52"
                        />
                    </div>

                    {/* Consiglio */}
                    <div className="bg-[#F8FAFC] dark:bg-white/5 rounded-2xl p-4 flex gap-3 items-start">
                        <div className={cn(
                            'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                            advice.level === 'alert' ? 'bg-rose-500/10 text-rose-500'
                                : advice.level === 'warn' ? 'bg-orange-500/10 text-orange-500'
                                    : 'bg-[#1E5BFF]/10 text-[#1E5BFF]'
                        )}>
                            <Lightbulb size={18} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-[#0A2540] dark:text-white">Analisi dei consumi</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed mt-0.5">
                                {consumptionAdviceText(advice)}
                            </p>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
