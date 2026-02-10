'use client'

import { Shield, Smartphone, CreditCard, User, Eye, EyeOff, Loader2, MapPin, FileText, ChevronDown } from 'lucide-react'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface UserWidgetProps {
    settings?: Record<string, any>
    externalData?: {
        name?: string
        client_code?: string
        fiscal_code?: string
        address?: string
    }
    supplyData?: {
        supplies: string[]
        selectedSupply: string
        onSelect: (ulm: string) => void
    }
}

export function UserWidget({ settings = {}, externalData, ...props }: UserWidgetProps) {
    const accentColor = settings.accent_color || '#10b981'
    const bgStyle = settings.bg_style || 'Vetro (Light)'
    const isDarkBg = bgStyle === 'Vetro (Dark)' || bgStyle === 'Solido Blue'

    // Default Fallback
    const fullName = externalData?.name || 'Utente'
    const firstName = fullName.split(' ')[0]
    const clientCode = externalData?.client_code || 'N/A'
    const fiscalCode = externalData?.fiscal_code || 'N/A'
    // Address isn't in registration? If not, keep fallback or check if we added it?
    const address = externalData?.address || 'Nessun indirizzo'

    return (
        <div className="md:bg-white/60 dark:md:bg-[#1e1e1e]/60 md:backdrop-blur-xl md:border md:border-white/40 dark:md:border-white/10 md:rounded-3xl md:p-5 h-full flex flex-col justify-between relative overflow-hidden group md:shadow-sm">

            {/* Header / Verified Status */}
            <div className="flex justify-between items-start z-10 mb-4 md:mb-2">
                <div className="hidden md:block">
                    {(settings.show_welcome ?? true) && (
                        <span className={cn(
                            "text-sm font-medium block text-slate-500 dark:text-slate-400"
                        )}>Bentornato,</span>
                    )}
                    <h3 className="text-3xl font-bold leading-tight text-slate-900 dark:text-white">{firstName}!</h3>
                    {(settings.show_welcome ?? true) && (
                        <p className="text-sm block text-slate-500 dark:text-slate-400">Benvenuto nella tua area personale.</p>
                    )}
                </div>
                <div className="md:hidden" />
                <div className="md:hidden" />
                <div className="hidden md:flex items-center gap-3">
                    <div
                        className="flex items-center justify-center h-12 w-12 rounded-full border shadow-sm"
                        style={{
                            backgroundColor: `${accentColor}20`,
                            borderColor: `${accentColor}40`,
                            color: accentColor
                        }}
                        title="Account Verificato"
                    >
                        <Shield size={20} strokeWidth={2.5} />
                    </div>
                </div>
            </div>

            {/* Desktop Details Grid - Clean & Graphic */}
            <div className="hidden md:grid grid-cols-1 gap-y-5 mt-4">

                {/* Name */}
                <div className="flex items-start gap-4 group/item">
                    <div
                        className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm group-hover/item:scale-105 transition-transform"
                        style={{ backgroundColor: `${accentColor}10`, color: accentColor }}
                    >
                        <User size={20} strokeWidth={2.5} />
                    </div>
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider mb-1.5 text-slate-400 dark:text-slate-500">Intestatario</p>
                        <div className="flex items-center gap-2">
                            <span className="text-lg font-bold leading-none text-slate-900 dark:text-white">{fullName}</span>
                        </div>
                    </div>
                </div>

                {/* Client Code */}
                <div className="flex items-start gap-4 group/item">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-500 dark:text-indigo-400 shadow-sm group-hover/item:scale-105 transition-transform">
                        <CreditCard size={20} strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-wider mb-1.5 text-slate-400 dark:text-slate-500">Codice Cliente</p>
                        <div className="flex items-center gap-2">
                            <span className="text-lg font-bold font-mono leading-none text-slate-900 dark:text-white">{clientCode}</span>
                        </div>
                    </div>
                </div>

                {/* Fiscal Code */}
                <div className="flex items-start gap-4 group/item">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center text-violet-500 dark:text-violet-400 shadow-sm group-hover/item:scale-105 transition-transform">
                        <FileText size={20} strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-wider mb-1.5 text-slate-400 dark:text-slate-500">Codice Fiscale / P.IVA</p>
                        <div className="text-base font-bold font-mono break-all leading-tight text-slate-700 dark:text-slate-200">
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
                        <p className="text-[11px] font-bold uppercase tracking-wider mb-1.5 text-slate-400 dark:text-slate-500">Indirizzo Fornitura</p>
                        <p className="text-sm font-medium leading-snug truncate text-slate-700 dark:text-slate-300">
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
                        <p className={cn(
                            "text-[10px] font-bold uppercase tracking-wider mb-1",
                            isDarkBg ? "text-slate-400" : "text-slate-400 dark:text-slate-500"
                        )}>Intestatario</p>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn(
                                "text-lg font-bold leading-none",
                                isDarkBg ? "text-white" : "text-slate-900 dark:text-white"
                            )}>{fullName}</span>
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
                        <p className={cn(
                            "text-[10px] font-bold uppercase tracking-wider mb-1",
                            isDarkBg ? "text-slate-400" : "text-slate-400 dark:text-slate-500"
                        )}>Codice Cliente</p>
                        <div className="flex items-center gap-2">
                            <span className={cn(
                                "text-lg font-bold font-mono leading-none",
                                isDarkBg ? "text-white" : "text-slate-900 dark:text-white"
                            )}>{clientCode}</span>
                        </div>
                    </div>
                </div>

                {/* Fiscal Code */}
                <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center text-violet-500 dark:text-violet-400 shadow-sm">
                        <FileText size={20} strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0">
                        <p className={cn(
                            "text-[10px] font-bold uppercase tracking-wider mb-1",
                            isDarkBg ? "text-slate-400" : "text-slate-400 dark:text-slate-500"
                        )}>Codice Fiscale</p>
                        <div className={cn(
                            "text-base font-bold font-mono break-all leading-tight",
                            isDarkBg ? "text-slate-200" : "text-slate-700 dark:text-slate-200"
                        )}>
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
                        <p className={cn(
                            "text-[10px] font-bold uppercase tracking-wider mb-1",
                            isDarkBg ? "text-slate-400" : "text-slate-400 dark:text-slate-500"
                        )}>Indirizzo Fornitura</p>
                        <p className={cn(
                            "text-sm font-medium leading-snug truncate",
                            isDarkBg ? "text-slate-300" : "text-slate-700 dark:text-slate-300"
                        )}>
                            {address}
                        </p>
                    </div>
                </div>

            </div>
        </div >
    )
}
