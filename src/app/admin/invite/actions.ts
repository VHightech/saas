'use server'

import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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
    const email = formData.get('email') as string
    const fullName = formData.get('fullName') as string

    if (!email) return { success: false, error: 'Email richiesta' }

    const supabaseAdmin = createAdminClient()

    try {
        // 0. Get Current Admin's Tenant ID
        const supabaseSession = await createServerClient()
        const { data: { user: inviter } } = await supabaseSession.auth.getUser()

        if (!inviter) return { success: false, error: 'Sessione scaduta' }

        const { data: inviterProfile } = await supabaseSession
            .from('tenant_admins')
            .select('tenant_id')
            .eq('id', inviter.id)
            .single()

        const tenantId = inviterProfile?.tenant_id

        if (!tenantId) {
            // Fallback or Error? If inviter is super_admin might not have tenant_id? 
            // Or maybe they do. Let's assume they MUST have one for now.
            return { success: false, error: 'Impossibile determinare il Tenant ID del chiamante.' }
        }

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

        // 2. Insert into tenant_admins
        const { error: insertError } = await supabaseAdmin
            .from('tenant_admins')
            .insert({
                id: data.user.id,
                email: email,
                full_name: fullName || 'Admin',
                role: 'admin',
                tenant_id: tenantId,
                created_at: new Date().toISOString()
            })

        if (insertError) {
            console.error('Tenant Admin Insert Error:', insertError)
            // Clean up auth user if db insert fails? Or just return error?
            // For now return error but keep user (can be retried or fixed manually)
            return { success: false, error: 'Utente auth creato ma aggiunta a tenant_admins fallita: ' + insertError.message }
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
