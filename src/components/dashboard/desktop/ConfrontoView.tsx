'use client'

import { useMemo, useState } from 'react'
import { TrendingUp, TrendingDown, Minus, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DesktopSidebar } from '@/components/dashboard/desktop/DesktopSidebar'
import { useSidebarPin, sidebarMainOffset } from '@/components/dashboard/desktop/use-sidebar-pin'
import { MobileConfronto } from '@/components/dashboard/mobile/MobileConfronto'
import { ConsumoComparisonChart } from '@/components/dashboard/ConsumoComparisonChart'
import { consumptionComparison, consumptionAdviceText } from '@/lib/consumption-advice'
import type { Bill, UserSupply } from '@/types/dashboard'

const fmtMc = (n: number) => n.toLocaleString('it-IT', { maximumFractionDigits: n < 10 ? 1 : 0 })

interface ConfrontoViewProps {
    bills: Bill[]
    supplies?: UserSupply[]
}

export function ConfrontoView({ bills, supplies = [] }: ConfrontoViewProps) {
    // Barra laterale bloccata aperta: il contenuto si sposta con lei.
    const { pinned } = useSidebarPin()
    // user_supplies has no `ulm` column — it's derived from the last 6 of `cif`
    // (matching bills.ulm, a generated column). Derive it here so the supply
    // filter actually matches bills (otherwise the page shows no data).
    const realSupplies = useMemo(
        () => supplies
            .map((s: any) => ({ ...s, ulm: s.ulm || (s.cif ? String(s.cif).slice(-6) : '') }))
            .filter((s: any) => s.ulm),
        [supplies]
    )

    const [selectedUlm, setSelectedUlm] = useState<string>(() => {
        const withBills = realSupplies.find((s: any) => bills.some((b: any) => b.ulm === s.ulm))
        return (withBills?.ulm || realSupplies[0]?.ulm || '') as string
    })

    const supplyBills = useMemo(
        () => (selectedUlm ? bills.filter((b: any) => b.ulm === selectedUlm) : []),
        [bills, selectedUlm]
    )
    // Un solo calcolo, condiviso con la schermata mobile: prima erano due blocchi
    // gemelli, ed e' cosi' che le due viste finiscono per divergere.
    const { advice, curByMonth, prevByMonth, prevCovered, currentYear, prevYear, hasCompare, curTotal, prevTotal } =
        useMemo(() => consumptionComparison(supplyBills), [supplyBills])

    // Si mostra la percentuale arrotondata: 0% non e' ne' calo ne' aumento.
    const diffRounded = Math.round(advice.diffPct)
    const trend: 'down' | 'up' | 'flat' = diffRounded < 0 ? 'down' : diffRounded > 0 ? 'up' : 'flat'
    // A meta' anno il confronto copre i soli mesi fatturati: va detto.
    const periodo = advice.partial ? `${advice.periodLabel} ` : ''
    const selectedSupply = realSupplies.find((s: any) => s.ulm === selectedUlm)
    const noData = !selectedUlm || supplyBills.length === 0

    return (
        <>
            {/* MOBILE — reuse the mobile confronto screen */}
            <div className="lg:hidden min-h-screen bg-[#F8FAFC] dark:bg-[#0F1115]">
                <MobileConfronto bills={bills} supplies={supplies} onBack={() => history.back()} />
            </div>

            {/* DESKTOP */}
            <div className="hidden lg:block h-screen overflow-hidden bg-[#F8FAFC] dark:bg-[#0F1115]">
                <DesktopSidebar />
                <main className={cn(sidebarMainOffset(pinned), "h-full overflow-y-auto custom-scrollbar")}>
                    <div className="max-w-[1100px] mx-auto p-8 space-y-6">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Analisi</p>
                            <h1 className="text-3xl font-bold text-[#0A2540] dark:text-white tracking-tight">Confronto consumi</h1>
                        </div>

                        {/* Supply selector */}
                        {realSupplies.length > 1 && (
                            <div className="flex gap-2 flex-wrap">
                                {realSupplies.map((s: any, i: number) => {
                                    const active = s.ulm === selectedUlm
                                    return (
                                        <button
                                            key={`${s.ulm}-${i}`}
                                            onClick={() => setSelectedUlm(s.ulm)}
                                            className={cn(
                                                'px-4 py-2 rounded-full text-[13px] font-bold transition-all',
                                                active
                                                    ? 'bg-[#1E5BFF] text-white shadow-sm'
                                                    : 'bg-white dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'
                                            )}
                                        >
                                            {s.address || s.city || s.ulm}
                                        </button>
                                    )
                                })}
                            </div>
                        )}

                        {noData ? (
                            <div className="bg-white dark:bg-[#1A1D23] rounded-[2rem] p-12 text-center">
                                <p className="text-sm text-slate-400 font-medium">
                                    Nessun dato di consumo disponibile per questa fornitura.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-6 items-start">
                                {/* Chart card */}
                                <div className="col-span-2 bg-white dark:bg-[#1A1D23] rounded-[2rem] p-6">
                                    <div className="mb-5">
                                        <h2 className="text-lg font-bold text-[#0A2540] dark:text-white">Andamento mensile</h2>
                                        {selectedSupply?.address && (
                                            <p className="text-[12px] text-slate-400 font-medium">{selectedSupply.address}</p>
                                        )}
                                    </div>

                                    <ConsumoComparisonChart
                                        curByMonth={curByMonth}
                                        prevByMonth={prevByMonth}
                                        prevCovered={prevCovered}
                                        lastCoveredMonth={advice.lastMonth}
                                        currentYear={currentYear}
                                        prevYear={prevYear}
                                        hasCompare={hasCompare}
                                        heightClass="h-72"
                                    />
                                </div>

                                {/* Side: hero diff + advice */}
                                <div className="space-y-6">
                                    {hasCompare ? (
                                        <div className={cn(
                                            'rounded-[2rem] text-white p-6',
                                            trend === 'down' ? 'bg-gradient-to-br from-[#1E7A5A] to-[#2EA67D]'
                                                : trend === 'up' ? 'bg-gradient-to-br from-[#A6411F] to-[#D86B45]'
                                                    : 'bg-gradient-to-br from-[#0A2540] to-[#1E5BFF]'
                                        )}>
                                            <div className="flex items-center gap-2 mb-2">
                                                {trend === 'down' ? <TrendingDown size={14} />
                                                    : trend === 'up' ? <TrendingUp size={14} />
                                                        : <Minus size={14} />}
                                                <span className="text-[10px] font-bold tracking-[0.2em] uppercase">
                                                    {trend === 'down' ? 'Consumi in calo'
                                                        : trend === 'up' ? 'Consumi in aumento'
                                                            : 'Consumi stabili'}
                                                </span>
                                            </div>
                                            <p className="text-5xl font-bold tracking-tight mb-1">
                                                {diffRounded > 0 ? '+' : ''}{diffRounded}%
                                            </p>
                                            <p className="text-xs font-medium opacity-80 mt-2">
                                                {fmtMc(curTotal)} mc ({periodo}{currentYear}) contro {fmtMc(prevTotal)} mc ({periodo}{prevYear})
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="bg-white dark:bg-[#1A1D23] rounded-[2rem] p-6">
                                            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-400 mb-1">Consumo {periodo}{currentYear}</p>
                                            <p className="text-4xl font-bold tracking-tight text-[#0A2540] dark:text-white flex items-baseline gap-2">
                                                {fmtMc(curTotal)} <span className="text-base font-medium text-slate-400">mc</span>
                                            </p>
                                            <p className="text-xs font-medium text-slate-400 mt-2">
                                                Il confronto con l&apos;anno precedente sarà disponibile con due anni di letture.
                                            </p>
                                        </div>
                                    )}

                                    <div className="bg-white dark:bg-[#1A1D23] rounded-[2rem] p-5 flex gap-3 items-start">
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
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </>
    )
}
