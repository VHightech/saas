'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, FileText, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatEuro, monthYear } from '@/lib/format'
import type { Bill } from '@/types/dashboard'
import { BillSummaryCard } from './BillSummaryCard'
import { BillListItem } from './BillListItem'
import { useDashboard } from '@/components/dashboard/dashboard-context'

interface MobileBolletteProps {
    bills: Bill[]
    supplies?: any[]
    onSelectBill: (bill: Bill) => void
    onBack: () => void
}

export function MobileBollette({ bills, supplies = [], onSelectBill, onBack }: MobileBolletteProps) {
    const [collapsedYears, setCollapsedYears] = useState<Record<number, boolean>>({})
    const { selectedSupply, setSelectedSupply } = useDashboard()
    const toggleYear = (year: number) =>
        setCollapsedYears(prev => ({ ...prev, [year]: !prev[year] }))

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'auto' })
        document.scrollingElement?.scrollTo({ top: 0, behavior: 'auto' })
    }, [])

    const stats = useMemo(() => {
        const currentYear = new Date().getFullYear()
        const yearBills = bills.filter(b => new Date(b.data_emissione).getFullYear() === currentYear)
        const total = yearBills.reduce((acc, b) => acc + Number(b.importo || 0), 0)
        const unpaidTotal = bills.filter(b => (b.status || 'unpaid') !== 'paid').reduce((acc, b) => acc + Number(b.importo || 0), 0)
        const unpaidCount = bills.filter(b => (b.status || 'unpaid') !== 'paid').length

        return { total, unpaidTotal, unpaidCount, currentYear }
    }, [bills])

    const groupedBills = useMemo(() => {
        // Local supply filter: when a concrete supply is selected, only show its bills.
        // 'all' shows every registered supply's bills (and only those — not unregistered ULMs).
        const knownUlms = new Set(supplies.map((s: any) => s?.ulm).filter(Boolean))
        const supplyFiltered = bills.filter((b: any) => {
            if (selectedSupply === 'all') return knownUlms.size === 0 || knownUlms.has(b.ulm)
            return b.ulm === selectedSupply
        })

        const sorted = supplyFiltered.sort((a, b) => new Date(b.data_emissione).getTime() - new Date(a.data_emissione).getTime())

        const groups: { year: number; bills: Bill[] }[] = []
        sorted.forEach(bill => {
            const year = new Date(bill.data_emissione).getFullYear()
            let group = groups.find(g => g.year === year)
            if (!group) {
                group = { year, bills: [] }
                groups.push(group)
            }
            group.bills.push(bill)
        })
        return groups
    }, [bills, supplies, selectedSupply])


    return (
        <div className="fixed inset-0 z-40 bg-[#F8FAFC] dark:bg-[#0F1115] flex flex-col pb-[env(safe-area-inset-bottom)]">
            {/* Fixed Top Section */}
            <div className="px-5 pt-4 pb-4 bg-[#F8FAFC] dark:bg-[#0F1115] shrink-0 space-y-4">
                <div className="relative flex items-center justify-center min-h-[48px]">
                    <button
                        onClick={onBack}
                        className="absolute left-0 w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-[#0A2540] dark:text-white active:scale-90 transition-transform shrink-0"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <p className="text-xl font-black text-[#0A2540] dark:text-white text-center">Le tue Bollette</p>
                </div>

                {/* Horizontal scrolling supply pills */}
                {supplies.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden -mx-5 px-5 py-1">
                        <button
                            onClick={() => setSelectedSupply('all')}
                            className={cn(
                                'px-4 py-2 rounded-full text-[12px] font-bold tracking-wide transition-all whitespace-nowrap active:scale-95 border shrink-0',
                                selectedSupply === 'all'
                                    ? 'bg-[#1E5BFF] text-white border-transparent shadow-sm'
                                    : 'bg-white dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/5'
                            )}
                        >
                            Tutte le forniture
                        </button>
                        {supplies.map((s: any, i) => {
                            const ulm = s?.ulm
                            if (!ulm) return null
                            const isActive = selectedSupply === ulm
                            const label = s.address || s.city || ulm
                            return (
                                <button
                                    key={`supply-pill-${i}`}
                                    onClick={() => setSelectedSupply(ulm)}
                                    className={cn(
                                        'px-4 py-2 rounded-full text-[12px] font-bold tracking-wide transition-all whitespace-nowrap active:scale-95 border shrink-0',
                                        isActive
                                            ? 'bg-[#1E5BFF] text-white border-transparent shadow-sm'
                                            : 'bg-white dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/5'
                                    )}
                                >
                                    {label}
                                </button>
                            )
                        })}
                    </div>
                )}

                <BillSummaryCard
                    total={stats.total}
                    unpaidTotal={stats.unpaidTotal}
                    unpaidCount={stats.unpaidCount}
                    currentYear={stats.currentYear}
                    formatEuro={formatEuro}
                    isAll={selectedSupply === 'all'}
                />
            </div>

            {/* Scrollable List Area */}
            <div className="flex-1 overflow-y-auto px-5 pb-32 flex flex-col">
                {groupedBills.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center pb-12 px-8 text-center">
                        <div className="w-16 h-16 rounded-[1.25rem] bg-white dark:bg-white/5 flex items-center justify-center mb-5 shadow-[0_8px_16px_rgba(15,23,42,0.04)]">
                            <FileText size={28} className="text-slate-400 dark:text-slate-500" strokeWidth={1.5} />
                        </div>
                        <p className="text-[15px] font-bold text-[#0A2540] dark:text-white mb-1.5">
                            Nessuna bolletta trovata
                        </p>
                        <p className="text-[13px] text-slate-400 leading-relaxed">
                            Non ci sono documenti che corrispondono ai filtri selezionati.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {groupedBills.map(group => {
                            const isCollapsed = !!collapsedYears[group.year]
                            return (
                                <div key={group.year} className="space-y-3">
                                    <button
                                        onClick={() => toggleYear(group.year)}
                                        className="w-full px-1 py-2 flex items-center gap-3 active:opacity-70 transition-opacity"
                                    >
                                        <ChevronDown
                                            size={16}
                                            className={cn(
                                                "text-[#0A2540] dark:text-white transition-transform duration-200 shrink-0",
                                                isCollapsed && "-rotate-90"
                                            )}
                                            strokeWidth={2.5}
                                        />
                                        <span className="text-[13px] font-black text-[#0A2540] dark:text-white uppercase tracking-widest">
                                            {group.year}
                                        </span>
                                        <div className="flex-1 h-px bg-slate-200 dark:bg-white/5" />
                                        <span className="shrink-0 min-w-[24px] h-6 px-1.5 rounded-md bg-[#93C5FD]/30 dark:bg-[#93C5FD]/20 text-[#1E5BFF] dark:text-[#93C5FD] text-[11px] font-mono font-bold flex items-center justify-center">
                                            {group.bills.length}
                                        </span>
                                    </button>

                                    {!isCollapsed && (
                                        <div className="bg-white dark:bg-[#1A1D23] rounded-[2rem] overflow-hidden">
                                            {group.bills.map((bill: any) => (
                                                <BillListItem
                                                    key={bill.id}
                                                    bill={bill}
                                                    onSelect={onSelectBill}
                                                    monthYear={monthYear}
                                                    formatEuro={formatEuro}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

        </div>
    )
}
