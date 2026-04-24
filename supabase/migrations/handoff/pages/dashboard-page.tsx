// Example replacement for src/app/dashboard/page.tsx
// Drop this as-is when you've copied all the handoff components into src/.

import { createClient } from '@/lib/supabase/server'
import { getUserDashboardData } from '@/actions/user-data'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import {
    listUserSupplies,
    listUserNotifications,
    listOpenAlerts,
} from '@/actions/dashboard-actions' // handoff/fetch-examples/server-actions.ts
import { suppliesFromBills } from '@/lib/supply'

export default async function DashboardPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        // middleware dovrebbe già redirectare, ma per sicurezza:
        return null
    }

    const [dash, suppliesRaw, notifications, alerts] = await Promise.all([
        getUserDashboardData(),
        listUserSupplies().catch(() => []),
        listUserNotifications(20).catch(() => []),
        listOpenAlerts().catch(() => []),
    ])

    if (dash.error || !dash.profile) {
        return <div className="p-8 text-center">Errore caricamento dati: {dash.error}</div>
    }

    // Fallback: se non hai ancora popolato user_supplies, deriva dalle bollette
    const supplies = suppliesRaw.length > 0 ? suppliesRaw : suppliesFromBills(dash.bills ?? [])

    return (
        <DashboardShell
            profile={dash.profile}
            bills={dash.bills ?? []}
            supplies={supplies}
            notifications={notifications}
            alerts={alerts}
            onPayBill={async (bill) => {
                'use server'
                // Chiama payment-actions.ts → PagoPA
                // const { redirect_url } = await startPagoPaPayment(bill.id)
                // return redirect(redirect_url)
            }}
            onDownloadBill={async (bill) => {
                'use server'
                // Genera presigned R2 URL per bill.nome_pdf
            }}
        />
    )
}
