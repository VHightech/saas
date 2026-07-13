'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, FileText, Smartphone, Home as HomeIcon, Building2, ChevronRight, KeyRound, Download, ShieldCheck, ChevronDown } from 'lucide-react'
import { DesktopSidebar } from '@/components/dashboard/desktop/DesktopSidebar'
import { MobileProfilo } from '@/components/dashboard/mobile/MobileProfilo'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Profile, UserSupply } from '@/types/dashboard'

interface ProfiloViewProps {
    profile: Profile
    supplies?: UserSupply[]
    stats: {
        fullName: string
        firstName: string
        clientCode: string
        fiscalCode?: string
        address?: string
        email?: string
        phone?: string
    }
}

export function ProfiloView({ profile, supplies = [], stats }: ProfiloViewProps) {
    const router = useRouter()
    const supabase = createClient()

    const initials = useMemo(() => {
        const parts = (stats.fullName || stats.firstName || 'U').trim().split(/\s+/)
        return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'U'
    }, [stats.fullName, stats.firstName])

    const [showAllSupplies, setShowAllSupplies] = useState(false)
    const visibleSupplies = showAllSupplies ? supplies : supplies.slice(0, 3)
    const hiddenCount = Math.max(0, supplies.length - 3)

    const memberSince = (profile as any)?.created_at
        ? new Date((profile as any).created_at).getFullYear()
        : null

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.refresh()
        router.push('/login')
    }

    return (
        <>
            {/* MOBILE */}
            <div className="lg:hidden min-h-screen bg-[#F8FAFC] dark:bg-[#0F1115]">
                <MobileProfilo profile={profile} stats={stats} supplies={supplies} onBack={() => history.back()} onLogout={handleLogout} />
            </div>

            {/* DESKTOP */}
            <div className="hidden lg:block h-screen overflow-hidden bg-[#F8FAFC] dark:bg-[#0F1115]">
                <DesktopSidebar />

                <main className="ml-20 h-full overflow-y-auto custom-scrollbar">
                    <div className="max-w-[1440px] mx-auto p-8 space-y-6">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Account</p>
                        <h1 className="text-3xl font-bold text-[#0A2540] dark:text-white tracking-tight">Il tuo profilo</h1>
                    </div>

                    {/* Identity card */}
                    <div className="rounded-[2rem] p-6 text-white relative overflow-hidden animate-gradient-shift"
                        style={{ background: 'linear-gradient(135deg, #064E3B 0%, #065F46 50%, #1E5BFF 100%)' }}>
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

                        <div className="relative z-10 flex items-center gap-6">
                            <div className="w-20 h-20 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center text-2xl font-extrabold">
                                {initials}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-200/80 mb-1">Cliente Acquambiente</p>
                                <h2 className="text-3xl font-extrabold tracking-tight truncate">{stats.fullName}</h2>
                                <div className="flex flex-wrap gap-2 mt-3">
                                    <Pill label="Codice Cliente" value={stats.clientCode} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    {/* Sicurezza + Contatto + Forniture */}
                    <div className="grid grid-cols-3 gap-5">
                        <div className="bg-white dark:bg-[#1A1D23] rounded-[2rem] p-5">
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Sicurezza e account</h3>
                            <div className="space-y-2">
                                <ActionRow
                                    icon={<KeyRound size={16} />}
                                    title="Cambia password"
                                    desc="Aggiorna la password del tuo account"
                                    onClick={() => router.push('/profile/change-password')}
                                />
                                <ActionRow
                                    icon={<Download size={16} />}
                                    title="Scarica i miei dati"
                                    desc="Esporta i tuoi dati personali (GDPR art. 15/20)"
                                    onClick={() => window.open('/api/me/export', '_blank')}
                                />
                                <ActionRow
                                    icon={<ShieldCheck size={16} />}
                                    title="Privacy e i tuoi diritti"
                                    desc="Informativa e come esercitare i tuoi diritti"
                                    onClick={() => window.open('https://www.acquambientemarche.it/privacy-policy/', '_blank', 'noopener,noreferrer')}
                                />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-[#1A1D23] rounded-[2rem] p-5">
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Dati di contatto</h3>
                            <div className="space-y-2">
                                <Row icon={<Mail size={16} />} label="Email di accesso" value={stats.email} />
                                <Row icon={<Smartphone size={16} />} label="Telefono" value={stats.phone} />
                                <Row icon={<FileText size={16} />} label="Codice Fiscale / P.IVA" value={stats.fiscalCode} mono />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-[#1A1D23] rounded-[2rem] p-5">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Le tue forniture</h3>
                                {hiddenCount > 0 && (
                                    <button
                                        onClick={() => setShowAllSupplies(v => !v)}
                                        className="flex items-center gap-1.5 text-[12px] font-bold text-[#1E5BFF] hover:opacity-80 transition-opacity"
                                    >
                                        <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-lg bg-[#1E5BFF]/10 text-[#1E5BFF]">
                                            {showAllSupplies ? 'Mostra meno' : `+${hiddenCount}`}
                                        </span>
                                        <ChevronDown size={14} className={cn('transition-transform', showAllSupplies && 'rotate-180')} />
                                    </button>
                                )}
                            </div>
                            {supplies.length === 0 ? (
                                <p className="text-[11px] text-slate-400 py-4">Nessuna fornitura</p>
                            ) : (
                                <div className="space-y-2">
                                    {visibleSupplies.map((s, i) => (
                                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                                            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-300 flex items-center justify-center shrink-0">
                                                {/^(uff|via roma|corso)/i.test(s.address || '') ? <Building2 size={16} /> : <HomeIcon size={16} />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[12px] font-bold text-[#0A2540] dark:text-white truncate">{s.address || `Fornitura ${i + 1}`}</p>
                                                {s.city && <p className="text-[10px] text-slate-400 truncate">{s.city}</p>}
                                                {s.email && (
                                                    <p className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                                        <Mail size={10} className="shrink-0 text-[#1E5BFF]" />
                                                        <span className="truncate">{s.email}</span>
                                                    </p>
                                                )}
                                            </div>
                                            {s.ulm && <span className="text-[9px] font-mono font-bold text-slate-400 uppercase shrink-0">{s.ulm}</span>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    </div>
                </main>
            </div>
        </>
    )
}

function Pill({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/20 backdrop-blur-md">
            <span className="text-[9px] font-bold uppercase tracking-[0.1em] opacity-60">{label}</span>
            <span className="text-[12px] font-mono font-bold tracking-wider uppercase">{value}</span>
        </div>
    )
}

function Row({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value?: string; mono?: boolean }) {
    return (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-300 flex items-center justify-center shrink-0">{icon}</div>
            <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
                <p className={cn("text-[12px] font-bold text-slate-700 dark:text-slate-200 break-words", mono && "font-mono uppercase tracking-wide")}>
                    {value || '-'}
                </p>
            </div>
        </div>
    )
}

function ActionRow({ icon, title, desc, onClick }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
    return (
        <button onClick={onClick} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-300 flex items-center justify-center shrink-0">
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-[#0A2540] dark:text-white">{title}</p>
                <p className="text-[11px] text-slate-500">{desc}</p>
            </div>
            <ChevronRight size={16} className="text-slate-400" />
        </button>
    )
}
