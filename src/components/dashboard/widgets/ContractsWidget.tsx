'use client'

import { Droplets, Zap, Flame, Plus } from 'lucide-react'

const contracts = [
    {
        id: 1,
        type: 'Acqua',
        provider: 'Acqua Latina',
        number: '**** **** 4455',
        holder: 'Mario Rossi',
        color: 'from-blue-400 to-blue-600',
        icon: Droplets
    },
    {
        id: 2,
        type: 'Luce',
        provider: 'Enel Energia',
        number: '**** **** 1599',
        holder: 'Mario Rossi',
        color: 'from-emerald-400 to-emerald-600',
        icon: Zap
    }
]

export function ContractsWidget() {
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-800 dark:text-white">Le Tue Utenze</h3>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar snap-x">
                {contracts.map((contract) => (
                    <div
                        key={contract.id}
                        className={`min-w-[280px] h-[160px] rounded-3xl p-5 bg-gradient-to-br ${contract.color} text-white relative shadow-lg snap-center flex flex-col justify-between group cursor-pointer hover:shadow-xl transition-all`}
                    >
                        <div className="flex justify-between items-start">
                            <span className="bg-white/20 backdrop-blur-md px-2 py-1 rounded text-xs font-semibold">{contract.provider}</span>
                            <contract.icon className="text-white/80" />
                        </div>

                        <div>
                            <div className="text-lg font-mono tracking-wider mb-1">{contract.number}</div>
                            <div className="text-xs opacity-80 uppercase">{contract.holder}</div>
                        </div>

                        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-colors" />
                    </div>
                ))}

                <button className="min-w-[60px] h-[160px] rounded-3xl bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors shadow-lg">
                    <Plus size={24} />
                </button>
            </div>
        </div>
    )
}
