'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

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

export async function inviteAdmin(formData: FormData) {
    const email = formData.get('email') as string
    const fullName = formData.get('fullName') as string

    if (!email) return { success: false, error: 'Email richiesta' }

    const supabaseAdmin = createAdminClient()

    try {
        // 1. Invite User
        const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
            email,
            {
                data: {
                    full_name: fullName || 'Admin'
                }
            }
        )

        if (error) {
            console.error('Invite Error:', error)
            return { success: false, error: error.message }
        }

        if (!data.user) {
            return { success: false, error: 'Utente non creato' }
        }

        // 2. Set Admin Role
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
            return { success: false, error: 'Invito inviato ma errore assegnazione ruolo' }
        }

        revalidatePath('/admin/admins')
        return { success: true }
    } catch (e) {
        return { success: false, error: 'Errore imprevisto' }
    }
}

export async function getAdmins() {
    const supabaseAdmin = createAdminClient()

    // Fetch users. For now we fetch first 50. 
    // Ideally we would filter by metadata via database query if possible, 
    // but listUsers doesn't support deep metadata filter easily.
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({
        perPage: 100
    })

    if (error) return []

    // Filter in memory for role === 'admin'
    return users.filter(u => u.app_metadata?.role === 'admin')
}

export async function removeAdmin(userId: string) {
    const supabaseAdmin = createAdminClient()

    // Remove admin role (downgrade) instead of delete? 
    // Or delete user completely?
    // Let's just remove the role for safety, creating a "soft ban" from admin.

    // Actually, usually we might want to delete access.
    // Let's update metadata to remove role.
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        {
            app_metadata: {
                role: null
            }
        }
    )

    if (error) return { success: false, error: error.message }

    revalidatePath('/admin/admins')
    return { success: true }
}
