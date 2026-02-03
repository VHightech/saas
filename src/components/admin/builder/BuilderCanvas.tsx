'use client'

import React from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { BuilderWidget } from './builder-types'
import { CanvasWidget } from './CanvasWidget'
import { Plus, LogOut } from 'lucide-react'

interface BuilderCanvasProps {
    widgets: BuilderWidget[]
    selectedId: string | null
    onSelect: (id: string | null) => void
    previewData: any[]
    branding?: {
        name: string
        color: string
        logoUrl?: string
    }
}

export function BuilderCanvas({ widgets, selectedId, onSelect, previewData, branding }: BuilderCanvasProps) {
    const { setNodeRef } = useDroppable({
        id: 'canvas_main',
        data: { isCanvas: true }
    })

    return (
        <div
            className="flex-1 overflow-hidden relative flex flex-col font-sans"
            onClick={() => onSelect(null)}
        >
            {/* 
                --- PREVIEW AREA (Simulating app/dashboard/layout.tsx) --- 
            */}
            <div className="flex-1 flex flex-col h-full overflow-hidden relative transition-colors duration-500 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100 via-slate-50 to-white dark:from-[#0a0a0a] dark:via-[#0a0a0a] dark:to-[#1e1e1e]">

                {/* Header Simulation (Matches app/dashboard/layout.tsx) */}
                <header className="bg-transparent relative z-50 px-6 py-4 flex items-center justify-between shrink-0">
                    {/* Logo & Title */}
                    <div className="flex items-center gap-12">
                        <div className="flex items-center space-x-3">
                            {branding?.logoUrl ? (
                                <img src={branding.logoUrl} alt="Logo" className="w-10 h-10 object-contain rounded-xl bg-white/50 backdrop-blur-sm shadow-sm" />
                            ) : (
                                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-sm">
                                    {branding?.name?.charAt(0) || 'T'}
                                </div>
                            )}
                            <span className="text-lg font-bold text-slate-700 dark:text-slate-200 hidden sm:block tracking-tight">
                                Area Personale
                            </span>
                        </div>
                    </div>

                    {/* Right Actions Simulation - Disabled visuals for preview */}
                    <div className="flex items-center gap-4 opacity-50 pointer-events-none">
                        <div className="w-10 h-10 rounded-xl bg-white/50 dark:bg-white/10 border border-white/20 dark:border-white/5 flex items-center justify-center">
                            <div className="w-4 h-4 rounded-full bg-slate-400" />
                        </div>
                        <div className="px-5 py-2.5 rounded-xl bg-red-50/50 text-red-500 border border-red-100 font-bold text-sm flex items-center gap-2">
                            <LogOut size={16} /> Esci
                        </div>
                    </div>
                </header>

                {/* Main Content Area (Matches app/dashboard layout max-width and padding) */}
                <div className="flex-1 overflow-y-auto relative z-10 pt-8 px-4 sm:px-6 lg:px-8 pb-12">
                    <div className="max-w-[1600px] mx-auto h-full flex flex-col">

                        {/* 
                            Droppable Canvas 
                            We use min-h-[600px] to ensure there's always space to drop
                        */}
                        <div
                            ref={setNodeRef}
                            className={`flex-1 border-2 border-dashed rounded-[2.5rem] p-8 transition-all duration-500
                                ${widgets.length === 0
                                    ? 'border-indigo-300 bg-white/40 dark:border-indigo-500/30 dark:bg-indigo-500/5 shadow-2xl shadow-indigo-500/5'
                                    : 'border-transparent'
                                }
                            `}
                        >
                            {widgets.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 py-48 animate-in fade-in zoom-in duration-700">
                                    <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-500/10 rounded-3xl flex items-center justify-center mb-8 shadow-xl shadow-indigo-500/10">
                                        <Plus size={40} className="text-indigo-500" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Workspace Vuoto</h3>
                                    <p className="text-sm opacity-60 max-w-xs text-center">Trascina i widget dalla libreria per comporre la pagina del cliente.</p>
                                </div>
                            ) : (
                                <SortableContext items={widgets.map(w => w.id)} strategy={rectSortingStrategy}>
                                    <div className="grid grid-cols-12 gap-8">
                                        {widgets.map(widget => (
                                            <CanvasWidget
                                                key={widget.id}
                                                widget={widget}
                                                selected={widget.id === selectedId}
                                                onSelect={(e) => {
                                                    e.stopPropagation()
                                                    onSelect(widget.id)
                                                }}
                                                previewData={previewData}
                                            />
                                        ))}
                                    </div>
                                </SortableContext>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
