'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    Users,
    UploadCloud,
    LogOut,
    Sun,
    Moon,
    ShieldCheck,
} from 'lucide-react'
import { AdminUploadProvider } from '@/components/providers/admin-upload-provider'
import { GlobalProgressBar } from '@/components/ui/global-progress-bar'
import { useTheme } from "next-themes"
import { logout } from '@/app/login/actions'

export function AdminLayoutShell({
    children,
    userName,
}: {
    children: React.ReactNode
    userName?: string
}) {
    const pathname = usePathname()
    // Default collapsed to true
    const [isCollapsed, setIsCollapsed] = useState(true)
    const { setTheme, theme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const navItems = [
        { name: 'Utenti', href: '/admin/users', icon: Users },
        { name: 'Caricamento File', href: '/admin/dashboard', icon: UploadCloud },
        { name: 'Amministratori', href: '/admin/admins', icon: ShieldCheck },
    ]

    return (
        <AdminUploadProvider>
            <div className="min-h-screen text-slate-900 group/layout flex font-sans dark:text-slate-100">
                <aside
                    onMouseEnter={() => setIsCollapsed(false)}
                    onMouseLeave={() => setIsCollapsed(true)}
                    className={`sticky top-0 h-screen bg-white/50 backdrop-blur-xl border-r border-slate-200 dark:border-[#333333] dark:bg-[#1e1e1e] flex flex-col transition-all duration-300 ease-in-out z-20 group
                        ${isCollapsed ? 'w-20' : 'w-64'}
                    `}
                >
                    {/* Header */}
                    <div className="h-20 flex items-center px-6 border-b border-slate-100 dark:border-[#333333] mb-6 overflow-hidden whitespace-nowrap">
                        <div className="w-8 h-8 flex-shrink-0 rounded-lg overflow-hidden flex items-center justify-center shadow-sm">
                            <img src="/brand-logo.jpg" alt="Acquambiente" className="w-full h-full object-cover" />
                        </div>

                        <div className={`ml-4 transition-all duration-300 ease-in-out overflow-hidden flex flex-col justify-center ${isCollapsed ? 'opacity-0 w-0 translate-x-4' : 'opacity-100 w-40 translate-x-0'}`}>
                            <h1 className="text-xl font-bold leading-none">
                                Portale Admin
                            </h1>
                            <p className="text-[9px] uppercase tracking-widest text-slate-400 font-bold mt-1 leading-none">
                                Acquambiente Marche
                            </p>
                        </div>
                    </div>

                    {/* Nav */}
                    <nav className="flex-1 px-4 space-y-2">
                        {navItems.map((item) => {
                            const Icon = item.icon
                            const isActive = pathname.startsWith(item.href)

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center pl-3.5 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden whitespace-nowrap
                                        ${isActive
                                            ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10 dark:bg-white dark:text-black'
                                            : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#2a2a2a] dark:hover:text-slate-200 hover:shadow-sm'
                                        }
                                    `}
                                    title={isCollapsed ? item.name : ''}
                                >
                                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className="flex-shrink-0 min-w-[20px]" />

                                    <span className={`font-medium text-sm transition-all duration-300 ease-in-out ml-3 ${isCollapsed ? 'opacity-0 w-0 translate-x-4' : 'opacity-100 w-32 translate-x-0'
                                        }`}>
                                        {item.name}
                                    </span>

                                    {/* Active Indicator Dot */}
                                    {isCollapsed && isActive && (
                                        <div className="absolute right-2 top-3 w-1.5 h-1.5 bg-sky-400 rounded-full animate-in zoom-in" />
                                    )}
                                </Link>
                            )
                        })}
                    </nav>



                    {/* Footer */}
                    <div className="p-4 border-t border-slate-100 dark:border-[#333333] space-y-2">
                        <button
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            className={`w-full flex items-center pl-3.5 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden whitespace-nowrap text-slate-500 hover:bg-slate-200/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#2a2a2a] dark:hover:text-slate-200 hover:shadow-sm`}
                            title={isCollapsed ? "Cambia Tema" : ''}
                        >
                            {mounted && theme === 'dark' ? (
                                <Sun size={20} className="flex-shrink-0 min-w-[20px]" />
                            ) : (
                                <Moon size={20} className="flex-shrink-0 min-w-[20px]" />
                            )}
                            <span className={`font-medium text-sm transition-all duration-300 ease-in-out ml-3 ${isCollapsed ? 'opacity-0 w-0 translate-x-4' : 'opacity-100 w-32 translate-x-0'}`}>
                                {mounted && theme === 'dark' ? 'Tema Chiaro' : 'Tema Scuro'}
                            </span>
                        </button>
                        <button
                            onClick={async () => {
                                await logout()
                            }}
                            className={`w-full flex items-center pl-3.5 py-3 rounded-xl overflow-hidden whitespace-nowrap btn-glass btn-glass-red group/logout`}
                            title={isCollapsed ? "Esci" : ''}
                        >
                            <LogOut size={20} className="flex-shrink-0 min-w-[20px] group-hover/logout:text-red-600 transition-colors" />
                            <span className={`font-medium text-sm text-left transition-all duration-300 ease-in-out ml-3 ${isCollapsed ? 'opacity-0 w-0 translate-x-4' : 'opacity-100 w-32 translate-x-0'
                                }`}>
                                Esci
                            </span>
                        </button>
                    </div>
                </aside>

                {/* MAIN CONTENT AREA */}
                <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden relative">
                    <div className="flex-1 p-8 min-h-0 overflow-hidden">
                        {children}
                    </div>
                </main>

                <GlobalProgressBar />
            </div>
        </AdminUploadProvider>
    )
}
