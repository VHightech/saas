'use client'

import { Shield, Smartphone, CreditCard, User, Eye, EyeOff, Loader2, MapPin, FileText } from 'lucide-react'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

export function UserWidget() {
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    const supabase = createClient()

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return

                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single()

                if (data) {
                    console.log('UserWidget Data:', data)
                    setProfile(data)
                } else {
                    console.log('UserWidget: No data returned (RLS blocking?)')
                }
            } catch (error) {
                console.error('Error fetching profile:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchProfile()
    }, [])

    if (loading) {
        return (
            <div className="md:bg-white/60 dark:md:bg-[#1e1e1e]/60 md:backdrop-blur-xl md:border md:border-white/40 dark:md:border-white/10 md:rounded-3xl md:p-5 h-full flex flex-col justify-center items-center">
                <Loader2 className="animate-spin text-slate-400" />
            </div>
        )
    }

    // Default Fallback if profile is empty (shouldn't happen if auth needs profile)
    // We prioritize the fields we know we populated in the registration action
    const fullName = (profile?.name && profile?.surname)
        ? `${profile.name} ${profile.surname}`
        : (profile?.full_name || profile?.user_name || 'Utente')

    const firstName = profile?.name || fullName.split(' ')[0]

    // Explicitly check for our DB columns
    const clientCode = profile?.codice_cliente || profile?.client_code || 'N/A'

    // Check both potential fiscal code fields 
    const fiscalCode = profile?.cif || profile?.cfpi || profile?.fiscal_code || 'N/A'

    // Address isn't in registration? If not, keep fallback or check if we added it?
    // We didn't add address in registration action, so 'Nessun indirizzo' is correct for now unless we added it later.
    const address = profile?.indirizzo || profile?.address || 'Nessun indirizzo'

    const email = profile?.email || 'N/A'

    return (
        <div className="md:bg-white/60 dark:md:bg-[#1e1e1e]/60 md:backdrop-blur-xl md:border md:border-white/40 dark:md:border-white/10 md:rounded-3xl md:p-5 h-full flex flex-col justify-between relative overflow-hidden group md:shadow-sm">

            {/* Header / Verified Status */}
            <div className="flex justify-between items-start z-10 mb-4 md:mb-0">
                <div className="hidden md:block">
                    <span className="text-slate-500 dark:text-slate-400 text-sm font-medium block">Bentornato,</span>
                    <h3 className="text-slate-900 dark:text-white text-3xl font-bold leading-tight">{firstName}!</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm block">Benvenuto nella tua area personale.</p>
                </div>
                {/* Spacer to keep Badge on right on mobile */}
                <div className="md:hidden" />
                <div className="hidden md:flex flex-col items-end gap-2">
                    <div className="flex items-center justify-center text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 h-12 w-12 rounded-full border border-emerald-100 dark:border-emerald-500/20 shadow-sm" title="Account Verificato">
                        <Shield size={20} strokeWidth={2.5} />
                    </div>
                </div>
            </div>

            {/* Desktop Details Grid - Clean & Graphic */}
            <div className="hidden md:grid grid-cols-1 gap-y-5 mt-4">

                {/* Name */}
                <div className="flex items-start gap-4 group/item">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-[#005A9C] dark:text-sky-400 shadow-sm group-hover/item:scale-105 transition-transform">
                        <User size={20} strokeWidth={2.5} />
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Intestatario</p>
                        <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-slate-900 dark:text-white leading-none">{fullName}</span>
                        </div>
                    </div>
                </div>

                {/* Client Code */}
                <div className="flex items-start gap-4 group/item">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-500 dark:text-indigo-400 shadow-sm group-hover/item:scale-105 transition-transform">
                        <CreditCard size={20} strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Codice Cliente</p>
                        <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-slate-900 dark:text-white font-mono leading-none">{clientCode}</span>
                        </div>
                    </div>
                </div>

                {/* Fiscal Code */}
                <div className="flex items-start gap-4 group/item">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center text-violet-500 dark:text-violet-400 shadow-sm group-hover/item:scale-105 transition-transform">
                        <FileText size={20} strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Codice Fiscale / P.IVA</p>
                        <div className="text-base font-bold text-slate-700 dark:text-slate-200 font-mono break-all leading-tight">
                            {fiscalCode}
                        </div>
                    </div>
                </div>

                {/* Address */}
                <div className="flex items-start gap-4 group/item">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500 dark:text-emerald-400 shadow-sm group-hover/item:scale-105 transition-transform">
                        <MapPin size={20} strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Indirizzo Fornitura</p>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-snug truncate">
                            {address}
                        </p>
                    </div>
                </div>

            </div>


            {/* Mobile View - Icon List (Clean) */}
            <div className="md:hidden flex flex-col gap-4 pt-1">

                {/* Name */}
                <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-[#005A9C] dark:text-sky-400 shadow-sm">
                        <User size={20} strokeWidth={2.5} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Intestatario</p>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-lg font-bold text-slate-900 dark:text-white leading-none">{fullName}</span>
                            <div className="flex items-center gap-1 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full border border-emerald-200/50 dark:border-emerald-500/20">
                                <Shield size={10} className="text-emerald-700 dark:text-emerald-400" fill="currentColor" />
                                <span className="text-[9px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-tight">Verificato</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Client Code */}
                <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-500 dark:text-indigo-400 shadow-sm">
                        <CreditCard size={20} strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Codice Cliente</p>
                        <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-slate-900 dark:text-white font-mono leading-none">{clientCode}</span>
                        </div>
                    </div>
                </div>

                {/* Fiscal Code */}
                <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center text-violet-500 dark:text-violet-400 shadow-sm">
                        <FileText size={20} strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Codice Fiscale</p>
                        <div className="text-base font-bold text-slate-700 dark:text-slate-200 font-mono break-all leading-tight">
                            {fiscalCode}
                        </div>
                    </div>
                </div>

                {/* Address */}
                <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-500 dark:text-emerald-400 shadow-sm">
                        <MapPin size={20} strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Indirizzo Fornitura</p>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-snug truncate">
                            {address}
                        </p>
                    </div>
                </div>

            </div>
        </div >
    )
}
