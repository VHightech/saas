'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, Check, FileText, ChevronDown } from 'lucide-react'
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
    const [collapsedYears, setCollapsedYears] = useState<Record<number, boolean>>({})
    const { selectedSupply, setSelectedSupply } = useDashboard()
    const toggleYear = (year: number) =>
        setCollapsedYears(prev => ({ ...prev, [year]: !prev[year] }))

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
                        className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-[#0A2540] dark:text-white active:scale-90 transition-transform shrink-0"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <p className="text-xl font-bold text-[#0A2540] dark:text-white shrink-0">Le tue Bollette</p>

                    {/* Supply selector — iOS 26 Liquid Glass popover */}
                    {supplies.length > 1 && (
                        <div className="ml-auto relative" data-supply-menu>
                            <button
                                onClick={(e) => { e.stopPropagation(); setSupplyMenuOpen(o => !o) }}
                                className={cn(
                                    'relative w-12 h-12 rounded-full flex items-center justify-center active:scale-90 transition-all shrink-0',
                                    selectedSupply !== 'all'
                                        ? 'bg-[#1E5BFF] text-white dark:bg-[#93C5FD] dark:text-[#0A2540]'
                                        : 'bg-white dark:bg-white/5 text-[#0A2540] dark:text-white'
                                )}
                                aria-label="Seleziona fornitura"
                            >
                                <FileText size={20} />
                                {selectedSupply !== 'all' && (
                                    <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#F8FAFC] dark:ring-[#0F1115]" />
                                )}
                            </button>

                            {supplyMenuOpen && (
                                <>
                                    {/* Invisible click-catcher */}
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setSupplyMenuOpen(false)}
                                    />
                                    {/* Liquid Glass popover — iOS 26 style */}
                                    <div
                                        className="absolute right-0 top-full mt-2 w-[290px] origin-top-right z-50 rounded-[28px] overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200 ease-out"
                                        style={{
                                            background: 'rgba(255,255,255,0.55)',
                                            backdropFilter: 'blur(50px) saturate(200%)',
                                            WebkitBackdropFilter: 'blur(50px) saturate(200%)',
                                            boxShadow: '0 30px 80px -20px rgba(15,23,42,0.4), 0 12px 32px -10px rgba(15,23,42,0.22), inset 0 1px 0 0 rgba(255,255,255,0.7), inset 0 -1px 0 0 rgba(15,23,42,0.05)',
                                        }}
                                    >
                                        <div className="dark:bg-[#1C1C1E]/50 relative">
                                            {/* Soft inner sheen across the top — fakes the liquid-glass refraction */}
                                            <div
                                                className="pointer-events-none absolute inset-x-0 top-0 h-12 opacity-70"
                                                style={{
                                                    background: 'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 100%)',
                                                }}
                                            />
                                            {/* Diagonal highlight streak — subtle prism */}
                                            <div
                                                className="pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay"
                                                style={{
                                                    background: 'linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 35%, rgba(255,255,255,0) 65%, rgba(255,255,255,0.3) 100%)',
                                                }}
                                            />

                                            <div className="relative px-2 py-2 max-h-[60vh] overflow-y-auto">
                                                <button
                                                    onClick={() => { setSelectedSupply('all'); setSupplyMenuOpen(false) }}
                                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left active:bg-black/10 dark:active:bg-white/10 transition-colors"
                                                >
                                                    <div className="w-9 h-9 rounded-xl bg-[#0A2540]/8 dark:bg-white/10 flex items-center justify-center shrink-0">
                                                        <FileText size={16} strokeWidth={2} className="text-[#0A2540] dark:text-white" />
                                                    </div>
                                                    <span className="flex-1 text-[16px] font-semibold text-[#0A2540] dark:text-white tracking-tight">Tutte le forniture</span>
                                                    {selectedSupply === 'all' && <Check size={18} className="text-[#1E5BFF] dark:text-[#93C5FD] shrink-0" strokeWidth={2.5} />}
                                                </button>

                                                {/* Section divider — iOS-style hairline with extra breathing room */}
                                                <div className="my-1.5 h-px bg-slate-900/10 dark:bg-white/10 mx-3" />

                                                {supplies.map((s: any, i) => {
                                                    const ulm = s?.ulm
                                                    if (!ulm) return null
                                                    const isActive = selectedSupply === ulm
                                                    const label = s.address || s.city || ulm
                                                    return (
                                                        <button
                                                            key={`supply-popover-${i}`}
                                                            onClick={() => { setSelectedSupply(ulm); setSupplyMenuOpen(false) }}
                                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left active:bg-black/10 dark:active:bg-white/10 transition-colors"
                                                        >
                                                            <div className={cn(
                                                                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                                                                isActive
                                                                    ? "bg-[#1E5BFF] text-white dark:bg-[#93C5FD] dark:text-[#0A2540]"
                                                                    : "bg-[#0A2540]/8 text-[#0A2540] dark:bg-white/10 dark:text-white"
                                                            )}>
                                                                <FileText size={16} strokeWidth={2} />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-[15px] font-semibold text-[#0A2540] dark:text-white truncate leading-tight tracking-tight">{label}</p>
                                                                {s.city && s.address && (
                                                                    <p className="text-[12px] text-slate-500 dark:text-slate-400 truncate leading-tight mt-0.5">{s.city}</p>
                                                                )}
                                                            </div>
                                                            {isActive && <Check size={18} className="text-[#1E5BFF] dark:text-[#93C5FD] shrink-0" strokeWidth={2.5} />}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </>
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
                                'flex-1 py-3 rounded-xl text-[11px] font-medium transition-all active:scale-95',
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
                                        className="w-[calc(100%+24px)] -mx-3 sticky top-0 z-10 px-3 py-3 flex items-center gap-3 bg-[#F8FAFC] dark:bg-[#0F1115] active:opacity-70 transition-opacity"
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
