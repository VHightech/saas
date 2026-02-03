'use client'

import React from 'react'
import { useDraggable } from '@dnd-kit/core'
import { WIDGET_REGISTRY } from './widget-registry'
import { LayoutTemplate, Table, LineChart, User, GripVertical } from 'lucide-react'
import { WidgetDefinition } from './builder-types'

// Icon Map
const ICONS: Record<string, any> = {
    LayoutTemplate, Table, LineChart, User
}

export function WidgetLibrary() {
    return (
        <div className="bg-white dark:bg-[#111] border-r border-slate-200 dark:border-white/10 h-full flex flex-col w-[240px]">
            <div className="p-4 border-b border-slate-200 dark:border-white/10">
                <h3 className="font-bold text-slate-800 dark:text-white">Components</h3>
                <p className="text-xs text-slate-500">Drag to canvas</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {Object.values(WIDGET_REGISTRY).map(widget => (
                    <DraggableLibraryItem key={widget.type} widget={widget} />
                ))}
            </div>
        </div>
    )
}

export function LinkIcon({ iconName, size = 18, className }: { iconName: string, size?: number, className?: string }) {
    const Icon = ICONS[iconName] || LayoutTemplate
    return <Icon size={size} className={className} />
}

export function LibraryItemCard({ widget, className }: { widget: WidgetDefinition, className?: string }) {
    return (
        <div className={`flex items-center gap-3 p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl cursor-grab hover:border-indigo-400 hover:shadow-md transition-all group z-50 relative ${className}`}>
            <div className="p-2 bg-white dark:bg-black/20 rounded-lg text-slate-500 group-hover:text-indigo-500 transition-colors">
                <LinkIcon iconName={widget.iconName} />
            </div>
            <div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{widget.label}</p>
                <p className="text-[10px] text-slate-400">{widget.defaultW}x{widget.defaultH} Blocks</p>
            </div>
        </div>
    )
}

function DraggableLibraryItem({ widget }: { widget: WidgetDefinition }) {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: `lib_${widget.type}`,
        data: {
            isLibraryItem: true,
            type: widget.type,
            widgetDef: widget
        }
    })

    // Eliminate transform style for library items as it causes visual glitching during drag start if not handled with overlay perfectly.
    // Actually, having overlay means we should KEEP the original in place?
    // dnd-kit default behavior: original moves if we use transform.
    // If we use DragOverlay, we usually want the original to stay or disappear?
    // Let's keep it simple: transform is applied, so it moves.
    // Ideally we want opacity to lower.

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: 0.5 // Dim original when dragging
    } : undefined

    return (
        <div ref={setNodeRef} {...listeners} {...attributes} style={style}>
            <LibraryItemCard widget={widget} />
        </div>
    )
}
