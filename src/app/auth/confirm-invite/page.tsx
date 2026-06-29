import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Loader2 } from 'lucide-react'
import HashHandler from './HashHandler'

interface ConfirmInvitePageProps {
    searchParams: Promise<{
        code?: string
        token_hash?: string
        type?: string
        error?: string
        error_description?: string
    }>
}

export default async function ConfirmInvitePage({ searchParams }: ConfirmInvitePageProps) {
    const params = await searchParams

    if (params.error) {
        const description = (params.error_description || 'Errore durante l\'autenticazione.').replace(/\+/g, ' ')
        return renderMessage(description)
    }

    const supabase = await createClient()

    // PKCE flow — `code` is a UUID and the verifier lives in server cookies set during signUp.
    if (params.code) {
        const { error } = await supabase.auth.exchangeCodeForSession(params.code)
        if (error) {
            console.error('[confirm-invite] exchangeCodeForSession error:', error.message)
            return renderMessage('Link non valido o scaduto. Richiedi un nuovo invito.')
        }
        redirect('/auth/set-password?invite=1')
    }

    // Legacy / magic-link flow with token_hash.
    if (params.token_hash) {
        const { error } = await supabase.auth.verifyOtp({
            token_hash: params.token_hash,
            type: (params.type || 'signup') as 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email',
        })
        if (error) {
            console.error('[confirm-invite] verifyOtp error:', error.message)
            return renderMessage('Link non valido o scaduto. Richiedi un nuovo invito.')
        }
        redirect('/auth/set-password?invite=1')
    }

    // No query params — likely implicit flow with tokens in the URL hash.
    // The hash is only readable client-side, so delegate.
    return <HashHandler />
}

function renderMessage(message: string) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0a0a0a]">
            <div className="flex flex-col items-center gap-4 max-w-md text-center px-6">
                <Loader2 className="animate-spin text-indigo-600 dark:text-indigo-400" size={48} />
                <p className="text-slate-600 dark:text-slate-300 font-medium">{message}</p>
            </div>
        </div>
    )
}
