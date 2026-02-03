'use client'

import { Users, Upload, Settings, Shield } from "lucide-react"
import Link from "next/link"

export function AdminShortcuts() {
    const shortcuts = [
        {
            label: 'Manage Users',
            icon: Users,
            href: '/admin/users',
            color: 'text-blue-500',
            bg: 'bg-blue-50 dark:bg-blue-900/10',
            border: 'border-blue-100 dark:border-blue-500/20'
        },
        {
            label: 'Upload Files',
            icon: Upload,
            href: '/admin/upload',
            color: 'text-indigo-500',
            bg: 'bg-indigo-50 dark:bg-indigo-900/10',
            border: 'border-indigo-100 dark:border-indigo-500/20'
        },
        {
            label: 'Global Settings',
            icon: Settings,
            href: '/admin/settings',
            color: 'text-slate-500',
            bg: 'bg-slate-50 dark:bg-white/5',
            border: 'border-slate-100 dark:border-white/10'
        }
    ]

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {shortcuts.map((item) => {
                const Icon = item.icon
                return (
                    <Link
                        key={item.label}
                        href={item.href}
                        className={`
                            group flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border transition-all duration-300
                            ${item.bg} ${item.border} hover:scale-[1.02] hover:shadow-lg
                        `}
                    >
                        <div className={`p-3 rounded-xl bg-white dark:bg-white/10 shadow-sm ${item.color}`}>
                            <Icon size={24} />
                        </div>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 text-center group-hover:text-black dark:group-hover:text-white">
                            {item.label}
                        </span>
                    </Link>
                )
            })}
        </div>
    )
}
