'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

export default function ConfirmInvitePage() {
    const router = useRouter()
    const [message, setMessage] = useState('Verifica invito in corso...')

    useEffect(() => {
        const supabase = createClient()
        let mounted = true

        const handleAuth = async () => {
            // 0. Check for errors in the URL hash first
            const hash = window.location.hash
            if (hash && hash.includes('error=')) {
                console.error('Auth error in hash:', hash)
                const params = new URLSearchParams(hash.substring(1)) // remove #
                const errorDescription = params.get('error_description') || 'Errore durante l\'autenticazione.'
                if (mounted) setMessage(errorDescription.replace(/\+/g, ' '))
                return
            }

            // 1. Try to manually parse parsing access_token if present (Robustness fix)
            if (hash && hash.includes('access_token')) {
                const params = new URLSearchParams(hash.substring(1))
                const accessToken = params.get('access_token')
                const refreshToken = params.get('refresh_token')

                if (accessToken && refreshToken) {
                    const { error } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken
                    })

                    if (!error) {
                        if (mounted) setMessage('Sessione recuperata manuale. Reindirizzamento...')
                        setTimeout(() => {
                            if (mounted) router.replace('/admin/update-password')
                        }, 500)
                        return
                    }
                }
            }

            // 2. Standard Session Check
            const { data: { session }, error } = await supabase.auth.getSession()

            if (error) {
                if (mounted) setMessage('Errore sessione: ' + error.message)
                return
            }

            if (session) {
                if (mounted) setMessage('Invito già verificato. Reindirizzamento...')
                setTimeout(() => {
                    if (mounted) router.replace('/admin/update-password')
                }, 500)
                return
            }

            // 3. Listener (fallback)
            const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
                if (event === 'SIGNED_IN' || session) {
                    if (mounted) setMessage('Autenticazione riuscita! Entrando...')
                    setTimeout(() => {
                        if (mounted) router.replace('/admin/update-password')
                    }, 500)
                }
            })

            // 4. Timeout
            setTimeout(() => {
                if (mounted) {
                    // Final check
                    supabase.auth.getSession().then(({ data }) => {
                        if (!data.session && mounted && message.includes('Verifica')) {
                            setMessage('Impossibile verificare la sessione. L\'invito potrebbe essere scaduto o il link non valido.')
                        }
                    })
                }
            }, 5000)

            return () => {
                subscription.unsubscribe()
            }
        }

        handleAuth()

        return () => {
            mounted = false
        }
    }, [router])

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0a0a0a]">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="animate-spin text-indigo-600 dark:text-indigo-400" size={48} />
                <p className="text-slate-600 dark:text-slate-300 font-medium animate-pulse">{message}</p>
            </div>
        </div>
    )
}
