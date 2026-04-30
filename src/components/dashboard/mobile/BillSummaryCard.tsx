'use client'

import React from 'react'
import { Euro, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BillSummaryCardProps {
    total: number
    unpaidTotal: number
    unpaidCount: number
    currentYear: number
    formatEuro: (n: number) => string
    onDetails?: () => void
}

export function BillSummaryCard({ 
    total, 
    unpaidTotal, 
    unpaidCount, 
    currentYear, 
    formatEuro,
    onDetails 
}: BillSummaryCardProps) {
    return (
        <div 
            className="relative overflow-hidden rounded-[2rem] text-white p-6 animate-gradient-shift"
            style={{ background: 'linear-gradient(135deg, #064E3B 0%, #065F46 50%, #1E5BFF 100%)' }}
        >
            <div className="flex justify-between items-start mb-6 relative z-10">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-200/60 mb-1">
                        Totale Spese {currentYear}
                    </p>
                    <h3 className="text-3xl font-bold tracking-tighter">{formatEuro(total)}</h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <Euro size={20} className="text-[#C6F36B]" />
                </div>
            </div>

            <div className="pt-4 border-t border-white/10 relative z-10">
                <div className="w-full bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-3 flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                        Da pagare ({unpaidCount})
                    </p>
                    <p className="text-[16px] font-black text-white tracking-tight">{formatEuro(unpaidTotal)}</p>
                </div>
            </div>

            {/* Premium Animations */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[2rem]">
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
