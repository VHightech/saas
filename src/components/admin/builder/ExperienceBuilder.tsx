'use client'

import React, { useState } from 'react'
import { DndContext, DragEndEvent, DragOverlay, useSensor, useSensors, PointerSensor, KeyboardSensor } from '@dnd-kit/core'
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable'
import { BuilderWidget } from './builder-types'
import { WidgetLibrary, LibraryItemCard } from './WidgetLibrary'
import { BuilderCanvas } from './BuilderCanvas'
import { CanvasWidget } from './CanvasWidget'
import { PropertyPanel } from './PropertyPanel'
import { WIDGET_REGISTRY } from './widget-registry'
import { DataMapper } from '../data-mapper'
import { Database, LayoutDashboard, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DragStartEvent } from '@dnd-kit/core'

interface ExperienceBuilderProps {
    onConfigChange: (config: any) => void
    initialData?: any[]
    initialMapping?: Record<string, string>
    branding?: {
        name: string
        color: string
        logoUrl?: string
    }
}

export function ExperienceBuilder({ onConfigChange, initialData = [], initialMapping = {}, branding }: ExperienceBuilderProps) {
    const [widgets, setWidgets] = useState<BuilderWidget[]>([])
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [previewData, setPreviewData] = useState<any[]>([])
    const [headers, setHeaders] = useState<string[]>([])
    const [activeDragItem, setActiveDragItem] = useState<any>(null)

    // Internal Upload State (Used if no initialData provided)
    const [mapping, setMapping] = useState<any>({})

    // Initialize Data from Props
    React.useEffect(() => {
        if (initialData.length > 0) {
            let processedData = [...initialData]

            // Apply Semantic Mapping if available
            // This adds keys like 'amount' or 'cif' to the row based on the mapped column
            if (Object.keys(initialMapping).length > 0) {
                processedData = initialData.map(row => {
                    const newRow = { ...row }
                    Object.entries(initialMapping).forEach(([key, sourceCol]) => {
                        if (sourceCol && row[sourceCol] !== undefined) {
                            // Add the semantic key (e.g. 'amount' = 100)
                            // We use the key itself as the column name for binding
                            newRow[key] = row[sourceCol]
                        }
                    })
                    return newRow
                })
            }

            setPreviewData(processedData)

            // Prioritize semantic keys in headers if they exist
            if (processedData.length > 0) {
                const keys = Object.keys(processedData[0])
                setHeaders(keys)
            }
        }
    }, [initialData, initialMapping])

    // Config Sync
    React.useEffect(() => {
        onConfigChange({
            widgets,
            // Include effective mapping if needed
        })
    }, [widgets, onConfigChange])

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    const handleDragStart = (event: DragStartEvent) => {
        setActiveDragItem(event.active)
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        setActiveDragItem(null)

        if (!over) return

        // 1. Dragging from Library
        if (String(active.id).startsWith('lib_')) {
            if (over.id === 'canvas_main' || widgets.some(w => w.id === over.id)) {
                // Add new widget
                const type = active.data.current?.type
                const def = WIDGET_REGISTRY[type]

                const newWidget: BuilderWidget = {
                    id: `widget_${Date.now()}`,
                    type: type,
                    x: 0,
                    y: 0,
                    w: def.defaultW,
                    h: def.defaultH,
                    mappings: {},
                    title: def.label
                }

                setWidgets(prev => [...prev, newWidget])
                setSelectedId(newWidget.id)
            }
            return
        }

        // 2. Reordering on Canvas
        if (active.id !== over.id) {
            setWidgets((items) => {
                const oldIndex = items.findIndex(i => i.id === active.id)
                const newIndex = items.findIndex(i => i.id === over.id)
                return arrayMove(items, oldIndex, newIndex)
            })
        }
    }

    const handleWidgetUpdate = (id: string, updates: Partial<BuilderWidget>) => {
        setWidgets(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w))
    }

    const handleDelete = (id: string) => {
        setWidgets(prev => prev.filter(w => w.id !== id))
        if (selectedId === id) setSelectedId(null)
    }

    const [isPreview, setIsPreview] = useState(false)

    // Extract headers for Property Panel
    React.useEffect(() => {
        if (previewData.length > 0) {
            setHeaders(Object.keys(previewData[0]))
        }
    }, [previewData])

    const selectedWidget = widgets.find(w => w.id === selectedId) || null
    const activeWidgetDef = activeDragItem?.data?.current?.widgetDef
    const activeCanvasWidget = widgets.find(w => w.id === activeDragItem?.id)

    return (
        <div className="flex flex-col h-[85vh] border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden bg-white dark:bg-[#0a0a0a] shadow-2xl relative">

            {/* BUILDER HEADER / TOOLBAR */}
            <div className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 px-6 py-3 flex items-center justify-between z-30">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                        <LayoutDashboard size={18} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Dashboard Builder</p>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white leading-none">Personalizzazione Dashboard</h3>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setIsPreview(!isPreview)}
                        className={cn(
                            "px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                            isPreview
                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                                : "bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-slate-50"
                        )}
                    >
                        {isPreview ? <EyeOff size={16} /> : <Eye size={16} />}
                        {isPreview ? "Esci Preview" : "Anteprima Full"}
                    </button>
                </div>
            </div>

            {/* Builder Area */}
            <div className="flex-1 flex overflow-hidden">
                <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>

                    {/* Left: Library (Hidden in Preview) */}
                    {!isPreview && <WidgetLibrary />}

                    {/* Center: Canvas */}
                    <BuilderCanvas
                        widgets={widgets}
                        selectedId={isPreview ? null : selectedId} // No selection in preview
                        onSelect={setSelectedId}
                        previewData={previewData}
                        branding={branding}
                    />

                    {/* Right: Properties (Hidden in Preview) */}
                    {!isPreview && (
                        <PropertyPanel
                            widget={selectedWidget}
                            headers={headers}
                            onChange={handleWidgetUpdate}
                            onDelete={handleDelete}
                            onClose={() => setSelectedId(null)}
                        />
                    )}

                    <DragOverlay>
                        {activeWidgetDef ? (
                            <LibraryItemCard widget={activeWidgetDef} className="shadow-2xl ring-2 ring-indigo-500 bg-white w-[240px]" />
                        ) : activeCanvasWidget ? (
                            <div className="opacity-80 w-[300px]">
                                <CanvasWidget
                                    widget={activeCanvasWidget}
                                    selected={false}
                                    onSelect={() => { }}
                                    previewData={previewData}
                                />
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </div>
        </div>
    )
}
