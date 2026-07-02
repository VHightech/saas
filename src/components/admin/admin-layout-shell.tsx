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
    canInviteAdmins?: boolean
}

const NAV_ITEMS = [
    { name: 'Utenti', href: '/admin/users', icon: Users },
    { name: 'Caricamento', href: '/admin/upload', icon: UploadCloud },
    { name: 'Invita Admin', href: '/admin/invite', icon: ShieldCheck },
] as const


export function AdminLayoutShell({ children, userName, userRole, canInviteAdmins }: AdminLayoutShellProps) {
    const pathname = usePathname()
    const { setTheme, resolvedTheme } = useTheme()
    const [mounted, setMounted] = useState(false)
    const [collapsed, setCollapsed] = useState(true)

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
                    onMouseLeave={() => setCollapsed(true)}
                    className={cn(
                        'sticky top-0 h-screen shrink-0 flex flex-col text-white z-40 border-r border-white/5 transition-[width] duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] overflow-hidden relative',
                        collapsed ? 'w-16' : 'w-64'
                    )}
                    style={{ background: 'linear-gradient(135deg, #1E5BFF 0%, #065F46 50%, #064E3B 100%)' }}
                >
                    {/* Full Sidebar Wave Animation */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
                        <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-emerald-400/20 blur-3xl animate-wave-pulse" />
                        <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full bg-white/10 blur-3xl animate-wave-pulse" style={{ animationDelay: '2.5s' }} />
                        <div className="absolute bottom-0 left-0 w-full h-full overflow-hidden">
                            <div className="absolute bottom-0 left-0 w-[2880px] h-full flex animate-wave-slide reverse opacity-20" style={{ animationDuration: '25s' }}>
                                <svg className="w-[1440px] h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
                                    <path fill="#ffffff" d="M0,160 C240,160 480,60 720,160 C960,260 1200,160 1440,160 L1440,320 L0,320 Z" />
                                </svg>
                                <svg className="w-[1440px] h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
                                    <path fill="#ffffff" d="M0,160 C240,160 480,60 720,160 C960,260 1200,160 1440,160 L1440,320 L0,320 Z" />
                                </svg>
                            </div>
                            <div className="absolute bottom-0 left-0 w-[2880px] h-full flex animate-wave-slide opacity-30" style={{ animationDuration: '18s' }}>
                                <svg className="w-[1440px] h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
                                    <path fill="#ffffff" d="M0,200 C360,200 480,100 720,200 C960,300 1080,200 1440,200 L1440,320 L0,320 Z" />
                                </svg>
                                <svg className="w-[1440px] h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
                                    <path fill="#ffffff" d="M0,200 C360,200 480,100 720,200 C960,300 1080,200 1440,200 L1440,320 L0,320 Z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="relative z-10 flex flex-col h-full">
                        <div className="h-16 flex items-center px-3 shrink-0 mb-6 border-b border-white/5">
                            <div className="flex items-center min-w-0">
                                <div className="w-10 h-10 flex items-center justify-center shrink-0">
                                    <img
                                        src="/acq_favicon.ico"
                                        alt="Logo"
                                        className="w-10 h-10 object-contain"
                                    />
                                </div>
                                <div className={cn(
                                    "leading-tight transition-all duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] overflow-hidden",
                                    collapsed ? "max-w-0 opacity-0 ml-0" : "flex-1 max-w-[180px] opacity-100 ml-3"
                                )}>
                                    <p className="text-[15px] font-extrabold tracking-tight whitespace-nowrap text-white">Acquambiente</p>
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Marche</p>
                                </div>
                            </div>
                        </div>

                        {/* Primary Nav */}
                        <nav className="flex-1 px-3 overflow-y-auto custom-scrollbar space-y-1">
                            <ul className="space-y-1">
                                {NAV_ITEMS.filter(item => {
                                    const isSuper = userRole === 'superadmin' || userRole === 'super_admin'
                                    // Upload stays super-admin only.
                                    if (item.href === '/admin/upload') return isSuper
                                    // Invite/manage admins: super_admin OR an admin granted the permission.
                                    if (item.href === '/admin/invite') return isSuper || !!canInviteAdmins
                                    return true
                                }).map((item) => {
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
                                                        ? 'bg-white/20 text-white font-bold backdrop-blur-md'
                                                        : 'text-white/70 hover:bg-white/15 hover:backdrop-blur-md hover:text-white'
                                                )}
                                            >
                                                <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} className={cn("shrink-0 transition-transform duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]", !isActive && "group-hover:scale-110")} />
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
                        <div className="px-3 pb-6 pt-4 space-y-2">
                            {/* Theme toggle — sits on top of the profile */}
                            <button
                                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                                aria-label={isDark ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
                                title={isDark ? 'Tema chiaro' : 'Tema scuro'}
                                className={cn(
                                    'w-full flex items-center h-9 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all duration-300 overflow-hidden',
                                    collapsed ? 'justify-center px-0' : 'px-2 gap-3'
                                )}
                            >
                                <span className={cn(
                                    "shrink-0 flex items-center justify-center transition-colors",
                                    collapsed && (isDark ? 'text-amber-400' : 'text-sky-300')
                                )}>
                                    {mounted && (isDark ? <Sun size={20} strokeWidth={2.6} /> : <Moon size={20} strokeWidth={2.6} />)}
                                </span>
                                <span className={cn(
                                    'text-[12px] font-medium whitespace-nowrap transition-all duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] overflow-hidden',
                                    collapsed ? 'max-w-0 opacity-0' : 'max-w-[160px] opacity-100'
                                )}>
                                    {isDark ? 'Tema chiaro' : 'Tema scuro'}
                                </span>
                            </button>

                            {/* Profile row — logout icon replaces the old 3-dots and only shows when open */}
                            <div className={cn(
                                'w-full flex items-center h-12 rounded-xl overflow-hidden',
                                collapsed ? 'justify-center px-0' : 'px-2'
                            )}>
                                <div className="relative shrink-0">
                                    <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-[11px] font-bold text-white border border-white/10">
                                        {initials}
                                    </div>
                                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#065F46]" />
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
                                    <button
                                        onClick={async () => { await logout() }}
                                        aria-label="Esci"
                                        title="Esci"
                                        className="shrink-0 ml-2 p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/15 transition-colors"
                                    >
                                        <LogOut size={18} strokeWidth={2.6} />
                                    </button>
                                </div>
                            </div>
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
