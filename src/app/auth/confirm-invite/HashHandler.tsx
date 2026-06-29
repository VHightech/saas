'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

export default function HashHandler() {
    const router = useRouter()
    const [message, setMessage] = useState('Verifica invito in corso...')

    useEffect(() => {
        const supabase = createClient()
        let cancelled = false

        const run = async () => {
            const hash = window.location.hash
            if (!hash || hash.length < 2) {
                if (!cancelled) setMessage('Nessun codice di verifica trovato nel link.')
                return
            }

            const params = new URLSearchParams(hash.substring(1))

            if (params.get('error')) {
                const desc = params.get('error_description') || 'Errore durante l\'autenticazione.'
                if (!cancelled) setMessage(desc.replace(/\+/g, ' '))
                return
            }

            const accessToken = params.get('access_token')
            const refreshToken = params.get('refresh_token')

            if (!accessToken || !refreshToken) {
                if (!cancelled) setMessage('Link non valido o scaduto. Richiedi un nuovo invito.')
                return
            }

            const { error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
            })

            if (error) {
                console.error('[confirm-invite] setSession error:', error.message)
                if (!cancelled) setMessage('Impossibile creare la sessione. Richiedi un nuovo invito.')
                return
            }

            router.replace('/auth/set-password?invite=1')
        }

        run()
        return () => {
            cancelled = true
        }
    }, [router])

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0a0a0a]">
            <div className="flex flex-col items-center gap-4 max-w-md text-center px-6">
                <Loader2 className="animate-spin text-indigo-600 dark:text-indigo-400" size={48} />
                <p className="text-slate-600 dark:text-slate-300 font-medium">{message}</p>
            </div>
        </div>
    )
}
