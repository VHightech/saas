'use client'

import { Wallet } from 'lucide-react'

interface BillSummaryCardProps {
    total: number
    unpaidTotal: number
    unpaidCount: number
    currentYear: number
    formatEuro: (n: number) => string
    onDetails?: () => void
    isAll?: boolean
}

export function BillSummaryCard({ total, currentYear, isAll }: BillSummaryCardProps) {
    const formatNumberOnly = (n: number) => n.toFixed(2).replace('.', ',')

    return (
        <div
            className="relative overflow-hidden rounded-3xl text-white px-5 py-4 flex items-center justify-between gap-4 animate-gradient-shift"
            style={{
                background: isAll
                    ? 'linear-gradient(135deg, #0A2540 0%, #1A365D 50%, #1E5BFF 100%)'
                    : 'linear-gradient(135deg, #064E3B 0%, #065F46 50%, #1E5BFF 100%)',
            }}
        >
            <div className="relative z-10 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                    Totale spese {currentYear}
                </p>
                <p className="mt-1.5 flex items-baseline gap-1">
                    <span className="text-base font-bold text-white/70">€</span>
                    <span className="text-[2rem] leading-none font-extrabold tracking-tight tabular-nums">
                        {formatNumberOnly(total)}
                    </span>
                </p>
            </div>

            <div className="relative z-10 w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
                <Wallet size={20} strokeWidth={2} className="text-white/90" />
            </div>

            {/* Ambient atmosphere — kept short so the card stays compact */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-3xl">
                <div className="absolute -top-10 -left-8 w-32 h-32 rounded-full bg-emerald-400/20 blur-3xl animate-wave-pulse" />
                <div className="absolute -bottom-12 -right-8 w-32 h-32 rounded-full bg-white/10 blur-3xl animate-wave-pulse" style={{ animationDelay: '2.5s' }} />
                <div className="absolute bottom-0 left-0 w-full h-12 overflow-hidden opacity-70">
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
