'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin, requireSuperadmin } from '@/lib/auth-checks'

export async function deleteUser(userId: string) {
    const authCheck = await requireAdmin()
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
    cfpi?: string
    cif?: string
    address?: string
    city?: string
}) {
    const authCheck = await requireAdmin()
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

    // 1. Update Auth if email is present (Best effort, might fail if Shadow user)
    if (data.email) {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
            email: data.email,
            user_metadata: {
                full_name: data.name || ''
            }
        }).catch(err => console.log('Auth update skipped/failed (likely shadow user):', err))
    }

    // 2. Update Public Profile
    const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
            name: data.name,
            email: data.email,
            phone: data.phone,
            cfpi: data.cfpi,
            cif: data.cif,
            address: data.address,
            city: data.city
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
    const authCheck = await requireAdmin()
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

    // 1. Get user email
    const { data: user, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (userError || !user.user?.email) {
        return { error: 'Impossibile trovare l\'email dell\'utente o utente non registrato.' }
    }

    // 2. Trigger reset email
    const { error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: user.user.email,
        options: {
            redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/dashboard/profile`
        }
    })

    if (error) {
        console.error('Reset password failed:', error.message)
        return { error: 'Errore durante l\'invio dell\'email di reset.' }
    }

    // Note: generateLink gives us the link, but if we want Supabase to SEND the email automatically,
    // we should use resetPasswordForEmail. However, resetPasswordForEmail is a client-side / public API.
    // To do it "as admin" and ensure the email is sent by Supabase:
    const { error: sendError } = await supabaseAdmin.auth.resetPasswordForEmail(user.user.email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/dashboard/profile`
    })

    if (sendError) {
        return { error: 'Errore nell\'invio dell\'email: ' + sendError.message }
    }

    return { success: true }
}

export async function deleteSupply(cif: string, userId?: string) {
    const authCheck = await requireAdmin()
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
