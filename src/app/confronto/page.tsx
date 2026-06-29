import { getUserDashboardData } from '@/actions/user-data'
import { DashboardProvider } from '@/components/dashboard/dashboard-context'
import { ConfrontoView } from '@/components/dashboard/desktop/ConfrontoView'
import React from 'react'

export default async function ConfrontoPage() {
    const data = await getUserDashboardData()

    if ('error' in data) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
                <div className="bg-white p-8 rounded-2xl shadow-xl border border-red-100 text-center max-w-md">
                    <h2 className="text-xl font-bold text-red-600 mb-2">Errore di Caricamento</h2>
                    <p className="text-slate-600 mb-6">{data.error}</p>
                    <a href="/login" className="inline-block px-6 py-2 bg-slate-900 text-white rounded-lg font-bold">Torna al Login</a>
                </div>
            </div>
        )
    }

    const { bills, supplies } = data

    return (
        <DashboardProvider>
            <ConfrontoView bills={bills as any} supplies={supplies as any} />
        </DashboardProvider>
    )
}
