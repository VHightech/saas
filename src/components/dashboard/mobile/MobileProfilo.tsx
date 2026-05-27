'use client'

import { useMemo, useEffect, useState } from 'react'
import { Home, Mail, FileText, ChevronRight, Sun, Moon, LogOut, ChevronLeft, Building2, Smartphone, KeyRound, ChevronDown } from 'lucide-react'
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

    const [showAllSupplies, setShowAllSupplies] = useState(false)
    const visibleSupplies = showAllSupplies ? supplies : supplies.slice(0, 3)
    const hiddenCount = Math.max(0, supplies.length - 3)

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
            <div
                className="relative overflow-hidden rounded-[2rem] text-white p-5 animate-gradient-shift"
                style={{ background: 'linear-gradient(135deg, #064E3B 0%, #065F46 50%, #1E5BFF 100%)' }}
            >
                <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[2rem]">
                    <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-emerald-400/20 blur-3xl animate-wave-pulse" />
                    <div className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl animate-wave-pulse" style={{ animationDelay: '2.5s' }} />
                    <div className="absolute bottom-0 left-0 w-full h-24 overflow-hidden">
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

                <div className="relative z-10 flex items-center gap-4">
                    <div className="w-20 h-20 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center text-2xl font-extrabold shrink-0">
                        {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-200/80 mb-1">Cliente Acquambiente</p>
                        <h2 className="text-2xl font-extrabold tracking-tight truncate">{stats.fullName}</h2>
                        <div className="flex flex-wrap gap-2 mt-2.5">
                            <Pill label="Codice" value={stats.clientCode} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Sicurezza */}
            <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 px-1">Sicurezza e account</p>
            <button
                onClick={() => router.push('/profile/change-password')}
                className="w-full flex items-center gap-3 px-5 py-4 rounded-[2rem] bg-white dark:bg-[#1A1D23] active:bg-slate-50 dark:active:bg-white/5 transition-colors"
            >
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-300 flex items-center justify-center shrink-0">
                    <KeyRound size={18} />
                </div>
                <div className="flex-1 text-left">
                    <p className="text-sm font-bold text-[#0A2540] dark:text-white">Cambia password</p>
                    <p className="text-[11px] text-slate-400 font-medium">Aggiorna la password del tuo account</p>
                </div>
                <ChevronRight size={18} className="text-slate-300" />
            </button>
            </div>

            {/* Contratto */}
            <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 px-1">Dati personali</p>
                <div className="bg-white dark:bg-[#1A1D23] rounded-[2rem] overflow-hidden divide-y divide-slate-100 dark:divide-white/5">
                    <InfoRow icon={<Mail size={18} className="text-[#1E5BFF]" />} label="Email" value={stats.email || 'N/A'} />
                    <InfoRow icon={<Smartphone size={18} className="text-[#1E5BFF]" />} label="Telefono" value={stats.phone || 'N/A'} />
                    <InfoRow icon={<FileText size={18} className="text-[#1E5BFF]" />} label="Codice fiscale / P.IVA" value={stats.fiscalCode || 'N/A'} mono />
                </div>
            </div>

            {/* Forniture — indirizzi delle utenze */}
            {supplies.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-2 px-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Le tue forniture</p>
                        {hiddenCount > 0 && (
                            <button
                                onClick={() => setShowAllSupplies(v => !v)}
                                className="flex items-center gap-1.5 text-[13px] font-bold text-[#1E5BFF] active:opacity-70 transition-opacity"
                            >
                                <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-lg bg-[#1E5BFF]/10 text-[#1E5BFF]">
                                    {showAllSupplies ? 'Mostra meno' : `+${hiddenCount}`}
                                </span>
                                <ChevronDown size={16} className={`transition-transform ${showAllSupplies ? 'rotate-180' : ''}`} />
                            </button>
                        )}
                    </div>
                    <div className="bg-white dark:bg-[#1A1D23] rounded-[2rem] overflow-hidden divide-y divide-slate-100 dark:divide-white/5">
                        {visibleSupplies.map((s: any, i) => {
                            const isBiz = /^(uff|via roma|corso)/i.test(s.address || '')
                            return (
                                <div key={`supply-${i}`} className="w-full flex items-center gap-3 px-6 py-4">
                                    <div className="w-9 h-9 rounded-xl bg-[#1E5BFF]/10 text-[#1E5BFF] flex items-center justify-center shrink-0">
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
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 px-1">Preferenze</p>
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

function Pill({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/20 backdrop-blur-md">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] opacity-70">{label}</span>
            <span className="text-[13px] font-mono font-bold tracking-wider uppercase">{value}</span>
        </div>
    )
}

function InfoRow({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
    return (
        <div className="w-full flex items-center gap-3 px-6 py-4">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center shrink-0">
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400">{label}</p>
                <p className={`text-sm font-bold text-[#0A2540] dark:text-white truncate ${mono ? 'font-mono tracking-tight' : ''}`}>{value}</p>
            </div>
        </div>
    )
}
