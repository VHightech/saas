import { getUserDashboardData } from '@/actions/user-data'
import { DashboardRenderer } from '@/components/dashboard/dashboard-renderer'
import { DashboardProvider } from '@/components/dashboard/dashboard-context'
import React from 'react'

export default async function ProfilePage() {
    const data = await getUserDashboardData()

    if ('error' in data) {
        console.error('Dashboard Data Error:', data.error)
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

    const { profile, bills, supplies } = data

    // Prepare Stats for DashboardRenderer
    const latestBill = bills[0]
    const lastConsumption = latestBill?.consumo || 0
    
    // Simple logic for the badge: compare with average
    const avgConsumption = bills.length > 0 
        ? bills.reduce((s, b) => s + (b.consumo || 0), 0) / bills.length 
        : 0
    const diff = lastConsumption - avgConsumption
    const isUp = diff > 0
    const percent = avgConsumption > 0 ? Math.abs((diff / avgConsumption) * 100).toFixed(0) : '0'

    const stats = {
        lastConsumption,
        percentageBadge: (
            <span key="percentage-badge" className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isUp ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                {isUp ? '↑' : '↓'} {percent}%
            </span>
        ),
        fullName: profile.name || 'Cliente Acquambiente',
        firstName: (profile.name || '').split(' ')[0] || 'Cliente',
        clientCode: profile.codice_cliente || '-',
        fiscalCode: profile.cfpi || profile.cif || '-',
        address: profile.address || '-',
        email: profile.email || '-',
        phone: profile.phone || '-',
    }

    return (
        <DashboardProvider>
            <DashboardRenderer
                profile={profile as any}
                bills={bills as any}
                supplies={supplies as any}
                stats={stats}
            />
        </DashboardProvider>
    )
}
