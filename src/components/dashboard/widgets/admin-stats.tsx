'use client'

import { Users, FileText, HardDrive, Activity } from "lucide-react"

interface AdminStatsProps {
    stats?: {
        totalUsers: number;
        totalBills: number;
        storageUsed: string;
        activeSessions: number;
    }
}

export function AdminStats({ stats = { totalUsers: 0, totalBills: 0, storageUsed: '0 GB', activeSessions: 0 } }: AdminStatsProps) {

    const items = [
        { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
        { label: 'Bills Processed', value: stats.totalBills, icon: FileText, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
        { label: 'Storage Used', value: stats.storageUsed, icon: HardDrive, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10' },
        { label: 'Active Now', value: stats.activeSessions, icon: Activity, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10' },
    ]

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {items.map((item) => {
                const Icon = item.icon
                return (
                    <div key={item.label} className="p-4 rounded-xl bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 shadow-sm flex items-center gap-4">
                        <div className={`p-3 rounded-lg ${item.bg} ${item.color}`}>
                            <Icon size={20} />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{item.label}</p>
                            <p className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{item.value}</p>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
