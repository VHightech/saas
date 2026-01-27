'use client'

import { ArrowUpRight, ArrowDownLeft, Wallet } from 'lucide-react'

export function OverviewCard() {
    return (
        <div className="glass-heavy rounded-3xl p-6 relative overflow-hidden h-full flex flex-col justify-between">
            <div>
                <h3 className="text-slate-500 dark:text-slate-400 font-medium text-sm mb-1">Totale da Pagare</h3>
                <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-slate-800 dark:text-white">€31.180<span className="text-2xl text-slate-400">,24</span></span>
                </div>
            </div>

            <div className="flex gap-4 mt-6">
                <button className="flex-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3 rounded-full font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-lg">
                    <div className="bg-white/20 dark:bg-slate-900/10 p-1 rounded-full">
                        <ArrowUpRight size={16} />
                    </div>
                    Paga Ora
                </button>
                <button className="flex-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-white py-3 rounded-full font-semibold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700">
                    <div className="bg-slate-100 dark:bg-slate-700 p-1 rounded-full">
                        <ArrowDownLeft size={16} />
                    </div>
                    Storico
                </button>
            </div>
        </div>
    )
}
