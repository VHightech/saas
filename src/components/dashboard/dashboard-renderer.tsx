'use client'

import React from 'react'
import { Profile, Bill, UploadLog } from '@/types/dashboard'
import { DashboardLayout } from '@/components/admin/dashboard-builder'
import { MobileShell } from '@/components/dashboard/mobile/MobileShell'
import { DesktopShell } from '@/components/dashboard/desktop/DesktopShell'
import { BolletteView } from '@/components/dashboard/desktop/BolletteView'
import { useDashboard } from '@/components/dashboard/dashboard-context'


interface UserSupply {
    codice_cliente?: string
    cif?: string
    address?: string
    city?: string
    ulm?: string
    [key: string]: any
}

interface DashboardRendererProps {
    layout: DashboardLayout
    profile: Profile
    bills: Bill[]
    supplies?: UserSupply[]
    stats: {
        lastConsumption: number
        percentageBadge: React.ReactNode
        fullName: string
        firstName: string
        clientCode: string
        fiscalCode?: string
        address?: string
        email?: string
        phone?: string
    }
    adminStats?: {
        totalUsers: number
        totalBills: number
        storageUsed: string
        activeSessions: number
    }
    uploads?: UploadLog[]
}

export function DashboardRenderer({ profile, bills: rawBills, supplies: rawSupplies = [], stats }: DashboardRendererProps) {
    const { setSupplies, selectedSupply } = useDashboard()

    // Build a stable matching id: prefer the full cif, fall back to ulm.
    // This is written back into `ulm` so every downstream component (mobile +
    // desktop) can keep using `b.ulm === s.ulm` for matching.
    const bills = React.useMemo(() => rawBills.map((b: any) => {
        const id = (b.cif ? b.cif.toString() : b.ulm) || ''
        return { ...b, ulm: id }
    }), [rawBills])

    const supplies = React.useMemo(() => rawSupplies.map((s: any) => {
        const id = (s.cif ? s.cif.toString() : s.ulm) || ''
        return { ...s, ulm: id }
    }), [rawSupplies])

    const uniqueSupplies = React.useMemo(() => {
        const set = new Set<string>()
        bills.forEach(b => {
            if (b.ulm) set.add(b.ulm)
        })
        return Array.from(set).sort()
    }, [bills])

    React.useEffect(() => {
        setSupplies(uniqueSupplies)
    }, [uniqueSupplies, setSupplies])

    const filteredBills = React.useMemo(() => {
        if (selectedSupply === 'all') return bills
        return bills.filter(b => b.ulm === selectedSupply)
    }, [bills, selectedSupply])

    const mobileStats = {
        firstName: stats.firstName,
        fullName: stats.fullName,
        clientCode: stats.clientCode,
        fiscalCode: stats.fiscalCode,
        address: stats.address,
        email: stats.email,
        lastConsumption: stats.lastConsumption,
        percentageBadge: stats.percentageBadge,
    }

    return (
        <>
            <MobileShell profile={profile} bills={filteredBills} supplies={supplies} stats={mobileStats} />
            <div className="hidden lg:block">
                <BolletteView profile={profile} bills={filteredBills} supplies={supplies} />
            </div>
        </>
    )
}
