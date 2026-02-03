'use client'

import React from 'react'
import { UserWidget } from '@/components/dashboard/widgets/UserWidget'
import { ConsumptionChart } from '@/components/dashboard/widgets/ConsumptionChart'
import { RecentBillsWidget } from '@/components/dashboard/widgets/RecentBillsWidget'
import { ExpensesTrendChart } from '@/components/dashboard/widgets/ExpensesTrendChart'
import { MobileCollapsibleCard } from '@/components/dashboard/MobileCollapsibleCard'
import { Profile, Bill, UploadLog } from '@/types/dashboard'
import { DashboardLayout, WidgetId } from '@/components/admin/dashboard-builder'
import { AdminShortcuts } from '@/components/dashboard/widgets/admin-shortcuts'
import { AdminStats } from '@/components/dashboard/widgets/admin-stats'
import { RecentUploads } from '@/components/dashboard/widgets/recent-uploads'
import { cn } from '@/lib/utils'

interface DashboardRendererProps {
    layout: DashboardLayout
    profile: Profile
    bills: Bill[]
    stats: {
        lastConsumption: number
        percentageBadge: React.ReactNode
        fullName: string
        firstName: string
        clientCode: string
        fiscalCode?: string
        address?: string
        email?: string
    }
    adminStats?: {
        totalUsers: number
        totalBills: number
        storageUsed: string
        activeSessions: number
    }
    uploads?: UploadLog[]
}

export function DashboardRenderer({ layout, profile, bills, stats, adminStats, uploads }: DashboardRendererProps) {

    // Helper to render a specific widget
    const renderWidget = (widgetOrId: WidgetId | any) => {
        const id = typeof widgetOrId === 'string' ? widgetOrId : widgetOrId.type
        const widget = typeof widgetOrId === 'object' ? widgetOrId : { type: id, settings: {}, mappings: {} }
        const settings = widget.settings || {}

        // Data Resolution Helper
        const getMappedValue = (fieldName: string, fallback: string | number) => {
            const m = widget.mappings?.[fieldName]
            if (!m) return fallback
            if (m.staticValue) return m.staticValue
            if (m.sourceColumn && bills.length > 0) {
                // If the column name matches a property in the first bill (most recent)
                const val = bills[0][m.sourceColumn as keyof Bill]
                if (val !== undefined && val !== null) return val
            }
            return fallback
        }

        switch (id) {
            case 'admin_stats':
                return <AdminStats stats={adminStats} />

            case 'admin_shortcuts':
                return <AdminShortcuts />

            case 'recent_uploads':
                return <RecentUploads uploads={uploads as any} />

            case 'user_profile':
            case 'user_widget':
                const showWelcome = settings.show_welcome ?? true
                const bgStyle = settings.bg_style || 'Vetro (Light)'

                // Resolve mapped values
                const resolvedName = getMappedValue('name', stats.fullName) as string
                const resolvedCode = getMappedValue('client_code', stats.clientCode) as string
                const resolvedFiscal = getMappedValue('fiscal_code', stats.fiscalCode || 'N/A') as string
                const resolvedAddress = getMappedValue('address', stats.address || 'Nessun indirizzo') as string

                const isDarkStyle = bgStyle === 'Vetro (Dark)' || bgStyle === 'Solido Blue'

                return (
                    <MobileCollapsibleCard
                        title={
                            <div className="flex flex-col items-start leading-tight">
                                {showWelcome && <span className={cn(
                                    "text-sm font-medium",
                                    isDarkStyle ? "text-blue-100/80" : "text-slate-500 dark:text-slate-400"
                                )}>Bentornato,</span>}
                                <span className={cn(
                                    "text-2xl font-bold",
                                    isDarkStyle ? "text-white" : "text-slate-900 dark:text-white"
                                )}>{stats.firstName}!</span>
                            </div>
                        }
                        className={cn(
                            "h-full",
                            bgStyle === 'Solido Blue' && "bg-[#005A9C] border-blue-400/30",
                            bgStyle === 'Vetro (Dark)' && "bg-[#1e1e1e]/60 border-white/10"
                        )}
                        defaultOpen={false}
                        headerContent={
                            <div className="flex items-center gap-2 mt-1">
                                <span className={cn(
                                    "text-sm font-semibold",
                                    isDarkStyle ? "text-white" : "text-slate-700 dark:text-slate-200"
                                )}>{resolvedName}</span>
                                <span className="text-xs text-slate-400">•</span>
                                <span className={cn(
                                    "text-xs font-mono",
                                    isDarkStyle ? "text-blue-200" : "text-slate-500 dark:text-slate-400"
                                )}>{resolvedCode}</span>
                            </div>
                        }
                    >
                        <UserWidget
                            settings={settings}
                            externalData={{
                                name: resolvedName,
                                client_code: resolvedCode,
                                fiscal_code: resolvedFiscal,
                                address: resolvedAddress
                            }}
                        />
                    </MobileCollapsibleCard>
                )

            case 'consumption_chart':
                const showPercentage = settings.show_percentage ?? true
                const resolvedConsumption = getMappedValue('last_consumption', stats.lastConsumption) as number

                return (
                    <MobileCollapsibleCard
                        title="Consumo Medio Mensile"
                        className="h-full"
                        headerContent={
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {resolvedConsumption > 0 ? `${resolvedConsumption} Mc` : 'Nessun dato'}
                                </span>
                                {showPercentage && stats.percentageBadge}
                            </div>
                        }
                    >
                        <ConsumptionChart settings={settings} initialData={bills} />
                    </MobileCollapsibleCard>
                )

            case 'expenses_chart':
                return (
                    <div className="h-auto md:h-[300px]">
                        <MobileCollapsibleCard
                            title="Grafico Consumi"
                            className="h-full"
                            defaultOpen={false}
                            headerContent={
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Ultimi 5 Anni</span>
                                    <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400">{bills.length > 0 ? 'Vedi dettagli' : 'Nessun dato'}</span>
                                </div>
                            }
                        >
                            <ExpensesTrendChart bills={bills} />
                        </MobileCollapsibleCard>
                    </div>
                )

            case 'recent_bills':
                return (
                    <div className="h-[calc(100vh-140px)] max-h-[700px]">
                        <RecentBillsWidget settings={settings} initialData={bills} />
                    </div>
                )

            default:
                return null
        }
    }

    // --- NEW DYNAMIC GRID RENDERER ---
    if ((layout as any).widgets && Array.isArray((layout as any).widgets)) {
        const dynamicWidgets = (layout as any).widgets;
        return (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 fade-in-up">
                {dynamicWidgets.map((w: any) => (
                    <div
                        key={w.id}
                        className={w.w ? `md:col-span-${w.w}` : 'col-span-1 md:col-span-12'}
                        style={{
                            // Keep gridRow if h is provided
                            gridRow: w.h ? `span ${w.h}` : undefined
                        }}
                    >
                        {renderWidget(w)}
                    </div>
                ))}
            </div>
        )
    }

    // --- LEGACY COLUMN RENDERER ---
    return (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 fade-in-up">
            {/* Left Column Group - Now taking 50% total (6/12) */}
            <div className="md:col-span-6 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {layout.left.map(widgetId => {
                        const isExpenses = widgetId === 'expenses_chart'
                        return (
                            <div key={widgetId} className={cn(
                                "h-full",
                                isExpenses ? "lg:col-span-2" : "lg:col-span-1"
                            )}>
                                {renderWidget(widgetId)}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Right Column Group - Now taking 50% (6/12) */}
            <div className="md:col-span-6 space-y-6">
                <div className="grid grid-cols-1 gap-6">
                    {layout.right.map(widgetId => (
                        <div key={widgetId} className="h-full">
                            {renderWidget(widgetId)}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
