'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createPlainClient } from '@supabase/supabase-js'

const PASSWORD_REGEX =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"|<>?,./`~]).{8,}$/

export async function changePassword(currentPassword: string, newPassword: string, captchaToken?: string) {
    const supabase = await createClient()

    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user || !user.email) {
        return { error: 'Sessione scaduta. Effettua nuovamente il login.' }
    }

    if (!currentPassword || !newPassword) {
        return { error: 'Compila tutti i campi.' }
    }

    if (currentPassword === newPassword) {
        return { error: 'La nuova password deve essere diversa da quella attuale.' }
    }

    if (!PASSWORD_REGEX.test(newPassword)) {
        return {
            error:
                'La password deve contenere almeno 8 caratteri, una lettera maiuscola, una minuscola, un numero e un carattere speciale.'
        }
    }

    // Re-authenticate with the current password before allowing the change
    // (protects against session-hijack -> password-change lockout). This uses a
    // THROWAWAY anon client so it doesn't rotate the user's real session cookies.
    // Turnstile captcha is enabled on the project, so the sign-in needs a token —
    // missing it was being misreported as "wrong password".
    const verifier = createPlainClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
    )
    const { error: signInErr } = await verifier.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
        options: { captchaToken }
    })
    if (signInErr) {
        if (signInErr.message?.toLowerCase().includes('captcha')) {
            return { error: 'Verifica di sicurezza non riuscita. Ricarica la pagina e riprova.' }
        }
        return { error: 'Password attuale non corretta.' }
    }

    const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword })
    if (updateErr) {
        console.error('[changePassword] update failed:', updateErr.code)
        return { error: 'Impossibile aggiornare la password. Riprova.' }
    }

    // Invalidate all OTHER sessions; keep the current one so the user stays logged in.
    await supabase.auth.signOut({ scope: 'others' })

    return { success: true }
}
