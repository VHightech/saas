'use client'

import React from 'react'
import { BuilderWidget } from './builder-types'
import { WIDGET_REGISTRY } from './widget-registry'
import { Trash2, X } from 'lucide-react'

interface PropertyPanelProps {
    widget: BuilderWidget | null
    headers: string[]
    onChange: (id: string, updates: Partial<BuilderWidget>) => void
    onDelete: (id: string) => void
    onClose: () => void
}

export function PropertyPanel({ widget, headers, onChange, onDelete, onClose }: PropertyPanelProps) {
    if (!widget) {
        return (
            <div className="w-[300px] border-l border-slate-200 dark:border-white/10 bg-white dark:bg-[#111] p-6 flex flex-col items-center justify-center text-center text-slate-400">
                <p>Select a widget on the canvas to configure it.</p>
            </div>
        )
    }

    const def = WIDGET_REGISTRY[widget.type]

    if (!def) {
        return (
            <div className="w-[300px] border-l border-slate-200 dark:border-white/10 bg-white dark:bg-[#111] p-6 flex flex-col items-center justify-center text-center text-slate-400">
                <p className="text-sm font-bold text-red-400 mb-2">Error: Widget definition not found</p>
                <p className="text-xs">The type "{widget.type}" is not registered. Try deleting and re-adding this widget.</p>
                <button
                    onClick={() => onDelete(widget.id)}
                    className="mt-4 px-4 py-2 bg-red-50 text-red-500 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"
                >
                    Delete Widget
                </button>
            </div>
        )
    }

    // Helper to update a specific mapping field
    const updateMapping = (field: string, changes: any) => {
        const current = widget.mappings[field] || { field }
        const updated = { ...current, ...changes }

        onChange(widget.id, {
            mappings: {
                ...widget.mappings,
                [field]: updated
            }
        })
    }

    return (
        <div className="w-[300px] border-l border-slate-200 dark:border-white/10 bg-white dark:bg-[#111] h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-white/10">
                <h3 className="font-bold text-slate-900 dark:text-white">{def.label}</h3>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onDelete(widget.id)}
                        className="p-1.5 text-red-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors"
                    >
                        <Trash2 size={16} />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* General Props */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Dimensions</label>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <span className="text-[10px] text-slate-400">Width (1-12)</span>
                            <input
                                type="number"
                                min={1} max={12}
                                value={widget.w}
                                onChange={(e) => onChange(widget.id, { w: Number(e.target.value) })}
                                className="w-full px-2 py-1.5 rounded border border-slate-200 dark:border-white/10 bg-slate-50 text-sm"
                            />
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-400">Height</span>
                            <input
                                type="number"
                                min={1} max={12}
                                value={widget.h}
                                onChange={(e) => onChange(widget.id, { h: Number(e.target.value) })}
                                className="w-full px-2 py-1.5 rounded border border-slate-200 dark:border-white/10 bg-slate-50 text-sm"
                            />
                        </div>
                    </div>
                </div>

                <div className="border-t border-slate-100 dark:border-white/5 my-4" />

                {/* Data Mapping Fields */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-4">Mappatura Dati</label>
                    <div className="space-y-4">
                        {def.mappableFields.map(field => {
                            const mapping = widget.mappings[field.name] || {}

                            return (
                                <div key={field.name} className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{field.label}</label>

                                    {/* Static Value Input */}
                                    <input
                                        type="text"
                                        placeholder="Valore Statico (Opzionale)"
                                        value={mapping.staticValue || ''}
                                        onChange={(e) => updateMapping(field.name, { staticValue: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-black/20"
                                    />

                                    {/* Column Selector */}
                                    <select
                                        value={mapping.sourceColumn || ''}
                                        onChange={(e) => updateMapping(field.name, { sourceColumn: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                                    >
                                        <option value="">-- Associa a Colonna CSV --</option>
                                        {headers.map(h => (
                                            <option key={h} value={h}>{h}</option>
                                        ))}
                                    </select>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="border-t border-slate-100 dark:border-white/5 my-4" />

                {/* Customizable Settings & Colors */}
                {def.customizableSettings && def.customizableSettings.length > 0 && (
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-4">Personalizzazione UI</label>
                        <div className="space-y-5">
                            {def.customizableSettings.map(setting => {
                                const value = widget.settings?.[setting.name]

                                switch (setting.type) {
                                    case 'color':
                                        return (
                                            <div key={setting.name} className="flex items-center justify-between">
                                                <label className="text-sm text-slate-600 dark:text-slate-400">{setting.label}</label>
                                                <input
                                                    type="color"
                                                    value={value || '#6366f1'}
                                                    onChange={(e) => onChange(widget.id, {
                                                        settings: { ...widget.settings, [setting.name]: e.target.value }
                                                    })}
                                                    className="w-8 h-8 rounded-lg cursor-pointer border-none p-0 overflow-hidden"
                                                />
                                            </div>
                                        )
                                    case 'boolean':
                                        return (
                                            <div key={setting.name} className="flex items-center justify-between">
                                                <label className="text-sm text-slate-600 dark:text-slate-400">{setting.label}</label>
                                                <input
                                                    type="checkbox"
                                                    checked={value ?? true}
                                                    onChange={(e) => onChange(widget.id, {
                                                        settings: { ...widget.settings, [setting.name]: e.target.checked }
                                                    })}
                                                    className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                />
                                            </div>
                                        )
                                    case 'select':
                                        return (
                                            <div key={setting.name} className="space-y-2">
                                                <label className="text-sm text-slate-600 dark:text-slate-400">{setting.label}</label>
                                                <select
                                                    value={value || setting.options?.[0]}
                                                    onChange={(e) => onChange(widget.id, {
                                                        settings: { ...widget.settings, [setting.name]: e.target.value }
                                                    })}
                                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                                                >
                                                    {setting.options?.map(opt => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )
                                    default:
                                        return null
                                }
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
