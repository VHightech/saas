'use client'

import React, { useMemo } from 'react'
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react'

interface TenantPreviewProps {
    branding: {
        name: string
        primaryColor: string
        logoUrl?: string
    }
    mapping: Record<string, any>
    data: any[]
}

export function TenantPreview({ branding, mapping, data }: TenantPreviewProps) {
    const previewItems = useMemo(() => {
        if (!data || data.length === 0) return []

        // Only show first 5 items
        return data.slice(0, 5).map((row, index) => {
            const mappedItem: any = {}

            // Apply Mapping Logic (Simplified version of backend logic)
            Object.entries(mapping).forEach(([targetField, mapConfig]: [string, any]) => {
                try {
                    // mapConfig is { source: "{{Col_1}}", type: "date", ... }
                    let value = mapConfig.source || ''

                    // Replace variables like {{Col_1}} with actual data
                    // Regex to find {{Variable}}
                    value = value.replace(/\{\{(.+?)\}\}/g, (_: string, match: string) => {
                        return row[match] || ''
                    })

                    // Basic Type Formatting
                    if (mapConfig.type === 'currency') {
                        const num = parseFloat(value.replace(/[^0-9.-]+/g, ""))
                        if (!isNaN(num)) {
                            mappedItem[targetField] = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(num)
                        } else {
                            mappedItem[targetField] = value
                        }
                    } else if (mapConfig.type === 'date') {
                        // Very naive date parsing
                        mappedItem[targetField] = value
                    } else {
                        mappedItem[targetField] = value
                    }

                } catch (e) {
                    mappedItem[targetField] = "Error"
                }
            })
            return mappedItem
        })
    }, [data, mapping])

    return (
        <div className="bg-slate-100 dark:bg-black/40 rounded-3xl overflow-hidden border border-slate-200 dark:border-white/5 relative h-full flex flex-col">

            {/* Fake Browser Chrome */}
            <div className="bg-white dark:bg-[#111] border-b border-slate-200 dark:border-white/10 px-4 py-3 flex items-center justify-between">
                <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400/80"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400/80"></div>
                </div>
                <div className="flex-1 text-center">
                    <div className="bg-slate-100 dark:bg-white/5 inline-flex items-center gap-2 px-3 py-1 rounded-md text-[10px] text-slate-400 font-mono">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        portal.{branding.name.toLowerCase().replace(/\s+/g, '')}.com
                    </div>
                </div>
                <div className="w-10"></div>
            </div>

            {/* Content Preview */}
            <div className="flex-1 p-6 overflow-y-auto">

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Building Overview</h1>
                        <p className="text-xs text-slate-500">Welcome back, Administrator</p>
                    </div>
                    <div
                        className="p-2 rounded-full bg-indigo-500 text-white shadow-lg shadow-indigo-500/30"
                        style={{ backgroundColor: branding.primaryColor }}
                    >
                        <div className="w-6 h-6 flex items-center justify-center font-bold text-xs">
                            {branding.name.substring(0, 2).toUpperCase()}
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-white dark:bg-[#111] p-4 rounded-2xl border border-slate-100 dark:border-white/5">
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-2">Total Bills</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{data?.length || 0}</p>
                    </div>
                    <div className="bg-white dark:bg-[#111] p-4 rounded-2xl border border-slate-100 dark:border-white/5">
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-2">Pending</p>
                        <p className="text-2xl font-bold text-amber-500">{data?.length ? Math.floor(data.length * 0.3) : 0}</p>
                    </div>
                </div>

                {/* Mapped Data Widget */}
                <div className="bg-white dark:bg-[#111] rounded-2xl border border-slate-100 dark:border-white/5 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                        <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">Recent Invoices</h3>
                        <span className="text-[10px] bg-slate-100 dark:bg-white/10 px-2 py-1 rounded text-slate-500">Live Preview</span>
                    </div>

                    {previewItems.length > 0 ? (
                        <div className="w-full">
                            {previewItems.map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-3 border-b border-slate-50 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-400">
                                            <Clock size={14} />
                                        </div>
                                        <div>
                                            {/* Primary Label: Usually Service ID or PDF Name */}
                                            <p className="text-xs font-bold text-slate-900 dark:text-white">
                                                {item.service_id || item.pdf_name || `Invoice #${i + 1}`}
                                            </p>
                                            {/* Secondary: CIF or Expiry */}
                                            <p className="text-[10px] text-slate-500">
                                                {item.cif || item.expiry_date || 'No details'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Amount / Consumption */}
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                                            {item.amount || '€ -'}
                                        </p>
                                        <p className="text-[10px] text-slate-500">
                                            {item.consumption ? `${item.consumption} Smc` : ''}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center">
                            <AlertCircle className="mx-auto text-slate-300 mb-2" size={24} />
                            <p className="text-xs text-slate-400">Upload data to see a preview of how bills will appear.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Status Bar */}
            <div className="bg-white dark:bg-[#111] border-t border-slate-200 dark:border-white/10 px-4 py-2 flex items-center justify-between text-[9px] text-slate-400">
                <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={10} className="text-emerald-500" />
                    <span>System Operational</span>
                </div>
                <span>v2.1.0</span>
            </div>
        </div>
    )
}
