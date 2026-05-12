'use server'

import { createClient } from '@/lib/supabase/server'

const PASSWORD_REGEX =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"|<>?,./`~]).{8,}$/

export async function changePassword(currentPassword: string, newPassword: string) {
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

    // Re-authenticate with the current password before allowing the change.
    // This protects against session-hijack -> password-change lockout.
    const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
    })
    if (signInErr) {
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
