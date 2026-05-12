'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, FileText, MapPin, Smartphone, Home as HomeIcon, Building2, ChevronRight, KeyRound } from 'lucide-react'
import { DesktopSidebar } from '@/components/dashboard/desktop/DesktopSidebar'
import { MobileProfilo } from '@/components/dashboard/mobile/MobileProfilo'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/dashboard'
import type { UserSupply } from '@/components/dashboard/desktop/DesktopShell'

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
                <MobileProfilo profile={profile} stats={stats} onBack={() => history.back()} onLogout={handleLogout} />
            </div>

            {/* DESKTOP */}
            <div className="hidden lg:block h-screen overflow-hidden bg-white dark:bg-[#0F1115]">
                <DesktopSidebar />

                <main className="ml-20 h-full overflow-y-auto custom-scrollbar">
                    <div className="max-w-[1440px] mx-auto p-8 space-y-6">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Account</p>
                        <h1 className="text-3xl font-bold text-[#0A2540] dark:text-white tracking-tight">Il tuo profilo</h1>
                    </div>

                    {/* Identity card */}
                    <div className="rounded-[2rem] p-6 text-white relative overflow-hidden flex items-center gap-6"
                        style={{ background: 'linear-gradient(135deg, #0A2540 0%, #064E3B 50%, #1E5BFF 100%)' }}>
                        <div className="w-20 h-20 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center text-2xl font-extrabold">
                            {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-200/80 mb-1">Cliente Acquambiente</p>
                            <h2 className="text-3xl font-extrabold tracking-tight truncate">{stats.fullName}</h2>
                            <div className="flex flex-wrap gap-2 mt-3">
                                <Pill label="Codice Cliente" value={stats.clientCode} />
                                {memberSince && <Pill label="Cliente dal" value={String(memberSince)} />}
                            </div>
                        </div>
                    </div>

                    {/* Contact + Supplies */}
                    <div className="grid grid-cols-2 gap-5">
                        <div className="bg-white dark:bg-[#1A1D23] rounded-[2rem] p-5">
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Dati di contatto</h3>
                            <div className="space-y-2">
                                <Row icon={<Mail size={14} />} label="Email" value={stats.email} />
                                <Row icon={<Smartphone size={14} />} label="Telefono" value={stats.phone} />
                                <Row icon={<FileText size={14} />} label="Codice Fiscale / P.IVA" value={stats.fiscalCode} mono />
                                <Row icon={<MapPin size={14} />} label="Indirizzo" value={stats.address} />
                            </div>
                        </div>

                        <div className="bg-white dark:bg-[#1A1D23] rounded-[2rem] p-5">
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Le tue forniture</h3>
                            {supplies.length === 0 ? (
                                <p className="text-[11px] text-slate-400 py-4">Nessuna fornitura</p>
                            ) : (
                                <div className="space-y-2">
                                    {supplies.map((s, i) => (
                                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5">
                                            <div className="w-9 h-9 rounded-xl bg-[#1E5BFF]/10 text-[#1E5BFF] flex items-center justify-center shrink-0">
                                                {/^(uff|via roma|corso)/i.test(s.address || '') ? <Building2 size={16} /> : <HomeIcon size={16} />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[12px] font-bold text-[#0A2540] dark:text-white truncate">{s.address || `Fornitura ${i + 1}`}</p>
                                                {s.city && <p className="text-[10px] text-slate-400 truncate">{s.city}</p>}
                                            </div>
                                            {s.ulm && <span className="text-[9px] font-mono font-bold text-slate-400 uppercase shrink-0">{s.ulm}</span>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="bg-white dark:bg-[#1A1D23] rounded-[2rem] p-5">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Sicurezza e account</h3>
                        <div className="space-y-2">
                            <ActionRow
                                icon={<KeyRound size={16} />}
                                title="Cambia password"
                                desc="Aggiorna la password del tuo account"
                                onClick={() => router.push('/profile/change-password')}
                            />
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
        <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5">
            <div className="p-2 bg-white dark:bg-white/10 text-[#1E5BFF] rounded-lg shrink-0">{icon}</div>
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
