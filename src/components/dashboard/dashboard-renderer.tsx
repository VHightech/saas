'use client'

import React, { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User, Mail, Smartphone, FileText, MapPin, Droplets } from 'lucide-react'
import { Toaster } from 'sonner'
import { RecentBillsWidget } from '@/components/dashboard/widgets/RecentBillsWidget'
import { DesktopSidePanel } from './widgets/DesktopSidePanel'
import { Profile, Bill, UploadLog } from '@/types/dashboard'
import { DashboardLayout } from '@/components/admin/dashboard-builder'
import { MobileShell } from '@/components/dashboard/mobile/MobileShell'
import { cn } from '@/lib/utils'


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

import { useDashboard } from '@/components/dashboard/dashboard-context'

export function DashboardRenderer({ profile, bills, supplies = [], stats, adminStats, uploads }: DashboardRendererProps) {
    const router = useRouter()
    const { setSupplies, selectedSupply, setSelectedSupply } = useDashboard()

    // 1. Extract Unique Supplies
    const uniqueSupplies = React.useMemo(() => {
        const suppliesSet = new Set<string>()
        bills.forEach(b => {
            if (b.ulm) suppliesSet.add(b.ulm)
        })
        return Array.from(suppliesSet).sort()
    }, [bills])

    // Sync supplies to global context
    React.useEffect(() => {
        setSupplies(uniqueSupplies)
    }, [uniqueSupplies, setSupplies])

    // 2. Filter Bills
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
        <div className="flex flex-col md:gap-6 p-0 md:p-4 lg:p-6 bg-[#F5F1EA] md:bg-[#f8fafc] dark:bg-[#0F1115] min-h-screen overflow-y-auto custom-scrollbar">

            
            {/* Mobile View */}
            <div className="md:hidden">
                <MobileShell profile={profile} bills={filteredBills} supplies={supplies} stats={mobileStats} />
            </div>

            {/* --- TOP HEADER: USER INFO CARDS (Desktop Only) --- */}
            <div className="hidden md:grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch animate-in fade-in slide-in-from-top-4 duration-500">
                {/* Name & Supply Selector */}
                <div className="md:col-span-3 bg-white dark:bg-[#1A1D23] p-5 rounded-2xl border border-slate-200/60 dark:border-white/5 flex flex-col justify-center relative shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 bg-sky-50 dark:bg-sky-500/10 text-sky-500 rounded-xl flex items-center justify-center">
                            <User size={20} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Bentornato,</p>
                            <h1 className="text-xl font-extrabold text-[#0A2540] dark:text-white leading-tight truncate">
                                {stats.firstName}
                            </h1>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                        <select 
                            value={selectedSupply} 
                            onChange={(e) => setSelectedSupply(e.target.value)}
                            className="bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 px-3 py-1.5 rounded-lg text-[11px] font-bold outline-none focus:ring-2 ring-sky-500/20 cursor-pointer w-full"
                        >
                            <option value="all">Tutte le forniture</option>
                            {uniqueSupplies.map(ulm => (
                                <option key={ulm} value={ulm}>Fornitura: {ulm}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Contact Info Grid */}
                <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Email */}
                    <div className="bg-white dark:bg-[#1A1D23] p-4 rounded-2xl border border-slate-200/60 dark:border-white/5 flex items-start gap-3 shadow-sm hover:border-sky-200 dark:hover:border-sky-500/20 transition-colors">
                        <div className="p-2 bg-sky-50 dark:bg-sky-500/10 text-sky-500 rounded-lg">
                            <Mail size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Email</p>
                            <p className="text-[13px] font-bold text-slate-700 dark:text-slate-200 truncate">{stats.email || '-'}</p>
                        </div>
                    </div>
                    {/* Phone - Profile might have phone */}
                    <div className="bg-white dark:bg-[#1A1D23] p-4 rounded-2xl border border-slate-200/60 dark:border-white/5 flex items-start gap-3 shadow-sm hover:border-sky-200 dark:hover:border-sky-500/20 transition-colors">
                        <div className="p-2 bg-sky-50 dark:bg-sky-500/10 text-sky-500 rounded-lg">
                            <Smartphone size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Telefono</p>
                            <p className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{stats.phone || '-'}</p>
                        </div>
                    </div>
                    {/* Fiscal Code */}
                    <div className="bg-white dark:bg-[#1A1D23] p-4 rounded-2xl border border-slate-200/60 dark:border-white/5 flex items-start gap-3 shadow-sm hover:border-sky-200 dark:hover:border-sky-500/20 transition-colors">
                        <div className="p-2 bg-sky-50 dark:bg-sky-500/10 text-sky-500 rounded-lg">
                            <FileText size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Codice Fiscale / P.IVA</p>
                            <p className="text-[13px] font-bold text-slate-700 dark:text-slate-200 truncate uppercase">{stats.fiscalCode || '-'}</p>
                        </div>
                    </div>
                    {/* Address */}
                    <div className="bg-white dark:bg-[#1A1D23] p-4 rounded-2xl border border-slate-200/60 dark:border-white/5 flex items-start gap-3 shadow-sm hover:border-sky-200 dark:hover:border-sky-500/20 transition-colors">
                        <div className="p-2 bg-sky-50 dark:bg-sky-500/10 text-sky-500 rounded-lg">
                            <MapPin size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Indirizzo Fornitura</p>
                            <p className="text-[13px] font-bold text-slate-700 dark:text-slate-200 truncate" title={stats.address}>
                                {stats.address || '-'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Dashboard Actions */}
                <div className="md:col-span-2 flex flex-col gap-2 justify-center">
                    <button
                        className="w-full h-10 px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 text-[12px] font-bold flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors cursor-pointer shadow-sm"
                    >
                        <Droplets size={14} /> Autolettura
                    </button>
                    <button
                        className="w-full h-10 px-4 rounded-xl border border-indigo-100 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[12px] font-bold flex items-center justify-center gap-2 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors cursor-pointer shadow-sm"
                    >
                        <Mail size={14} /> Assistenza
                    </button>
                </div>
            </div>

            {/* --- MAIN CONTENT: CHART & TABLE (Desktop Only) --- */}
            <div className="hidden md:grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0 items-start animate-in fade-in slide-in-from-bottom-4 duration-700">
                
                {/* Left Column: Analytics — Flat MobileHome-style */}
                <div className="lg:col-span-3">
                    <DesktopSidePanel allBills={bills} />
                </div>

                {/* Right Column: Recent Bills */}
                <div className="lg:col-span-9 flex flex-col bg-white dark:bg-[#1A1D23] rounded-2xl border border-slate-200/60 dark:border-white/5 shadow-sm overflow-hidden min-h-[500px]">
                    <RecentBillsWidget initialData={filteredBills} />
                </div>
            </div>
        </div>
    )
}
