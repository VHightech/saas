'use client'

/**
 * Dashboard shell — the main layout that composes everything.
 * Drop into src/components/dashboard/DashboardShell.tsx
 *
 * Responsive: single-column on mobile, 3-column on desktop. Sidebar becomes
 * a Sheet on mobile (needs shadcn/ui Sheet).
 */

import * as React from 'react'
import type { Bill, Profile } from '@/types/dashboard'
import type {
    Supply, AppNotification, ConsumptionAlert, DashboardStats,
} from '@/types/dashboard-extended'
import { StatsGrid } from './StatsGrid'
import { ConsumptionChart } from './ConsumptionChart'
import { BillsList } from './BillsList'
import { BillDrawer } from './BillDrawer'
import { AlertsWidget } from './AlertsWidget'
import { SupplySwitcher } from './SupplySwitcher'
import { NotificationsMenu } from './NotificationsMenu'
import { CommandPalette } from './CommandPalette'
import { useSupply } from '@/hooks/use-supply'
import { useConsumption } from '@/hooks/use-consumption'
import { billsForSupply, computeStats } from '@/lib/supply'

export interface DashboardShellProps {
    profile: Profile
    bills: Bill[]
    supplies: Supply[]
    notifications: AppNotification[]
    alerts: ConsumptionAlert[]
    onPayBill?: (bill: Bill) => void
    onDownloadBill?: (bill: Bill) => void
    onMarkNotificationRead?: (id: string) => void
    onMarkAllNotificationsRead?: () => void
    onNavigate?: (href: string) => void
}

export function DashboardShell(props: DashboardShellProps) {
    const { selected, setSupply } = useSupply(props.supplies)
    const [period, setPeriod] = React.useState<'1M' | '3M' | '6M' | '1Y'>('1Y')
    const [metric, setMetric] = React.useState<'volume' | 'cost'>('volume')
    const [drawerBill, setDrawerBill] = React.useState<Bill | null>(null)

    const billsForActive = selected ? billsForSupply(props.bills, selected) : props.bills
    const consumption = useConsumption(billsForActive, 12)
    const stats = computeStats(billsForActive)

    const fullStats: DashboardStats = {
        ...stats,
        trendLabel: 'Trend stabile',
        fullName: [props.profile.name, (props.profile as { surname?: string }).surname].filter(Boolean).join(' ') || props.profile.email || '',
        firstName: props.profile.name ?? '',
        clientCode: props.profile.codice_cliente ?? 'N/A',
        fiscalCode: (props.profile as { cif?: string }).cif ?? 'N/A',
        address: props.profile.address ?? '',
        email: props.profile.email ?? '',
    }

    return (
        <div className="min-h-screen bg-[var(--acq-bg)]">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-[var(--acq-surface)]/80 backdrop-blur border-b border-[var(--acq-ink-soft)]">
                <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center gap-3">
                    <div className="font-[var(--acq-font-display)] text-xl tracking-tight text-[var(--acq-ink)]">acqua</div>
                    <div className="hidden md:block w-px h-6 bg-[var(--acq-ink-soft)] mx-2" />
                    <SupplySwitcher supplies={props.supplies} selected={selected} onSelect={setSupply} />
                    <div className="flex-1" />
                    <button
                        onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
                        className="hidden md:flex items-center gap-2 px-3 h-9 rounded-lg border border-[var(--acq-ink-soft)] text-xs text-[var(--acq-ink-sub)] hover:bg-[var(--acq-ink-soft)]">
                        Cerca…
                        <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--acq-ink-soft)]">⌘K</kbd>
                    </button>
                    <NotificationsMenu
                        notifications={props.notifications}
                        onMarkAllRead={props.onMarkAllNotificationsRead}
                        onMarkRead={props.onMarkNotificationRead}
                        onNavigate={props.onNavigate}
                    />
                </div>
            </header>

            {/* Main */}
            <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10">
                {/* Hero greeting */}
                <div className="mb-6 md:mb-10">
                    <div className="text-xs font-semibold tracking-wider uppercase text-[var(--acq-ink-sub)]">
                        Ciao, {fullStats.firstName || 'utente'}
                    </div>
                    <h1 className="font-[var(--acq-font-display)] text-3xl md:text-5xl tracking-tight text-[var(--acq-ink)] mt-1">
                        La tua dashboard acqua
                    </h1>
                </div>

                <StatsGrid stats={fullStats} />

                <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <ConsumptionChart
                            data={consumption}
                            period={period} onPeriodChange={setPeriod}
                            metric={metric} onMetricChange={setMetric}
                        />
                        <BillsList
                            bills={billsForActive}
                            onOpen={setDrawerBill}
                            onPay={props.onPayBill}
                        />
                    </div>
                    <div className="space-y-6">
                        <AlertsWidget alerts={props.alerts} />
                    </div>
                </div>
            </main>

            <BillDrawer
                open={!!drawerBill}
                onOpenChange={(v) => { if (!v) setDrawerBill(null) }}
                bill={drawerBill}
                onPay={props.onPayBill}
                onDownload={props.onDownloadBill}
            />

            <CommandPalette
                bills={props.bills}
                supplies={props.supplies}
                onNavigate={(href) => props.onNavigate?.(href)}
                onOpenBill={setDrawerBill}
                onSwitchSupply={setSupply}
            />
        </div>
    )
}
