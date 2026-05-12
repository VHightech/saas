'use client'

import { useMemo, useEffect, useState } from 'react'
import { Home, MapPin, Mail, FileText, ChevronRight, Sun, Moon, LogOut, ChevronLeft, Building2, Smartphone } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/dashboard'

interface MobileProfiloProps {
    profile: Profile
    stats: {
        fullName: string
        firstName: string
        clientCode: string
        fiscalCode?: string
        address?: string
        email?: string
        phone?: string
    }
    supplies?: any[]
    onBack: () => void

    onLogout?: () => void
}

export function MobileProfilo({ profile, stats, supplies = [], onBack, onLogout }: MobileProfiloProps) {
    const router = useRouter()
    const supabase = createClient()
    const { theme, resolvedTheme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const initials = useMemo(() => {
        const parts = (stats.fullName || stats.firstName || 'U').trim().split(/\s+/)
        return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'U'
    }, [stats.fullName, stats.firstName])

    const memberSince = (profile as any)?.created_at
        ? new Date((profile as any).created_at).getFullYear()
        : '2019'

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.refresh()
        router.push('/login')
    }

    return (
        <div className="px-5 pb-6 space-y-6">
            <div className="pt-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <button onClick={onBack} className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-[#0A2540] dark:text-white active:scale-90 transition-transform shrink-0">
                        <ChevronLeft size={24} />
                    </button>
                    <p className="text-xl font-bold text-[#0A2540] dark:text-white">Profilo</p>
                    <div className="w-12" />
                </div>
            </div>

            {/* Hero Card */}
            <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#0A2540] via-[#10325E] to-[#1E5BFF] text-white p-8 text-center">
                <div className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-white/5 blur-3xl" />
                <div className="absolute -top-10 -left-10 w-32 h-32 rounded-full bg-white/5 blur-2xl" />

                <h2 className="text-2xl font-bold tracking-tight mb-1">{stats.fullName}</h2>
                <p className="text-xs text-blue-100/80 font-medium">
                    Cliente dal {memberSince} · cod. {stats.clientCode}
                </p>
            </div>

            {/* Contratto */}
            <div>
                <p className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase mb-2 px-1">Dati personali</p>
                <div className="bg-white dark:bg-[#1A1D23] rounded-[2rem] overflow-hidden divide-y divide-slate-100 dark:divide-white/5">
                    <InfoRow icon={<Mail size={18} className="text-[#1E5BFF] dark:text-[#93C5FD]" />} label="Email" value={stats.email || 'N/A'} />
                    <InfoRow icon={<Smartphone size={18} className="text-[#1E5BFF] dark:text-[#93C5FD]" />} label="Telefono" value={stats.phone || 'N/A'} />
                    <InfoRow icon={<FileText size={18} className="text-[#1E5BFF] dark:text-[#93C5FD]" />} label="Codice fiscale / P.IVA" value={stats.fiscalCode || 'N/A'} mono />
                </div>
            </div>

            {/* Forniture — indirizzi delle utenze */}
            {supplies.length > 0 && (
                <div>
                    <p className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase mb-2 px-1">Le tue forniture</p>
                    <div className="bg-white dark:bg-[#1A1D23] rounded-[2rem] overflow-hidden divide-y divide-slate-100 dark:divide-white/5">
                        {supplies.map((s: any, i) => {
                            const isBiz = /^(uff|via roma|corso)/i.test(s.address || '')
                            return (
                                <div key={`supply-${i}`} className="w-full flex items-center gap-3 px-6 py-4">
                                    <div className="w-9 h-9 rounded-xl bg-[#1E5BFF]/10 text-[#1E5BFF] dark:text-[#93C5FD] flex items-center justify-center shrink-0">
                                        {isBiz ? <Building2 size={18} /> : <Home size={18} />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-[#0A2540] dark:text-white truncate">{s.address || `Fornitura ${i + 1}`}</p>
                                        {s.city && <p className="text-[11px] text-slate-400 truncate mt-0.5">{s.city}</p>}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Impostazioni */}
            <div>
                <p className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase mb-2 px-1">Preferenze</p>
                <div className="bg-white dark:bg-[#1A1D23] rounded-[2rem] overflow-hidden">
                    <button onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')} className="w-full flex items-center gap-3 px-6 py-4 transition-colors active:bg-slate-50 dark:active:bg-white/5">
                        <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                            {mounted && resolvedTheme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                        </div>
                        <div className="flex-1 text-left">
                            <p className="text-sm font-bold text-[#0A2540] dark:text-white">Tema</p>
                            <p className="text-[11px] text-slate-400 font-medium capitalize">
                                {mounted ? (resolvedTheme === 'dark' ? 'Scuro' : 'Chiaro') : 'Chiaro'}
                            </p>
                        </div>
                        <ChevronRight size={16} className="text-slate-300" />
                    </button>
                    <button onClick={onLogout} className="w-full flex items-center gap-3 px-6 py-4 transition-colors active:bg-red-50/50 dark:active:bg-red-500/5">
                        <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                            <LogOut size={18} />
                        </div>
                        <div className="flex-1 text-left">
                            <p className="text-sm font-bold text-red-500">Esci dall'account</p>
                        </div>
                    </button>
                </div>
            </div>
            <div className="pb-32" />
        </div>
    )
}

function InfoRow({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
    return (
        <div className="w-full flex items-center gap-3 px-6 py-4">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400">{label}</p>
                <p className={`text-sm font-bold text-[#0A2540] dark:text-white truncate ${mono ? 'font-mono tracking-tight' : ''}`}>{value}</p>
            </div>
        </div>
    )
}
