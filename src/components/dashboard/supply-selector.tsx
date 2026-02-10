'use client'

import React from 'react'
import { MapPin, ChevronDown } from 'lucide-react'
import { useDashboard } from '@/components/dashboard/dashboard-context'
import { cn } from '@/lib/utils'

export function SupplySelector() {
    const { supplies, selectedSupply, setSelectedSupply } = useDashboard()

    // Custom Dropdown implementation
    const [isOpen, setIsOpen] = React.useState(false)
    const dropdownRef = React.useRef<HTMLDivElement>(null)

    // Close on click outside
    React.useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    if (supplies.length <= 1) return null

    return (
        <div className="relative hidden md:block mr-2" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center gap-3 px-3 py-1.5 rounded-full shadow-sm border transition-all duration-200 outline-none focus:ring-2 focus:ring-indigo-500/20",
                    "bg-white/50 dark:bg-white/5 backdrop-blur-md border-white/20 dark:border-white/10",
                    "hover:bg-white/80 dark:hover:bg-white/10",
                    isOpen && "ring-2 ring-indigo-500/20 bg-white/90 dark:bg-white/15"
                )}
            >
                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <MapPin size={16} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col pr-2 text-left">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-none mb-0.5 uppercase tracking-wide">
                        Seleziona Utenza
                    </span>
                    <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-none truncate max-w-[120px]">
                            {selectedSupply === 'all' ? 'Tutte le Utenze' : `${selectedSupply}`}
                        </span>
                        <ChevronDown size={12} className={cn("opacity-50 transition-transform", isOpen && "rotate-180")} />
                    </div>
                </div>
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-2 z-[100] animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Le tue forniture
                        </p>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto">
                        <button
                            onClick={() => {
                                setSelectedSupply('all')
                                setIsOpen(false)
                            }}
                            className={cn(
                                "w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between",
                                selectedSupply === 'all'
                                    ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-medium"
                                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
                            )}
                        >
                            <span>Tutte le Utenze</span>
                            {selectedSupply === 'all' && (
                                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                            )}
                        </button>

                        {supplies.map(ulm => (
                            <button
                                key={ulm}
                                onClick={() => {
                                    setSelectedSupply(ulm)
                                    setIsOpen(false)
                                }}
                                className={cn(
                                    "w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between",
                                    selectedSupply === ulm
                                        ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-medium"
                                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
                                )}
                            >
                                <div className="flex flex-col">
                                    <span>Fornitura {ulm}</span>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">Codice: {ulm}</span>
                                </div>
                                {selectedSupply === ulm && (
                                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
