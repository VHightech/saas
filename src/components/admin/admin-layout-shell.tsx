'use client'

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    Users,
    UploadCloud,
    LogOut,
    Sun,
    Moon,
    ShieldCheck,
    Droplet,
    PanelLeftClose,
    PanelLeftOpen,
    MoreHorizontal,
    LayoutGrid,
    ChevronLeft,
    ChevronRight,
    Command,
} from 'lucide-react'
import { AdminUploadProvider } from '@/components/providers/admin-upload-provider'
import { GlobalProgressBar } from '@/components/ui/global-progress-bar'
import { useTheme } from 'next-themes'
import { logout } from '@/app/login/actions'
import { cn } from '@/lib/utils'

interface AdminLayoutShellProps {
    children: React.ReactNode
    userName?: string
    userRole?: string
}

const NAV_ITEMS = [
    { name: 'Utenti', href: '/admin/users', icon: Users },
    { name: 'Caricamento', href: '/admin/upload', icon: UploadCloud },
    { name: 'Invita Admin', href: '/admin/invite', icon: ShieldCheck },
] as const


export function AdminLayoutShell({ children, userName, userRole }: AdminLayoutShellProps) {
    const pathname = usePathname()
    const { setTheme, resolvedTheme } = useTheme()
    const [mounted, setMounted] = useState(false)
    const [collapsed, setCollapsed] = useState(true)
    const [userMenuOpen, setUserMenuOpen] = useState(false)

    useEffect(() => { setMounted(true) }, [])

    const initials = useMemo(() => {
        const parts = (userName || 'A').trim().split(/\s+/)
        return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'A'
    }, [userName])

    const isDark = mounted && resolvedTheme === 'dark'

    return (
        <AdminUploadProvider>
            <div className="min-h-screen w-full bg-white dark:bg-[#0F1115] text-slate-700 dark:text-slate-200 font-sans flex">
                {/* SIDEBAR */}
                <aside
                    onMouseEnter={() => setCollapsed(false)}
                    onMouseLeave={() => {
                        setCollapsed(true)
                        setUserMenuOpen(false)
                    }}
                    className={cn(
                        'sticky top-0 h-screen shrink-0 flex flex-col bg-[#0B0E14] text-white z-40 border-r border-white/5 transition-[width] duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]',
                        collapsed ? 'w-16' : 'w-64'
                    )}
                >


                    <div className="h-16 flex items-center px-3 shrink-0 mb-6 border-b border-white/5">
                        <div className="flex items-center min-w-0">
                            {/* Logo: Fixed size ensures stability during sidebar transition */}
                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-lg shadow-black/20 border border-white/10">
                                <img 
                                    src="/acq_favicon.ico" 
                                    alt="Logo" 
                                    className="w-6 h-6 object-contain"
                                />
                            </div>
                            
                            {/* Brand Name: Smooth fade and slide */}
                            <div className={cn(
                                "transition-all duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] overflow-hidden",
                                collapsed ? "max-w-0 opacity-0 ml-0" : "max-w-[160px] opacity-100 ml-3"
                            )}>
                                <span className="text-[15px] font-bold tracking-tight whitespace-nowrap text-white">
                                    Acquambiente
                                </span>
                            </div>
                        </div>
                    </div>





                    {/* Primary Nav */}
                    <nav className="flex-1 px-3 overflow-y-auto custom-scrollbar space-y-1">
                        <ul className="space-y-1">
                            {NAV_ITEMS.map((item) => {
                                const Icon = item.icon
                                const isActive = pathname.startsWith(item.href)
                                return (
                                    <li key={item.href}>
                                        <Link
                                            href={item.href}
                                            title={collapsed ? item.name : undefined}
                                            className={cn(
                                                'flex items-center h-10 rounded-xl text-[13px] transition-all duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] group',
                                                collapsed ? 'justify-center w-10 mx-auto' : 'px-3 w-full',
                                                isActive
                                                    ? 'bg-white/10 text-white font-semibold'
                                                    : 'text-white/50 hover:bg-white/5 hover:text-white'
                                            )}
                                        >
                                            <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} className={cn("shrink-0 transition-transform duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]", !isActive && "group-hover:scale-110")} />
                                            <div className={cn(
                                                "transition-all duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] overflow-hidden",
                                                collapsed ? "max-w-0 opacity-0 ml-0" : "max-w-[150px] opacity-100 ml-3"
                                            )}>
                                                <span className="whitespace-nowrap">{item.name}</span>
                                            </div>
                                        </Link>

                                    </li>
                                )
                            })}
                        </ul>
                    </nav>

                    {/* User Profile pinned bottom */}
                    <div className="px-3 pb-6 pt-4 border-t border-white/5">
                        <div className="relative">
                            <button
                                onClick={() => setUserMenuOpen(o => !o)}
                                className={cn(
                                    'w-full flex items-center h-12 rounded-xl transition-all duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] group overflow-hidden',
                                    collapsed ? 'justify-center px-0' : 'px-2 hover:bg-white/5'
                                )}
                            >
                                <div className="relative shrink-0">
                                    <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-[11px] font-bold text-white shadow-lg shadow-indigo-500/20 border border-white/10 group-hover:scale-105 transition-transform duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]">
                                        {initials}
                                    </div>
                                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0B0E14]" />
                                </div>
                                
                                <div className={cn(
                                    "flex items-center justify-between transition-all duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] overflow-hidden",
                                    collapsed ? "max-w-0 opacity-0 ml-0" : "flex-1 max-w-[160px] opacity-100 ml-3"
                                )}>
                                    <div className="min-w-0 text-left">
                                        <p className="text-[13px] font-bold text-white truncate leading-tight">
                                            {userName || 'Admin User'}
                                        </p>
                                        <p className="text-[11px] text-white/40 truncate leading-tight mt-0.5">
                                            {userRole || 'Administrator'}
                                        </p>
                                    </div>
                                    <MoreHorizontal size={14} className="text-white/40 shrink-0 group-hover:text-white/70 ml-2" />
                                </div>
                            </button>




                            {userMenuOpen && (
                                <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#14181F] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
                                    <button
                                        onClick={() => setTheme(isDark ? 'light' : 'dark')}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-[12px] text-white/70 hover:bg-white/5 transition-colors border-b border-white/5"
                                    >
                                        {isDark ? <Sun size={14} /> : <Moon size={14} />}
                                        Cambia Tema
                                    </button>
                                    <button
                                        onClick={async () => { await logout() }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-[12px] text-rose-400 hover:bg-white/5 transition-colors"
                                    >
                                        <LogOut size={14} />
                                        Esci
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </aside>

                {/* MAIN */}
                <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden bg-white dark:bg-[#0F1115]">
                    {/* Page header band — page renders into the slot via AdminPageHero */}
                    <div id="admin-hero-slot" className="pt-6 pb-4 shrink-0 px-6 transition-all duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]" />

                    <div className="flex-1 pb-6 min-h-0 overflow-hidden transition-all duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]">
                        <div className="w-full h-full">
                            {children}
                        </div>
                    </div>
                </main>




                <GlobalProgressBar />
            </div>
        </AdminUploadProvider>
    )
}
