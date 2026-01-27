'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MobileCollapsibleCardProps {
    title: string | React.ReactNode
    children: React.ReactNode
    headerContent?: React.ReactNode
    className?: string
    defaultOpen?: boolean
}

export function MobileCollapsibleCard({
    title,
    children,
    headerContent,
    className,
    defaultOpen = false
}: MobileCollapsibleCardProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen)

    return (
        <div className={cn("flex flex-col bg-white/60 dark:bg-[#1e1e1e]/60 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-3xl shadow-sm md:bg-transparent md:border-none md:shadow-none md:rounded-none", className)}>
            {/* Mobile Header (Accordion Trigger - Integrated) */}

            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "md:hidden flex flex-col w-full p-4 z-20 relative transition-all",
                    /* Removed bg and borders to let parent container handle shape */
                )}
            >
                <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-slate-800 dark:text-white text-lg w-full text-left">{title}</span>
                    {isOpen ? <ChevronUp className="w-5 h-5 text-slate-500 dark:text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-500 dark:text-slate-400" />}
                </div>
                {!isOpen && headerContent && (
                    <div className="w-full mt-2 text-left animate-in fade-in slide-in-from-top-1 duration-200">
                        {headerContent}
                    </div>
                )}
            </button>

            {/* Content - Hidden on mobile if closed, always visible on desktop */}
            <div className={cn(
                "transition-all duration-300 ease-in-out md:block overflow-visible md:h-full",
                isOpen ? "block animate-in slide-in-from-top-2 duration-300" : "hidden"
            )}>
                <div className="p-4 pt-0 md:p-0 md:h-full">
                    {children}
                </div>
            </div>
        </div>
    )
}
