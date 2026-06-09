import { getUserDashboardData } from '@/actions/user-data'
import { ProfiloView } from '@/components/dashboard/desktop/ProfiloView'
import React from 'react'

export default async function ProfiloInfoPage() {
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

    const { profile, supplies } = data
    const stats = {
        fullName: profile.name || 'Cliente Acquambiente',
        firstName: (profile.name || '').split(' ')[0] || 'Cliente',
        clientCode: profile.codice_cliente || '-',
        fiscalCode: (profile as any).codice_fiscale || (profile as any).partita_iva || profile.cif || '-',
        address: profile.address || '-',
        email: profile.email || '-',
        phone: (profile as any).phone || '-',
    }

    return <ProfiloView profile={profile as any} stats={stats} supplies={supplies as any} />
}
