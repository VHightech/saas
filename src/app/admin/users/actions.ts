'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireSuperadmin, requireUserManagement } from '@/lib/auth-checks'

export async function deleteUser(userId: string) {
    const authCheck = await requireSuperadmin()
    if (authCheck.error) {
        return { error: authCheck.error }
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )

    if (authCheck.user?.id === userId) {
        return { error: 'Non puoi eliminare il tuo stesso account.' }
    }

    // 1. Delete from Auth (this usually cascades to public.profiles if configured, but let's be safe)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (authError) {
        console.error('Error deleting auth user:', authError)
        return { error: 'Errore durante la cancellazione dell\'utente auth.' }
    }

    // 2. Delete from Public Profiles (if cascade didn't handle it or if user was just shadow)
    const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', userId)

    if (profileError) {
        console.error('Error deleting profile:', profileError)
        // If auth deletion succeeded, we might still want to return success or warning
        return { error: 'Utente Auth eliminato, ma errore eliminazione profilo.' }
    }

    revalidatePath('/admin/users')
    return { success: true }
}

export async function updateUser(userId: string, data: {
    name?: string
    email?: string
    phone?: string
    codice_fiscale?: string
    partita_iva?: string
    pec?: string
    codice_cliente?: string
}) {
    const authCheck = await requireUserManagement()
    if (authCheck.error) {
        return { error: authCheck.error }
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )

    // Resolve the AUTH user id. For shadow-claimed profiles, profiles.id is NOT
    // the auth.users id — the link is auth_user_id. Updating auth by profiles.id
    // silently hit nothing, which is why the login email never changed.
    const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('auth_user_id, email')
        .eq('id', userId)
        .maybeSingle()
    const authUserId = (prof?.auth_user_id as string | null) || null
    const currentEmail = (prof?.email as string | null) || null

    // 1. Update the auth email ONLY when it actually changed. The GoTrue admin
    //    call is a network round-trip; firing it on every save (e.g. a name-only
    //    edit) made saving slow. email_confirm:true applies the new address
    //    immediately. Errors are surfaced, not swallowed.
    const emailChanged =
        !!data.email && !!authUserId &&
        (data.email || '').trim().toLowerCase() !== (currentEmail || '').trim().toLowerCase()

    if (emailChanged) {
        const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId as string, {
            email: data.email,
            email_confirm: true,
        })
        if (authErr) {
            console.error('Auth email update failed:', authErr.message)
            return { error: `Impossibile aggiornare l'email di accesso: ${authErr.message}` }
        }
    }

    // 2. Update Public Profile
    const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
            name: data.name,
            email: data.email,
            phone: data.phone,
            codice_fiscale: data.codice_fiscale,
            partita_iva: data.partita_iva,
            pec: data.pec,
            ...(data.codice_cliente !== undefined ? { codice_cliente: data.codice_cliente } : {}),
        })
        .eq('id', userId)

    if (profileError) {
        console.error('Error updating profile:', profileError)
        return { error: 'Errore durante l\'aggiornamento del profilo.' }
    }

    revalidatePath(`/admin/users/${userId}`)
    revalidatePath('/admin/users')
    return { success: true }
}

export async function resetUserPassword(userId: string) {
    const authCheck = await requireUserManagement()
    if (authCheck.error) {
        return { error: authCheck.error }
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )

    // Resolve the AUTH user id (auth_user_id) + email from the profile. Using
    // profiles.id as the auth id fails for shadow-claimed users.
    const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('auth_user_id, email')
        .eq('id', userId)
        .maybeSingle()

    const authUserId = (prof?.auth_user_id as string | null) || null
    const email = (prof?.email as string | null) || null

    if (!authUserId || !email) {
        return { error: 'Utente non registrato: nessun account di accesso da reimpostare.' }
    }

    // Send the recovery email automatically. Calling this from the SERVER with the
    // service-role client bypasses the Turnstile captcha (the captcha only applies
    // to the public/browser endpoint — that was the source of the "captcha_token"
    // error). Supabase delivers the email via its configured provider (Resend).
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/auth/set-password?recovery=1`,
    })

    if (error) {
        console.error('Reset email failed:', error.message)
        return { error: `Errore durante l'invio dell'email di reset: ${error.message}` }
    }

    return { success: true }
}

/**
 * Reset a user's activation: deletes their auth account and returns the profile
 * to "shadow" state (auth_user_id = null, is_shadow = true) so the next "first
 * access" sends a brand-new invite instead of a password-reset link. Bills /
 * supplies / payments are untouched (they FK profiles.id, not auth_user_id).
 * Super_admin only; admins are managed from the admin roster, not here.
 */
export async function resetActivation(userId: string) {
    const authCheck = await requireSuperadmin()
    if (authCheck.error) return { error: authCheck.error }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('auth_user_id, role')
        .eq('id', userId)
        .maybeSingle()

    if (!prof) return { error: 'Profilo non trovato.' }
    if (prof.role && ['admin', 'super_admin', 'superadmin'].includes(prof.role as string)) {
        return { error: 'Gli amministratori si gestiscono dalla pagina Amministratori.' }
    }

    // Order matters: clear the profile -> auth link FIRST, otherwise the FK
    // profiles.auth_user_id -> auth.users(id) blocks the auth user deletion.
    const { error: updErr } = await supabaseAdmin
        .from('profiles')
        .update({ auth_user_id: null, is_shadow: true })
        .eq('id', userId)

    if (updErr) {
        console.error('resetActivation update:', updErr.code)
        return { error: 'Errore durante il ripristino del profilo.' }
    }

    if (prof.auth_user_id) {
        const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(prof.auth_user_id as string)
        if (delErr && !/not.?found|user.?not.?found/i.test(delErr.message)) {
            console.error('resetActivation deleteUser:', delErr.message)
            return { error: `Profilo ripristinato, ma account di accesso non rimosso: ${delErr.message}` }
        }
    }

    revalidatePath(`/admin/users/${userId}`)
    revalidatePath('/admin/users')
    return { success: true }
}

export async function updateUserSupply(cif: string, data: { address?: string; city?: string }, userId?: string) {
    const authCheck = await requireUserManagement()
    if (authCheck.error) return { error: authCheck.error }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { error } = await supabaseAdmin
        .from('user_supplies')
        .update({
            ...(data.address !== undefined ? { address: data.address } : {}),
            ...(data.city !== undefined ? { city: data.city } : {}),
        })
        .eq('cif', cif)

    if (error) {
        console.error('Error updating supply:', error.code)
        return { error: 'Errore durante l\'aggiornamento della fornitura.' }
    }

    if (userId) revalidatePath(`/admin/users/${userId}`)
    revalidatePath('/admin/users')
    return { success: true }
}

export async function deleteSupply(cif: string, userId?: string) {
    const authCheck = await requireSuperadmin()
    if (authCheck.error) return { error: authCheck.error }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )

    const { error } = await supabaseAdmin
        .from('user_supplies')
        .delete()
        .eq('cif', cif)

    if (error) {
        console.error('Error deleting supply:', error)
        return { error: 'Errore durante la cancellazione della fornitura.' }
    }

    if (userId) {
        revalidatePath(`/admin/users/${userId}`)
    }
    revalidatePath('/admin/users')
    return { success: true }
}
