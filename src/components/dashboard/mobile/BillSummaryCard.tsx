'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface BillSummaryCardProps {
    total: number
    unpaidTotal: number
    unpaidCount: number
    currentYear: number
    formatEuro: (n: number) => string
    onDetails?: () => void
    isAll?: boolean
}

export function BillSummaryCard({ 
    total, 
    unpaidTotal, 
    unpaidCount, 
    currentYear, 
    formatEuro,
    onDetails,
    isAll
}: BillSummaryCardProps) {
    const formatNumberOnly = (n: number) => {
        return n.toFixed(2).replace('.', ',')
    }

    return (
        <div 
            className="relative overflow-hidden rounded-[2.25rem] text-white p-6 aspect-[1.6/1] min-h-[200px] flex flex-col justify-between animate-gradient-shift"
            style={{ 
                background: isAll 
                    ? 'linear-gradient(135deg, #0A2540 0%, #1A365D 50%, #1E5BFF 100%)'
                    : 'linear-gradient(135deg, #064E3B 0%, #065F46 50%, #1E5BFF 100%)' 
            }}
        >
            <div className="relative z-10 flex-1 flex flex-col justify-between h-full">
                {/* Top Row: Title */}
                <div className="flex justify-between items-center">
                    <span className="text-[16px] font-black uppercase tracking-[0.1em] text-white/90">
                        Totale Spese
                    </span>
                </div>

                {/* Middle Row: Amount with Currency sign split */}
                <div className="my-auto pt-2 flex items-center gap-1.5">
                    <span className="text-3xl font-extrabold opacity-70">€</span>
                    <span className="text-4xl font-extrabold tracking-tight">{formatNumberOnly(total)}</span>
                </div>

                {/* Bottom Row: Unpaid Status/Summary */}
                <div className="pt-3 border-t border-white/10">
                    <div className="w-full bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-2.5 flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-white/70">
                            Da pagare ({unpaidCount})
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="text-[12px] font-bold opacity-60">€</span>
                            <span className="text-[16px] font-black text-white tracking-tight">{formatNumberOnly(unpaidTotal)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Premium Animations */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[2.25rem]">
                <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-emerald-400/20 blur-3xl animate-wave-pulse" />
                <div className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl animate-wave-pulse" style={{ animationDelay: '2.5s' }} />
                <div className="absolute bottom-0 left-0 w-full h-24 overflow-hidden">
                    <div className="absolute bottom-0 left-0 w-[200%] h-full flex animate-wave-slide reverse opacity-15" style={{ animationDuration: '25s' }}>
                        <svg className="w-1/2 h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
                            <path fill="#ffffff" d="M0,160 C240,160 480,60 720,160 C960,260 1200,160 1440,160 L1440,320 L0,320 Z" />
                        </svg>
                        <svg className="w-1/2 h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
                            <path fill="#ffffff" d="M0,160 C240,160 480,60 720,160 C960,260 1200,160 1440,160 L1440,320 L0,320 Z" />
                        </svg>
                    </div>
                    <div className="absolute bottom-0 left-0 w-[200%] h-full flex animate-wave-slide opacity-25" style={{ animationDuration: '18s' }}>
                        <svg className="w-1/2 h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
                            <path fill="#ffffff" d="M0,200 C360,200 480,100 720,200 C960,300 1080,200 1440,200 L1440,320 L0,320 Z" />
                        </svg>
                        <svg className="w-1/2 h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
                            <path fill="#ffffff" d="M0,200 C360,200 480,100 720,200 C960,300 1080,200 1440,200 L1440,320 L0,320 Z" />
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    )
}
