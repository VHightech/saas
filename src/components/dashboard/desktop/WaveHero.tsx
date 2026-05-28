'use client'

import { cn } from '@/lib/utils'

interface WaveHeroProps {
    children: React.ReactNode
    className?: string
}

/**
 * Shared "duocolor + waves" hero card — same visual language as the mobile supply card.
 * Gradient: emerald → indigo blue. Animated waves at bottom, glow blurs in corners.
 */
export function WaveHero({ children, className }: WaveHeroProps) {
    return (
        <div
            className={cn(
                "relative overflow-hidden rounded-[2rem] text-white animate-gradient-shift",
                className
            )}
            style={{ background: 'linear-gradient(135deg, #064E3B 0%, #065F46 50%, #1E5BFF 100%)' }}
        >
            <div className="relative z-10">
                {children}
            </div>
            {/* Decorative layer — glow + animated waves */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[2rem]">
                <div className="absolute -top-12 -left-12 w-64 h-64 rounded-full bg-emerald-400/20 blur-3xl animate-wave-pulse" />
                <div className="absolute -bottom-12 -right-12 w-64 h-64 rounded-full bg-white/10 blur-3xl animate-wave-pulse" style={{ animationDelay: '2.5s' }} />
                <div className="absolute bottom-0 left-0 w-full h-32 overflow-hidden">
                    <div className="absolute bottom-0 left-0 w-[200%] h-full flex animate-wave-slide reverse opacity-15" style={{ animationDuration: '25s' }}>
                        <svg className="w-1/2 h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
                            <path fill="#ffffff" d="M0,160 C240,160 480,60 720,160 C960,260 1200,160 1440,160 L1440,320 L0,320 Z" />
                        </svg>
                        <svg className="w-1/2 h-full -ml-[1px]" viewBox="0 0 1440 320" preserveAspectRatio="none">
                            <path fill="#ffffff" d="M0,160 C240,160 480,60 720,160 C960,260 1200,160 1440,160 L1440,320 L0,320 Z" />
                        </svg>
                    </div>
                    <div className="absolute bottom-0 left-0 w-[200%] h-full flex animate-wave-slide opacity-25" style={{ animationDuration: '18s' }}>
                        <svg className="w-1/2 h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
                            <path fill="#ffffff" d="M0,200 C360,200 480,100 720,200 C960,300 1080,200 1440,200 L1440,320 L0,320 Z" />
                        </svg>
                        <svg className="w-1/2 h-full -ml-[1px]" viewBox="0 0 1440 320" preserveAspectRatio="none">
                            <path fill="#ffffff" d="M0,200 C360,200 480,100 720,200 C960,300 1080,200 1440,200 L1440,320 L0,320 Z" />
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    )
}
