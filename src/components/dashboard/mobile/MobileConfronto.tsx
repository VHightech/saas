'use client'

import { useMemo } from 'react'
import { ChevronLeft, Lightbulb, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDashboard } from '@/components/dashboard/dashboard-context'
import { consumptionComparison, consumptionAdviceText } from '@/lib/consumption-advice'
import { ConsumoComparisonChart } from '@/components/dashboard/ConsumoComparisonChart'
import type { Bill } from '@/types/dashboard'
import type { UserSupply } from './MobileShell'

interface MobileConfrontoProps {
    bills: Bill[]
    supplies?: UserSupply[]
    onBack: () => void
}

const fmtMc = (n: number) => n.toLocaleString('it-IT', { maximumFractionDigits: n < 10 ? 1 : 0 })

export function MobileConfronto({ bills = [], supplies = [], onBack }: MobileConfrontoProps) {
    const { selectedSupply } = useDashboard()

    const supplyBills = useMemo(
        () => (selectedSupply && selectedSupply !== 'all' ? bills.filter((b: any) => b.ulm === selectedSupply) : []),
        [bills, selectedSupply]
    )
    const supply = useMemo(() => supplies.find((s: any) => s?.ulm === selectedSupply), [supplies, selectedSupply])

    // Stesso calcolo della schermata desktop (una sola funzione condivisa).
    const { advice, curByMonth, prevByMonth, prevCovered, currentYear, prevYear, hasCompare, curTotal, prevTotal } =
        useMemo(() => consumptionComparison(supplyBills), [supplyBills])

    // Si mostra la percentuale arrotondata: 0% non e' ne' calo ne' aumento.
    const diffRounded = Math.round(advice.diffPct)
    const trend: 'down' | 'up' | 'flat' = diffRounded < 0 ? 'down' : diffRounded > 0 ? 'up' : 'flat'
    // A meta' anno il confronto copre i soli mesi fatturati: va detto.
    const periodo = advice.partial ? `${advice.periodLabel} ` : ''
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
                            trend === 'down' ? 'bg-gradient-to-br from-[#1E7A5A] to-[#2EA67D]'
                                : trend === 'up' ? 'bg-gradient-to-br from-[#A6411F] to-[#D86B45]'
                                    : 'bg-gradient-to-br from-[#0A2540] to-[#1E5BFF]'
                        )}>
                            <div className="flex items-center gap-2 mb-2">
                                {trend === 'down' ? <TrendingDown size={14} />
                                    : trend === 'up' ? <TrendingUp size={14} />
                                        : <Minus size={14} />}
                                <span className="text-[10px] font-bold tracking-[0.2em] uppercase">
                                    {trend === 'down' ? 'Stai consumando meno'
                                        : trend === 'up' ? 'Stai consumando di più'
                                            : 'Consumi stabili'}
                                </span>
                            </div>
                            <p className="text-5xl font-bold tracking-tight mb-1">
                                {diffRounded > 0 ? '+' : ''}{diffRounded}%
                                <span className="text-base font-bold opacity-80"> vs {prevYear}</span>
                            </p>
                            <p className="text-xs font-medium opacity-80 mt-2">
                                {fmtMc(curTotal)} mc ({periodo}{currentYear}) contro {fmtMc(prevTotal)} mc ({periodo}{prevYear})
                            </p>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-6">
                            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-400 mb-1">Consumo {periodo}{currentYear}</p>
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
                            prevCovered={prevCovered}
                            lastCoveredMonth={advice.lastMonth}
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
