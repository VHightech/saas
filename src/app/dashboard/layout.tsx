'use client'

import { LucideLogOut } from 'lucide-react'
import { ModeToggle } from '@/components/mode-toggle'
import Image from "next/image"
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { getUserDashboardData } from '@/actions/user-data'
import { DashboardProvider } from '@/components/dashboard/dashboard-context'
import { SupplySelector } from '@/components/dashboard/supply-selector'

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const router = useRouter()
    const [checking, setChecking] = useState(true)
    const supabase = createClient()
    // const { tenant } = useTenant() // Removed
    const [userData, setUserData] = useState<{ name: string; email: string } | null>(null)

    useEffect(() => {
        checkProfile()
    }, [])

    const checkProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                // Force redirect if no user found on client check
                router.push('/login')
                return
            }

            // Server Action Call
            const { profile, error } = await getUserDashboardData()

            const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.role === 'superadmin'

            if (profile && !profile.username && !isAdmin) {
                // If username is missing (was reset) and not an admin, redirect to complete profile
                router.push('/profile/complete')
            }

            if (user && profile) {
                setUserData({
                    name: profile.name || 'Utente',
                    email: user.email || ''
                })
            }
        } catch (e) {
            console.error(e)
        } finally {
            setChecking(false)
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.refresh()
        router.push('/login')
    }

    return (
        <DashboardProvider>
            <div className="min-h-[100dvh] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100 via-slate-50 to-white dark:from-[#0a0a0a] dark:via-[#0a0a0a] dark:to-[#1e1e1e] transition-colors duration-500">
                {/* Header */}
                <header className="bg-transparent relative md:sticky top-0 z-50 border-white/20 px-6 py-4 flex items-center justify-between transition-all duration-300">

                    {/* Logo / Title */}
                    <div className="flex items-center gap-12">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 relative flex items-center justify-center bg-white rounded-xl overflow-hidden p-1 shadow-sm">
                                <Image
                                    src="/acq_logo.jpg"
                                    alt="Acquambiente"
                                    width={40}
                                    height={40}
                                    className="object-contain"
                                />
                            </div>
                            <span className="text-lg font-bold text-slate-700 dark:text-slate-200 hidden sm:block tracking-tight">
                                Area Personale
                            </span>
                        </div>
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-4">

                        <SupplySelector />

                        {/* User Badge */}
                        {userData && (
                            <div className="hidden md:flex items-center gap-3 px-3 py-1.5 bg-white/50 dark:bg-white/5 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-full shadow-sm mr-2">
                                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 font-bold text-xs uppercase">
                                    {userData.name ? userData.name.substring(0, 2) : 'UT'}
                                </div>
                                <div className="flex flex-col pr-2">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-none">{userData.name}</span>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-none mt-1 font-medium">{userData.email}</span>
                                </div>
                            </div>
                        )}

                        <ModeToggle />

                        <button
                            onClick={handleLogout}
                            className="btn-glass btn-glass-red px-4 py-2 rounded-xl"
                            title="Esci"
                        >
                            <LucideLogOut size={18} />
                            <span className="hidden sm:inline font-medium text-sm">Esci</span>
                        </button>
                    </div>
                </header>

                {/* Main Content */}
                <main className="relative z-10 pt-8 px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto">
                    {children}
                </main>
            </div>
        </DashboardProvider>
    )
}
