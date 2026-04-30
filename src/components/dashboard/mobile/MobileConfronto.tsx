'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, Lightbulb, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Bill } from '@/types/dashboard'

// Removed Mode type as we only use real historical data now

interface MobileConfrontoProps {
    bills: Bill[]
    onBack: () => void
    
}

const MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

export function MobileConfronto({ bills = [], onBack }: MobileConfrontoProps) {

    // Build user's last 12 months of consumption (aligned by calendar month)
    const { userByMonth, totalUser, totalCompare, compareLabel, compareByMonth, hasYearData } = useMemo(() => {
        const now = new Date()
        const currentYear = now.getFullYear()
        const lastYear = currentYear - 1

        const sumByMonth = (year: number) => {
            const arr = new Array(12).fill(0)
            bills.forEach((b: any) => {
                const d = new Date(b.data_emissione)
                if (d.getFullYear() === year) arr[d.getMonth()] += Number(b.consumo || 0)
            })
            return arr
        }

        const user = sumByMonth(currentYear)
        const totalUser = user.reduce((a, b) => a + b, 0)
        
        const prev = sumByMonth(lastYear)
        const totalPrev = prev.reduce((a, b) => a + b, 0)
        
        return {
            userByMonth: user,
            compareByMonth: prev,
            totalUser,
            totalCompare: totalPrev,
            compareLabel: 'Anno scorso',
            hasYearData: totalPrev > 0,
        }
    }, [bills])

    const diffPct = totalCompare > 0 ? ((totalUser - totalCompare) / totalCompare) * 100 : 0
    const isLess = diffPct < 0
    const max = Math.max(...userByMonth, ...compareByMonth, 1)

    return (
        <div className="px-5 pt-4 pb-6 space-y-5">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <button onClick={onBack} className="w-12 h-12 rounded-full bg-white dark:bg-white/5 flex items-center justify-center text-[#0A2540] dark:text-white shrink-0 active:scale-90 transition-transform">
                        <ChevronLeft size={24} />
                    </button>
                    <p className="text-xl font-bold text-[#0A2540] dark:text-white">Confronto consumi</p>
                    <div className="w-12" />
                </div>
            </div>



            {/* Hero stat */}
            {totalUser === 0 || !hasYearData ? (
                <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-6 text-center text-sm text-slate-400 font-medium">
                    Dati non sufficienti per il confronto
                </div>
            ) : (
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
                        {diffPct > 0 ? '+' : ''}{diffPct.toFixed(0)}% <span className="text-base font-bold opacity-80">{compareLabel.toLowerCase()}</span>
                    </p>
                    <p className="text-xs font-medium opacity-80 mt-2">
                        {totalUser.toFixed(0)} mc contro {totalCompare.toFixed(0)} mc · 12 mesi
                    </p>
                </div>
            )}

            {/* Chart */}
            <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-5">
                <p className="text-sm font-bold text-[#0A2540] dark:text-white mb-4">Andamento 12 mesi</p>

                <div className="relative h-44 flex items-end justify-between gap-1.5">
                    {userByMonth.map((value, i) => {
                        const userPct = (value / max) * 100
                        return (
                            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                                <div
                                    className="w-full rounded-t bg-gradient-to-t from-[#1E5BFF] to-[#60A5FA]"
                                    style={{ height: `${Math.max(userPct, 2)}%` }}
                                />
                            </div>
                        )
                    })}

                    {/* Comparison line overlay */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
                        <polyline
                            fill="none"
                            stroke="#E89B3C"
                            strokeWidth="1"
                            strokeDasharray="2 2"
                            vectorEffect="non-scaling-stroke"
                            points={compareByMonth.map((v, i) => {
                                const x = (i + 0.5) * (100 / 12)
                                const y = 100 - (v / max) * 100
                                return `${x},${y}`
                            }).join(' ')}
                        />
                        {compareByMonth.map((v, i) => {
                            const x = (i + 0.5) * (100 / 12)
                            const y = 100 - (v / max) * 100
                            return <circle key={i} cx={x} cy={y} r="1.2" fill="#E89B3C" vectorEffect="non-scaling-stroke" />
                        })}
                    </svg>
                </div>

                <div className="flex justify-between gap-1 mt-2">
                    {MONTHS.map((m) => (
                        <span key={m} className="flex-1 text-center text-[9px] font-bold text-slate-400">{m}</span>
                    ))}
                </div>

                <div className="flex items-center gap-4 mt-4 pt-3">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-t from-[#1E5BFF] to-[#60A5FA]" />
                        <span className="text-[11px] font-bold text-slate-500">Tu</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-0.5 bg-[#E89B3C]" style={{ borderTop: '2px dotted #E89B3C', background: 'none' }} />
                        <span className="text-[11px] font-bold text-slate-500">{compareLabel}</span>
                    </div>
                </div>
            </div>

            {/* Consiglio */}
            {hasYearData && totalUser > 0 && (
                <div className="bg-[#F8FAFC] dark:bg-white/5 rounded-2xl p-4 flex gap-3 items-start">
                    <div className="w-9 h-9 rounded-xl bg-[#1E5BFF]/10 text-[#1E5BFF] flex items-center justify-center shrink-0">
                        <Lightbulb size={18} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-[#0A2540] dark:text-white">Analisi dei Consumi</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed mt-0.5">
                            {(() => {
                                if (diffPct < -15) {
                                    return `Ottimo lavoro! Stai consumando il ${Math.abs(diffPct).toFixed(0)}% in meno rispetto all'anno scorso. Le tue abitudini stanno portando un risparmio concreto.`
                                } else if (diffPct > 15) {
                                    return `Attenzione: i tuoi consumi sono aumentati del ${diffPct.toFixed(0)}%. Ti consigliamo di verificare eventuali perdite occulte o picchi anomali di utilizzo.`
                                } else if (diffPct > 0) {
                                    return `I tuoi consumi sono leggermente superiori (+${diffPct.toFixed(0)}%) rispetto al periodo precedente. Monitora l'andamento nei prossimi mesi per stabilizzarli.`
                                } else {
                                    return `Consumi stabili: sei in linea con il tuo storico dell'anno scorso. Piccoli accorgimenti quotidiani potrebbero aiutarti a ridurre ulteriormente la spesa.`
                                }
                            })()}
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
