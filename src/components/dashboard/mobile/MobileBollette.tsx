'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Bill } from '@/types/dashboard'
import { BillSummaryCard } from './BillSummaryCard'
import { BillListItem } from './BillListItem'
import { useDashboard } from '@/components/dashboard/dashboard-context'

type FilterType = 'all' | 'unpaid' | 'paid'

interface MobileBolletteProps {
    bills: Bill[]
    supplies?: any[]
    onSelectBill: (bill: Bill) => void
    onBack: () => void
}

export function MobileBollette({ bills, supplies = [], onSelectBill, onBack }: MobileBolletteProps) {
    const [filter, setFilter] = useState<FilterType>('all')
    const [supplyMenuOpen, setSupplyMenuOpen] = useState(false)
    const { selectedSupply, setSelectedSupply } = useDashboard()

    // Close menu on outside click / Esc
    useEffect(() => {
        if (!supplyMenuOpen) return
        const onDoc = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            if (!target.closest('[data-supply-menu]')) setSupplyMenuOpen(false)
        }
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSupplyMenuOpen(false) }
        document.addEventListener('click', onDoc)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('click', onDoc)
            document.removeEventListener('keydown', onKey)
        }
    }, [supplyMenuOpen])

    const activeSupplyLabel = useMemo(() => {
        if (selectedSupply === 'all') return 'Tutte'
        const s = supplies.find((x: any) => x?.ulm === selectedSupply)
        return s?.address || s?.city || s?.ulm || 'Tutte'
    }, [selectedSupply, supplies])

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
        const filtered = sorted.filter((b: any) => {
            if (filter === 'all') return true
            if (filter === 'unpaid') return (b.status || 'unpaid') !== 'paid'
            return b.status === 'paid'
        })

        const groups: { year: number; bills: Bill[] }[] = []
        filtered.forEach(bill => {
            const year = new Date(bill.data_emissione).getFullYear()
            let group = groups.find(g => g.year === year)
            if (!group) {
                group = { year, bills: [] }
                groups.push(group)
            }
            group.bills.push(bill)
        })
        return groups
    }, [bills, filter])

    const monthYear = (date: string) => {
        const d = new Date(date)
        return d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
    }
    
    const formatEuro = (n: number) => `${n.toFixed(2).replace('.', ',')} €`

    return (
        <div className="fixed inset-0 z-40 bg-[#F8FAFC] dark:bg-[#0F1115] flex flex-col pb-[env(safe-area-inset-bottom)]">
            {/* Fixed Top Section */}
            <div className="px-5 pt-4 pb-4 bg-[#F8FAFC] dark:bg-[#0F1115] shrink-0 space-y-6">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="w-12 h-12 rounded-full bg-white dark:bg-white/5 flex items-center justify-center text-[#0A2540] dark:text-white active:scale-90 transition-transform shrink-0"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <p className="text-xl font-bold text-[#0A2540] dark:text-white shrink-0">Le tue Bollette</p>

                    {/* Supply selector — dropdown, top-right */}
                    {supplies.length > 1 && (
                        <div className="ml-auto relative" data-supply-menu>
                            <button
                                onClick={(e) => { e.stopPropagation(); setSupplyMenuOpen(o => !o) }}
                                className={cn(
                                    'flex items-center justify-between gap-2 w-[220px] px-4 py-2.5 rounded-full text-[12px] font-bold whitespace-nowrap transition-all active:scale-95',
                                    selectedSupply !== 'all'
                                        ? 'bg-[#1E5BFF] text-white dark:bg-[#93C5FD] dark:text-[#0A2540]'
                                        : 'bg-white dark:bg-white/5 text-[#0A2540] dark:text-white'
                                )}
                            >
                                <span className="truncate">{activeSupplyLabel}</span>
                                <ChevronDown
                                    size={16}
                                    className={cn('shrink-0 transition-transform duration-200', supplyMenuOpen && 'rotate-180')}
                                />
                            </button>

                            {supplyMenuOpen && (
                                <div className="absolute right-0 top-full mt-2 min-w-[220px] max-w-[280px] bg-white dark:bg-[#1A1D23] rounded-2xl shadow-[0_8px_24px_rgba(15,23,42,0.12)] border border-slate-100 dark:border-white/5 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                                    <button
                                        onClick={() => { setSelectedSupply('all'); setSupplyMenuOpen(false) }}
                                        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left text-[12px] font-bold text-[#0A2540] dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                                    >
                                        <span>Tutte le forniture</span>
                                        {selectedSupply === 'all' && <Check size={14} className="text-[#1E5BFF] dark:text-[#93C5FD] shrink-0" />}
                                    </button>
                                    <div className="h-px bg-slate-100 dark:bg-white/5" />
                                    {supplies.map((s: any, i) => {
                                        const ulm = s?.ulm
                                        if (!ulm) return null
                                        const isActive = selectedSupply === ulm
                                        const label = s.address || s.city || ulm
                                        return (
                                            <button
                                                key={`supply-menu-${i}`}
                                                onClick={() => { setSelectedSupply(ulm); setSupplyMenuOpen(false) }}
                                                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[12px] font-bold text-[#0A2540] dark:text-white truncate">{label}</p>
                                                    {s.city && s.address && (
                                                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{s.city}</p>
                                                    )}
                                                </div>
                                                {isActive && <Check size={14} className="text-[#1E5BFF] dark:text-[#93C5FD] shrink-0" />}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <BillSummaryCard
                    total={stats.total}
                    unpaidTotal={stats.unpaidTotal}
                    unpaidCount={stats.unpaidCount}
                    currentYear={stats.currentYear}
                    formatEuro={formatEuro}
                />

                {/* Flat Filter Tabs */}
                <div className="flex gap-2 p-1 bg-white dark:bg-white/5 rounded-[1.25rem]">
                    {(['all', 'unpaid', 'paid'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={cn(
                                'flex-1 py-3 rounded-xl text-[11px] font-black transition-all active:scale-95',
                                filter === f 
                                    ? 'bg-[#1E5BFF] text-white dark:bg-[#93C5FD] dark:text-[#0A2540]'
                                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                            )}
                        >
                            {f === 'all' ? 'Tutte' : f === 'unpaid' ? 'Da pagare' : 'Pagate'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Scrollable List Area */}
            <div className="flex-1 overflow-y-auto px-5 pb-32 flex flex-col">
                {groupedBills.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                        <p className="text-[11px] font-black uppercase tracking-[0.6em] text-slate-300 dark:text-slate-700">
                            Nessun Risultato
                        </p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {groupedBills.map(group => (
                            <div key={group.year} className="space-y-4">
                                <h4 className="px-1 text-[13px] font-black text-[#0A2540] dark:text-white uppercase tracking-widest flex items-center gap-3">
                                    {group.year}
                                    <div className="flex-1 h-px bg-slate-200 dark:bg-white/5" />
                                </h4>
                                
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
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
