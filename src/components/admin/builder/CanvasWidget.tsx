'use client'

import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { BuilderWidget } from './builder-types'
import { WIDGET_REGISTRY } from './widget-registry'
import { MoreVertical, GripVertical, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CanvasWidgetRenderer } from './CanvasWidgetRenderer'

interface CanvasWidgetProps {
    widget: BuilderWidget
    selected: boolean
    onSelect: (e: React.MouseEvent) => void
    previewData: any[]
}

export function CanvasWidget({ widget, selected, onSelect, previewData }: CanvasWidgetProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: widget.id, data: { widget } })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        gridColumn: `span ${widget.w}`,
        gridRow: `span ${widget.h}`,
        opacity: isDragging ? 0.5 : 1
    }

    const def = WIDGET_REGISTRY[widget.type]

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={onSelect}
            className={cn(
                "relative group rounded-3xl transition-all overflow-hidden flex flex-col",
                selected
                    ? "ring-4 ring-indigo-500 z-20 shadow-2xl scale-[1.01]"
                    : "hover:ring-2 hover:ring-indigo-300/50"
            )}
        >
            {/* Drag Handle & Toolbar */}
            <div className={cn(
                "absolute top-2 right-2 flex items-center gap-1 z-30 transition-opacity",
                selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}>
                <div {...attributes} {...listeners} className="p-1.5 bg-slate-100 dark:bg-white/10 rounded-lg cursor-grab hover:text-indigo-500">
                    <GripVertical size={14} />
                </div>
                {/* <button className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100">
                    <Trash2 size={14} />
                </button> */}
            </div>

            {/* Content Renderer */}
            <div className="flex-1 p-4 overflow-hidden">
                <CanvasWidgetRenderer widget={widget} data={previewData} />
            </div>

            {/* Overlay for selection target */}
            {!selected && <div className="absolute inset-0 z-10" />}
        </div>
    )
}
