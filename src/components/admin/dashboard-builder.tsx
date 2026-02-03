'use client'

import React, { useState } from 'react';
import {
    DndContext,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
    DragStartEvent,
    DragOverEvent,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

// --- Types ---

export type WidgetId =
    | 'user_widget'
    | 'consumption_chart'
    | 'expenses_chart'
    | 'recent_bills'
    | 'admin_stats'
    | 'admin_shortcuts'
    | 'recent_uploads';

export interface DashboardLayout {
    left: WidgetId[];
    right: WidgetId[];
}

export type DashboardRole = 'admin' | 'user';

export interface RoleBasedLayouts {
    admin: DashboardLayout;
    user: DashboardLayout;
}

const WIDGET_LABELS: Record<WidgetId, string> = {
    user_widget: 'User Info Card',
    consumption_chart: 'Consumption Chart',
    expenses_chart: 'Expenses Trend Chart',
    recent_bills: 'Recent Bills Table',
    admin_stats: 'Admin Overview Stats',
    admin_shortcuts: 'Quick Actions (Admin)',
    recent_uploads: 'Recent Uploads Log'
};

// --- Sortable Item Component ---

function SortableItem({ id }: { id: WidgetId }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`
        flex items-center gap-3 p-4 bg-white dark:bg-white/5 
        border border-slate-200 dark:border-white/10 rounded-lg shadow-sm 
        cursor-grab active:cursor-grabbing hover:border-indigo-400 dark:hover:border-indigo-500/50 transition-colors
        ${isDragging ? 'ring-2 ring-indigo-500 ring-opacity-50 z-50' : ''}
      `}
        >
            <div {...attributes} {...listeners} className="text-slate-400 cursor-grab hover:text-indigo-500">
                <GripVertical size={20} />
            </div>
            <div className="flex-1">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{WIDGET_LABELS[id]}</h4>
                <p className="text-[10px] text-slate-400 font-mono">{id}</p>
            </div>
        </div>
    );
}

// --- Main Builder Component ---

interface DashboardBuilderProps {
    initialLayouts?: RoleBasedLayouts;
    onChange: (layouts: RoleBasedLayouts) => void;
}

export function DashboardBuilder({ initialLayouts, onChange }: DashboardBuilderProps) {
    const [activeRole, setActiveRole] = useState<DashboardRole>('admin');

    const [layouts, setLayouts] = useState<RoleBasedLayouts>(
        initialLayouts || {
            admin: {
                left: ['user_widget', 'consumption_chart', 'expenses_chart'],
                right: ['recent_bills'],
            },
            user: {
                left: ['user_widget', 'consumption_chart', 'expenses_chart'],
                right: ['recent_bills'],
            }
        }
    );

    const [activeId, setActiveId] = useState<WidgetId | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Get current layout for active role
    const currentLayout = layouts[activeRole];

    function findContainer(id: WidgetId | string): keyof DashboardLayout | undefined {
        if ((id as string) in currentLayout) {
            return id as keyof DashboardLayout;
        }
        return (Object.keys(currentLayout) as Array<keyof DashboardLayout>).find((key) =>
            currentLayout[key].includes(id as WidgetId)
        );
    }

    function handleDragStart(event: DragStartEvent) {
        setActiveId(String(event.active.id) as WidgetId);
    }

    function handleDragOver(event: DragOverEvent) {
        const { active, over } = event;
        const overId = over?.id;

        if (!overId || active.id === overId) {
            return;
        }

        const activeContainer = findContainer(String(active.id));
        const overContainer = findContainer(String(overId));

        if (
            !activeContainer ||
            !overContainer ||
            activeContainer === overContainer
        ) {
            return;
        }

        setLayouts((prevLayouts) => {
            const prev = prevLayouts[activeRole];
            const activeItems = prev[activeContainer];
            const overItems = prev[overContainer];
            const activeIndex = activeItems.indexOf(String(active.id) as WidgetId);
            const overIndex = overItems.indexOf(String(overId) as WidgetId);

            let newIndex;
            if (overId in prev) {
                newIndex = overItems.length + 1;
            } else {
                const isBelowOverItem =
                    over &&
                    active.rect.current.translated &&
                    active.rect.current.translated.top >
                    over.rect.top + over.rect.height;

                const modifier = isBelowOverItem ? 1 : 0;
                newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
            }

            const newRoleLayout = {
                ...prev,
                [activeContainer]: [
                    ...prev[activeContainer].filter((item) => item !== String(active.id)),
                ],
                [overContainer]: [
                    ...prev[overContainer].slice(0, newIndex),
                    prev[activeContainer][activeIndex],
                    ...prev[overContainer].slice(newIndex, prev[overContainer].length),
                ],
            };

            return { ...prevLayouts, [activeRole]: newRoleLayout };
        });
    }

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        const activeContainer = findContainer(String(active.id));
        const overContainer = findContainer(String(over?.id || ''));

        if (
            activeContainer &&
            overContainer &&
            activeContainer === overContainer
        ) {
            const activeIndex = currentLayout[activeContainer].indexOf(String(active.id) as WidgetId);
            const overIndex = currentLayout[overContainer].indexOf(String(over?.id) as WidgetId);

            if (activeIndex !== overIndex) {
                setLayouts((prevLayouts) => {
                    const prev = prevLayouts[activeRole];
                    const newRoleLayout = {
                        ...prev,
                        [activeContainer]: arrayMove(
                            prev[activeContainer],
                            activeIndex,
                            overIndex
                        ),
                    };
                    const newLayouts = { ...prevLayouts, [activeRole]: newRoleLayout };
                    onChange(newLayouts);
                    return newLayouts;
                });
            } else {
                onChange(layouts);
            }
        } else {
            onChange(layouts);
        }

        setActiveId(null);
    }

    const dropAnimation = {
        sideEffects: defaultDropAnimationSideEffects({
            styles: {
                active: {
                    opacity: '0.4',
                },
            },
        }),
    };

    return (
        <div>
            {/* Role Switcher */}
            <div className="flex p-1 mb-4 bg-slate-100 dark:bg-white/5 rounded-lg">
                {(['admin', 'user'] as DashboardRole[]).map((role) => (
                    <button
                        key={role}
                        type="button"
                        onClick={() => setActiveRole(role)}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeRole === role
                            ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                    >
                        {role === 'admin' ? 'Admin View' : 'User View'}
                    </button>
                ))}
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
            >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Left Column</h3>
                        <div className="bg-slate-50 dark:bg-white/5 rounded-xl border border-dashed border-slate-300 dark:border-white/20 min-h-[300px] p-4">
                            <SortableContext
                                id="left"
                                items={currentLayout.left}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="space-y-3">
                                    {currentLayout.left.map((id) => (
                                        <SortableItem key={id} id={id} />
                                    ))}
                                </div>
                            </SortableContext>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Right Column</h3>
                        <div className="bg-slate-50 dark:bg-white/5 rounded-xl border border-dashed border-slate-300 dark:border-white/20 min-h-[300px] p-4">
                            <SortableContext
                                id="right"
                                items={currentLayout.right}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="space-y-3">
                                    {currentLayout.right.map((id) => (
                                        <SortableItem key={id} id={id} />
                                    ))}
                                </div>
                            </SortableContext>
                        </div>
                    </div>
                </div>

                <DragOverlay dropAnimation={dropAnimation}>
                    {activeId ? <SortableItem id={activeId} /> : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
}
