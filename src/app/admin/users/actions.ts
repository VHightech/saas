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
        .select('auth_user_id')
        .eq('id', userId)
        .maybeSingle()
    const authUserId = (prof?.auth_user_id as string | null) || null

    // 1. Update the auth email — only if there is a real auth account (registered
    //    users). email_confirm:true applies the new address immediately (no second
    //    confirmation step). Errors are surfaced, not swallowed.
    if (data.email && authUserId) {
        const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
            email: data.email,
            email_confirm: true,
            user_metadata: { full_name: data.name || '' },
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
            pec: data.pec
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
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/auth/set-password`,
    })

    if (error) {
        console.error('Reset email failed:', error.message)
        return { error: `Errore durante l'invio dell'email di reset: ${error.message}` }
    }

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
