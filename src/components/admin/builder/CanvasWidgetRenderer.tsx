'use client'

import React from 'react'
import { BuilderWidget } from './builder-types'
import { Users, CreditCard, Activity, ArrowUpRight, Shield, TrendingUp, MapPin, FileText, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RendererProps {
    widget: BuilderWidget
    data: any[]
}

export function CanvasWidgetRenderer({ widget, data }: RendererProps) {
    // Helper to resolve mapping or show fallback
    const getValue = (field: string, fallback: string = '---') => {
        const mapping = widget.mappings[field]
        if (!mapping) return fallback

        if (mapping.staticValue) return mapping.staticValue

        if (mapping.sourceColumn && data.length > 0) {
            const val = data[0][mapping.sourceColumn]
            if (val !== undefined && val !== null) return val
        }

        return `[Mapped: ${mapping.sourceColumn || '?'}]`
    }

    // Mock Data for Charts if no data available
    const mockBarData = [40, 70, 45, 90, 60, 80]

    const settings = widget.settings || {}

    switch (widget.type) {
        case 'user_profile':
        case 'user_widget':
            const showWelcome = settings.show_welcome ?? true
            const accentColor = settings.accent_color || '#10b981'
            const bgStyle = settings.bg_style || 'Vetro (Light)'

            return (
                <div className={cn(
                    "backdrop-blur-xl border rounded-3xl p-5 h-full flex flex-col justify-between relative overflow-hidden group shadow-sm transition-all duration-500",
                    bgStyle === 'Vetro (Dark)' ? "bg-[#1e1e1e]/60 border-white/10" :
                        bgStyle === 'Solido Blue' ? "bg-[#005A9C] border-blue-400/30 text-white" :
                            "bg-white/60 border-white/40"
                )}>
                    <div className="flex justify-between items-start z-10">
                        <div>
                            {showWelcome && (
                                <span className={cn(
                                    "text-sm font-medium block",
                                    bgStyle === 'Solido Blue' ? "text-blue-100" : "text-slate-500 dark:text-slate-400"
                                )}>Bentornato,</span>
                            )}
                            <h3 className={cn(
                                "text-3xl font-bold leading-tight",
                                bgStyle === 'Solido Blue' ? "text-white" : "text-slate-900 dark:text-white"
                            )}>Utente!</h3>
                            {showWelcome && (
                                <p className={cn(
                                    "text-sm block",
                                    bgStyle === 'Solido Blue' ? "text-blue-100/80" : "text-slate-500 dark:text-slate-400"
                                )}>Benvenuto nella tua area personale.</p>
                            )}
                        </div>
                        <div
                            className="flex items-center justify-center h-12 w-12 rounded-full border shadow-sm transition-transform group-hover:scale-110 duration-500"
                            style={{
                                backgroundColor: `${accentColor}20`,
                                borderColor: `${accentColor}40`,
                                color: accentColor
                            }}
                        >
                            <Shield size={20} strokeWidth={2.5} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-y-4 mt-6">
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-[#005A9C] dark:text-sky-400 shadow-sm">
                                <Users size={20} strokeWidth={2.5} />
                            </div>
                            <div>
                                <p className={cn(
                                    "text-[11px] font-bold uppercase tracking-wider mb-1",
                                    bgStyle === 'Solido Blue' ? "text-blue-200/60" : "text-slate-400 dark:text-slate-500"
                                )}>Intestatario</p>
                                <span className={cn(
                                    "text-lg font-bold leading-none",
                                    bgStyle === 'Solido Blue' ? "text-white" : "text-slate-900 dark:text-white"
                                )}>{getValue('name', 'Nome Cognome')}</span>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-500 dark:text-indigo-400 shadow-sm">
                                <CreditCard size={20} strokeWidth={2.5} />
                            </div>
                            <div>
                                <p className={cn(
                                    "text-[11px] font-bold uppercase tracking-wider mb-1",
                                    bgStyle === 'Solido Blue' ? "text-blue-200/60" : "text-slate-400 dark:text-slate-500"
                                )}>Codice Cliente</p>
                                <span className={cn(
                                    "text-lg font-bold font-mono leading-none",
                                    bgStyle === 'Solido Blue' ? "text-white" : "text-slate-900 dark:text-white"
                                )}>{getValue('client_code', 'C000000')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )

        case 'consumption_chart':
            const chartColor = settings.chart_color || '#0ea5e9'
            const showPercentage = settings.show_percentage ?? true

            return (
                <div className="bg-[#D0DEEF]/60 dark:bg-[#1e1e1e]/60 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-3xl p-6 shadow-sm h-full flex flex-col justify-between relative overflow-hidden">
                    <div className="flex justify-between pb-4 mb-4 border-b border-blue-100 dark:border-white/10 z-10">
                        <div className="flex items-center">
                            <div className="w-12 h-12 bg-white dark:bg-white/10 rounded-full flex items-center justify-center me-3 text-[#005A9C] dark:text-white shadow-sm">
                                <TrendingUp size={24} />
                            </div>
                            <div>
                                <h5 className="text-2xl font-bold text-slate-800 dark:text-white">{getValue('last_consumption', '145')} Mc</h5>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Consumo Ultimo Periodo</p>
                            </div>
                        </div>
                        {showPercentage && (
                            <div>
                                <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 text-xs font-bold px-3 py-1 rounded-full shadow-sm">+12%</span>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 flex items-end gap-2 px-2 pb-2">
                        {mockBarData.map((h, i) => (
                            <div
                                key={i}
                                className={cn(
                                    "flex-1 rounded-t-lg transition-all duration-500",
                                    i === 5 ? "shadow-lg" : "bg-white/80 dark:bg-white/10"
                                )}
                                style={{
                                    height: `${h}%`,
                                    backgroundColor: i === 5 ? chartColor : undefined,
                                    boxShadow: i === 5 ? `0 10px 15px -3px ${chartColor}40` : undefined
                                }}
                            />
                        ))}
                    </div>
                </div>
            )

        case 'recent_bills':
            const limit = parseInt(settings.limit || '3')
            const showStatus = settings.show_status ?? true

            return (
                <div className="bg-white/60 dark:bg-[#1e1e1e]/60 backdrop-blur-xl border border-white/40 dark:border-white/10 rounded-3xl p-6 shadow-sm h-full flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-tight">Ultime Fatture</h3>
                        <div className="p-2 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10">
                            <ChevronDown size={18} className="text-slate-400" />
                        </div>
                    </div>

                    <div className="space-y-3 overflow-y-auto pr-1">
                        {Array.from({ length: limit }).map((_, i) => (
                            <div key={i} className="p-4 bg-white/40 dark:bg-white/5 border border-white/40 dark:border-white/5 rounded-2xl flex items-center justify-between transition-colors hover:bg-white/60">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 rounded-xl flex items-center justify-center">
                                        <FileText size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800 dark:text-white leading-none">Fattura {i === 0 ? 'Giugno' : i === 1 ? 'Maggio' : i === 2 ? 'Aprile' : 'Marzo'}</p>
                                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mt-1">N. 123456{i}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-black text-slate-900 dark:text-white">€ {(i + 1) * 52},45</p>
                                    {showStatus && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full">Pagata</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )

        default:
            return (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-white/10 rounded-3xl p-10">
                    <div className="w-12 h-12 bg-white dark:bg-white/10 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                        <Activity size={24} className="opacity-20" />
                    </div>
                    <p className="font-bold text-slate-500 uppercase tracking-widest text-[10px]">{widget.type.replace('_', ' ')}</p>
                    <p className="text-xs opacity-50 mt-1">Configura mappatura</p>
                </div>
            )
    }
}
