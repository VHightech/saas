'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { LayoutDashboard, BarChart3, User as UserIcon, LifeBuoy, LogOut, Sun, Moon, Pin, PinOff } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useSidebarPin } from '@/components/dashboard/desktop/use-sidebar-pin'

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
        label: 'Le tue bollette',
        icon: <LayoutDashboard size={18} />,
        href: '/profile',
        match: (p) => p === '/profile' || p === '/profile/',
    },
    {
        key: 'confronto',
        label: 'Confronto consumi',
        icon: <BarChart3 size={18} />,
        href: '/confronto',
        match: (p) => p.startsWith('/confronto'),
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
    const [hovered, setHovered] = useState(false)
    const { mounted, pinned, togglePin } = useSidebarPin()
    // Bloccata = sempre aperta. Altrimenti si apre al passaggio del mouse.
    // Finche' non e' montata resta chiusa, come l'HTML servito dal server.
    const expanded = mounted && (pinned || hovered)
    const { resolvedTheme, setTheme } = useTheme()
    const isDark = mounted && resolvedTheme === 'dark'

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.refresh()
        router.push('/login')
    }

    return (
        <aside
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className={cn(
                "hidden lg:flex fixed left-0 top-0 h-screen z-30 flex-col bg-white dark:bg-[#1A1D23] transition-[width] duration-300 ease-out border-r border-slate-100 dark:border-white/5 shadow-xl shadow-slate-200/30 dark:shadow-none",
                expanded ? "w-60" : "w-20"
            )}
        >
            {/* Header: Logo and Brand Name */}
            <div className="pt-6 pb-8 px-5 flex items-center gap-3 shrink-0">
                <div className="w-10 h-10 flex items-center justify-center shrink-0">
                    <img src="/android-chrome-512x512.png" alt="" className="w-10 h-10 object-contain" />
                </div>
                <div className={cn(
                    "min-w-0 overflow-hidden transition-all duration-300 ease-out",
                    expanded ? "w-32 opacity-100 translate-x-0" : "w-0 opacity-0 -translate-x-4 pointer-events-none"
                )}>
                    <p className="text-[13px] font-extrabold text-[#0A2540] dark:text-white leading-tight whitespace-nowrap">Acquambiente</p>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Marche</p>
                </div>

                {/* Blocca/sblocca la barra aperta. Nascosto quando e' chiusa: a
                    80px non c'e' spazio, e per premerlo si passa comunque col
                    mouse, che la apre. */}
                <button
                    type="button"
                    onClick={togglePin}
                    aria-pressed={pinned}
                    title={pinned ? 'Sblocca la barra laterale' : 'Blocca la barra laterale aperta'}
                    className={cn(
                        'ml-auto shrink-0 rounded-lg transition-all duration-300 ease-out',
                        expanded ? 'p-1.5 opacity-100' : 'p-0 max-w-0 opacity-0 pointer-events-none',
                        pinned
                            ? 'bg-[#0A2540] text-white'
                            : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-[#0A2540] dark:hover:text-white'
                    )}
                >
                    {pinned ? <PinOff size={15} /> : <Pin size={15} />}
                    <span className="sr-only">
                        {pinned ? 'Sblocca la barra laterale' : 'Blocca la barra laterale aperta'}
                    </span>
                </button>
            </div>

            {/* Navigation Items */}
            <nav className="flex-1 px-3 space-y-1">
                {NAV.map(item => {
                    const active = item.match(pathname)
                    return (
                        <Link
                            key={item.key}
                            href={item.href}
                            prefetch
                            title={!expanded ? item.label : undefined}
                            className={cn(
                                "w-full flex items-center rounded-xl transition-colors text-[13px] font-bold h-11 px-4 relative overflow-hidden",
                                active
                                    ? "bg-[#0A2540] text-white"
                                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-[#0A2540] dark:hover:text-white"
                            )}
                        >
                            <span className="w-6 h-6 flex items-center justify-center shrink-0">
                                {item.icon}
                            </span>
                            <span className={cn(
                                "truncate whitespace-nowrap transition-all duration-300 ease-out text-left",
                                expanded ? "w-40 opacity-100 translate-x-0 ml-3" : "w-0 opacity-0 -translate-x-4 pointer-events-none"
                            )}>
                                {item.label}
                            </span>
                        </Link>
                    )
                })}
            </nav>

            {/* Serve aiuto widget */}
            <div className={cn(
                "mx-4 mb-4 rounded-2xl bg-slate-50 dark:bg-white/5 overflow-hidden transition-all duration-300 ease-out shrink-0",
                expanded ? "p-4 max-h-32 opacity-100 translate-y-0" : "p-0 max-h-0 opacity-0 translate-y-4 pointer-events-none"
            )}>
                <p className="text-[11px] font-bold text-[#0A2540] dark:text-white mb-1">Serve aiuto?</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Servizio clienti</p>
                <a href="tel:800069718" className="text-[12px] font-bold text-[#1E5BFF] mt-1 block">800.069.718</a>
            </div>

            {/* Theme toggle */}
            <button
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                title={!expanded ? (isDark ? 'Modalità chiara' : 'Modalità scura') : undefined}
                className="group/theme mx-3 mb-2 h-11 rounded-xl text-[13px] font-bold flex items-center px-4 transition-colors text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-[#0A2540] dark:hover:text-white shrink-0"
            >
                <span className={cn(
                    "w-6 h-6 flex items-center justify-center shrink-0 transition-colors",
                    isDark
                        ? "group-hover/theme:text-amber-400"   // Sun → giallo caldo
                        : "group-hover/theme:text-slate-900"   // Moon → blu/nero scuro
                )}>
                    {isDark ? <Sun size={18} /> : <Moon size={18} />}
                </span>
                <span className={cn(
                    "truncate whitespace-nowrap transition-all duration-300 ease-out text-left",
                    expanded ? "w-40 opacity-100 translate-x-0 ml-3" : "w-0 opacity-0 -translate-x-4 pointer-events-none"
                )}>
                    {isDark ? 'Modalità chiara' : 'Modalità scura'}
                </span>
            </button>

            {/* Logout button */}
            <button
                onClick={handleLogout}
                title={!expanded ? 'Esci' : undefined}
                className="mx-3 mb-4 h-11 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 text-[13px] font-bold flex items-center px-4 transition-colors hover:bg-red-500/15 shrink-0"
            >
                <span className="w-6 h-6 flex items-center justify-center shrink-0">
                    <LogOut size={18} />
                </span>
                <span className={cn(
                    "truncate whitespace-nowrap transition-all duration-300 ease-out text-left",
                    expanded ? "w-40 opacity-100 translate-x-0 ml-3" : "w-0 opacity-0 -translate-x-4 pointer-events-none"
                )}>
                    Esci
                </span>
            </button>
        </aside>
    )
}
