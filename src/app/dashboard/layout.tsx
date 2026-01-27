'use client'

import { LucideLogOut } from 'lucide-react'
import { ModeToggle } from '@/components/mode-toggle'
import Image from "next/image"
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const router = useRouter()
    const [checking, setChecking] = useState(true)
    const supabase = createClient()

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

            const { data: profile } = await supabase
                .from('profiles')
                .select('user_name') // Add other fields if needed
                .eq('id', user.id)
                .single()

            if (profile && !profile.user_name) {
                // If user_name is missing (was reset), redirect to complete profile
                router.push('/profile/complete')
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
        <div className="min-h-[100dvh] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100 via-slate-50 to-white dark:from-[#0a0a0a] dark:via-[#0a0a0a] dark:to-[#1e1e1e] transition-colors duration-500">
            {/* Header */}
            <header className="bg-transparent relative md:sticky top-0 z-50 border-white/20 px-6 py-4 flex items-center justify-between transition-all duration-300">

                {/* Logo */}
                {/* Logo / Title */}
                <div className="flex items-center gap-12">
                    <div className="flex items-center space-x-3">
                        <Image
                            src="/brand-logo.jpg"
                            alt="Brand Logo"
                            width={40}
                            height={40}
                            className="object-contain rounded-xl"
                        />
                        <span className="text-lg font-bold text-slate-700 dark:text-slate-200 hidden sm:block tracking-tight">
                            Area Personale
                        </span>
                    </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-4">
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
    )
}
