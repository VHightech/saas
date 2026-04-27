'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth-checks'

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
