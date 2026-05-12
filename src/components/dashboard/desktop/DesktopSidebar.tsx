'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { LayoutDashboard, FileText, User as UserIcon, LifeBuoy, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface NavEntry {
    key: string
    label: string
    icon: React.ReactNode
    href: string
    match: (pathname: string) => boolean
}

const NAV: NavEntry[] = [
    {
        key: 'dashboard',
        label: 'Dashboard',
        icon: <LayoutDashboard size={18} />,
        href: '/profile',
        match: (p) => p === '/profile' || p === '/profile/',
    },
    {
        key: 'profilo',
        label: 'Profilo',
        icon: <UserIcon size={18} />,
        href: '/profile/info',
        match: (p) => p.startsWith('/profile/info'),
    },
    {
        key: 'supporto',
        label: 'Supporto',
        icon: <LifeBuoy size={18} />,
        href: '/supporto',
        match: (p) => p.startsWith('/supporto'),
    },
]

export function DesktopSidebar() {
    const router = useRouter()
    const pathname = usePathname() || ''
    const supabase = createClient()
    const [expanded, setExpanded] = useState(false)

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.refresh()
        router.push('/login')
    }

    return (
        <aside
            onMouseEnter={() => setExpanded(true)}
            onMouseLeave={() => setExpanded(false)}
            className={cn(
                "hidden lg:flex fixed left-0 top-0 h-screen z-30 flex-col bg-white dark:bg-[#1A1D23] transition-[width] duration-300 ease-out",
                expanded ? "w-60" : "w-20"
            )}
        >
            <div className={cn("pt-6 pb-8 flex items-center gap-3", expanded ? "px-5" : "px-5 justify-center")}>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0A2540] to-[#1E5BFF] flex items-center justify-center shrink-0">
                    <img src="/acq_favicon.ico" alt="" className="w-6 h-6 object-contain" />
                </div>
                {expanded && (
                    <div className="min-w-0 overflow-hidden">
                        <p className="text-[13px] font-extrabold text-[#0A2540] dark:text-white leading-tight whitespace-nowrap">Acquambiente</p>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Marche</p>
                    </div>
                )}
            </div>

            <nav className="flex-1 px-3 space-y-1">
                {NAV.map(item => {
                    const active = item.match(pathname)
                    return (
                        <button
                            key={item.key}
                            onClick={() => router.push(item.href)}
                            title={!expanded ? item.label : undefined}
                            className={cn(
                                "w-full flex items-center rounded-xl transition-colors text-[13px] font-bold h-11",
                                expanded ? "px-4 gap-3" : "justify-center",
                                active
                                    ? "bg-[#0A2540] text-white"
                                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-[#0A2540] dark:hover:text-white"
                            )}
                        >
                            <span className="shrink-0">{item.icon}</span>
                            {expanded && <span className="truncate whitespace-nowrap">{item.label}</span>}
                        </button>
                    )
                })}
            </nav>

            {expanded && (
                <div className="mx-4 mb-4 p-4 rounded-2xl bg-slate-50 dark:bg-white/5">
                    <p className="text-[11px] font-bold text-[#0A2540] dark:text-white mb-1">Serve aiuto?</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Servizio clienti</p>
                    <p className="text-[12px] font-bold text-[#1E5BFF] mt-1">800-123-456</p>
                </div>
            )}

            <button
                onClick={handleLogout}
                title={!expanded ? 'Esci' : undefined}
                className={cn(
                    "mx-3 mb-4 h-11 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 text-[13px] font-bold flex items-center transition-colors hover:bg-red-500/15",
                    expanded ? "px-4 gap-3" : "justify-center"
                )}
            >
                <LogOut size={18} className="shrink-0" />
                {expanded && <span className="truncate whitespace-nowrap">Esci</span>}
            </button>
        </aside>
    )
}
