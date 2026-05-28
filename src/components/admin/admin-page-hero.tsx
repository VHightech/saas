'use client'

import { useEffect, useState, ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface AdminPageHeroProps {
    title: ReactNode
    subtitle?: string
    actions?: ReactNode
    topActions?: ReactNode
    backAction?: ReactNode
}
 
export function AdminPageHero({ title, subtitle, actions, topActions, backAction }: AdminPageHeroProps) {
    const [target, setTarget] = useState<HTMLElement | null>(null)
 
    useEffect(() => {
        setTarget(document.getElementById('admin-hero-slot'))
    }, [])
 
    if (!target) return null
 
    return createPortal(
        <div className="w-full space-y-1">
            <div className="flex items-center justify-between w-full min-h-[36px]">
                <div className="shrink-0">{backAction}</div>
                <div className="shrink-0">{topActions}</div>
            </div>
            
            <div className="flex items-end justify-between gap-6 w-full">
                <div className="min-w-0">
                    <h1 className="text-[28px] font-bold tracking-tight text-slate-900 dark:text-white leading-none">
                        {title}
                    </h1>
                </div>
                
                <div className="flex-1 min-w-0">
                    {actions}
                </div>
            </div>
        </div>,
        target
    )
}
