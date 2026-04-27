'use server'

import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth-checks'

// Helper to create Admin Client (bypass RLS)

// Helper to create Admin Client (bypass RLS)
function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )
}

function createStandardClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}

export async function inviteAdmin(formData: FormData): Promise<{ success: boolean; error?: string }> {
    const authCheck = await requireAdmin()
    if (authCheck.error) return { success: false, error: authCheck.error }

    const email = formData.get('email') as string
    const fullName = formData.get('fullName') as string

    if (!email) return { success: false, error: 'Email richiesta' }

    const supabaseAdmin = createAdminClient()

    try {
        // 0. (Tenant Check Removed)
        // In a single tenant system, any existing admin can invite another admin.
        const supabaseSession = await createServerClient()
        const { data: { user: inviter } } = await supabaseSession.auth.getUser()

        if (!inviter) return { success: false, error: 'Sessione scaduta' }

        // 1. Invite User
        const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
            email,
            {
                data: {
                    full_name: fullName || 'Admin',
                    is_admin: true // Flag to prevent profile creation via trigger
                },
                redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/confirm-invite`
            }
        )

        if (error) {
            console.error('Invite Error:', error)
            return { success: false, error: error.message }
        }

        if (!data.user) {
            return { success: false, error: 'Utente non creato' }
        }

        // 2. Insert/Update into profiles
        const { error: insertError } = await supabaseAdmin
            .from('profiles')
            .upsert({
                id: data.user.id,
                email: email,
                name: fullName || 'Admin',
                role: 'admin',
                is_shadow: false
            })

        if (insertError) {
            console.error('Profile Admin Insert Error:', insertError)
            return { success: false, error: 'Utente auth creato ma creazione profilo fallita: ' + insertError.message }
        }

        // 3. Set Admin Role in Auth Metadata (as backup/sync)
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            data.user.id,
            {
                app_metadata: {
                    role: 'admin'
                }
            }
        )

        if (updateError) {
            console.error('Update Role Error:', updateError)
        }

        revalidatePath('/admin/admins')
        return { success: true }
    } catch (e) {
        return { success: false, error: 'Errore imprevisto' }
    }
}

export async function getAdmins() {
    const authCheck = await requireAdmin()
    if (authCheck.error) return []

    const supabaseAdmin = createAdminClient()

    // Fetch from profiles where role is admin or super_admin
    // This is the single source of truth for roles.
    const { data: profiles, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .in('role', ['admin', 'super_admin'])
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching admins from profiles:', error)
        return []
    }

    return profiles
}

export async function removeAdmin(userId: string) {
    const authCheck = await requireAdmin()
    if (authCheck.error) return { success: false, error: authCheck.error }
    if (authCheck.user?.id === userId) return { success: false, error: 'Non puoi rimuovere te stesso.' }

    const supabaseAdmin = createAdminClient()

    // Remove admin role (downgrade) instead of delete? 
    // Or delete user completely?
    // Let's just remove the role for safety, creating a "soft ban" from admin.

    // Remove admin role (downgrade to user)
    // We update the profile role
    const { error } = await supabaseAdmin.from('profiles')
        .update({ role: 'user' })
        .eq('id', userId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/admin/admins')
    return { success: true }
}
