'use server'

import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin, requireSuperadmin, requireAdminInvite, getAdminContext } from '@/lib/auth-checks'

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

// Admins log in with a 6-digit codice_cliente like everyone else (the login form
// is a 6-digit numeric input). Admins draw from a small reserved LOW band,
// 000001–000010 (there are never more than ~10 admins). Customers have priority
// on the codice namespace, so we return the first code in the band not already
// used by ANY profile — we never take a code a customer (or existing admin) holds.
async function generateAdminCodice(
    admin: ReturnType<typeof createAdminClient>
): Promise<string | null> {
    for (let n = 1; n <= 10; n++) {
        const code = String(n).padStart(6, '0') // 000001..000010
        const { data } = await admin
            .from('profiles').select('id').eq('codice_cliente', code).maybeSingle()
        if (!data) return code
    }
    return null
}

export async function inviteAdmin(formData: FormData): Promise<{ success: boolean; error?: string; codice?: string }> {
    // super_admin, or an admin granted can_invite_admins.
    const authCheck = await requireAdminInvite()
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

        // Assign a login code automatically. Reuse an existing one on re-invite so
        // we never overwrite a code the admin already uses.
        const { data: existingProf } = await supabaseAdmin
            .from('profiles').select('codice_cliente').eq('id', data.user.id).maybeSingle()
        let codiceCliente = (existingProf?.codice_cliente as string | null) || null
        if (!codiceCliente) {
            codiceCliente = await generateAdminCodice(supabaseAdmin)
            if (!codiceCliente) {
                return { success: false, error: 'Impossibile generare un codice di accesso univoco. Riprova.' }
            }
        }

        // 2. Insert/Update into profiles
        const { error: insertError } = await supabaseAdmin
            .from('profiles')
            .upsert({
                id: data.user.id,
                auth_user_id: data.user.id, // keep both links set so role resolves either way
                email: email,
                name: fullName || 'Admin',
                role: 'admin',
                is_shadow: false,
                codice_cliente: codiceCliente,
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
        return { success: true, codice: codiceCliente }
    } catch (e) {
        return { success: false, error: 'Errore imprevisto' }
    }
}

// Re-send a fresh set-password link to an already-invited admin (e.g. one whose
// link expired or who never completed onboarding). The auth user already exists,
// so inviteUserByEmail would fail — send a recovery email instead (service-role
// bypasses the captcha; Supabase delivers it).
export async function resendAdminInvite(userId: string): Promise<{ success: boolean; error?: string }> {
    const authCheck = await requireAdminInvite()
    if (authCheck.error) return { success: false, error: authCheck.error }

    const supabaseAdmin = createAdminClient()
    const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .maybeSingle()

    if (!prof?.email) return { success: false, error: 'Email non trovata per questo amministratore.' }

    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(prof.email as string, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/set-password?recovery=1`,
    })

    if (error) {
        console.error('resendAdminInvite error:', error.message)
        return { success: false, error: 'Errore durante l\'invio dell\'email.' }
    }

    return { success: true }
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
    const authCheck = await requireSuperadmin()
    if (authCheck.error) return { success: false, error: authCheck.error }
    if (authCheck.user?.id === userId) return { success: false, error: 'Non puoi rimuovere te stesso.' }

    const supabaseAdmin = createAdminClient()

    // Hard-delete the admin (auth account + profile). A soft downgrade left the
    // auth account alive, so re-inviting the same email failed with "already
    // registered" and the admin's codice (000001–000010) stayed occupied.
    const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('auth_user_id, role')
        .eq('id', userId)
        .maybeSingle()

    if (!prof) return { success: false, error: 'Amministratore non trovato.' }
    if (!['admin', 'super_admin', 'superadmin'].includes(prof.role as string)) {
        return { success: false, error: 'Questo profilo non è un amministratore.' }
    }

    // Safety net: never destroy a profile that owns bills (would take customer
    // data with it). Admins never do, but if somehow linked, downgrade instead.
    const { count: billCount } = await supabaseAdmin
        .from('bills').select('id', { count: 'exact', head: true }).eq('user_id', userId)
    if (billCount && billCount > 0) {
        await supabaseAdmin.from('profiles').update({ role: 'user' }).eq('id', userId)
        revalidatePath('/admin/invite')
        return { success: true }
    }

    // Delete the auth account (FK profiles.auth_user_id -> auth.users is ON DELETE
    // CASCADE, so the profile goes with it), then make sure the profile is gone
    // even in the edge case where auth_user_id was never linked.
    const authId = (prof.auth_user_id as string | null) || userId
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(authId)
    if (authErr && !/not.?found|user.?not.?found/i.test(authErr.message)) {
        console.error('removeAdmin auth delete:', authErr.message)
        return { success: false, error: `Impossibile eliminare l'account di accesso: ${authErr.message}` }
    }
    await supabaseAdmin.from('profiles').delete().eq('id', userId)

    revalidatePath('/admin/admins')
    revalidatePath('/admin/invite')
    return { success: true }
}

// Super_admin grants/revokes granular permissions on a regular admin.
export async function setAdminPermissions(
    userId: string,
    perms: { can_invite_admins?: boolean; can_manage_users?: boolean }
) {
    const authCheck = await requireSuperadmin()
    if (authCheck.error) return { success: false, error: authCheck.error }

    const supabaseAdmin = createAdminClient()

    // Only mutate regular admins — super_admins implicitly have everything.
    const { error } = await supabaseAdmin
        .from('profiles')
        .update({
            ...(perms.can_invite_admins !== undefined ? { can_invite_admins: perms.can_invite_admins } : {}),
            ...(perms.can_manage_users !== undefined ? { can_manage_users: perms.can_manage_users } : {}),
        })
        .eq('id', userId)
        .eq('role', 'admin')

    if (error) {
        console.error('setAdminPermissions error:', error.code)
        return { success: false, error: 'Errore durante il salvataggio dei permessi.' }
    }

    revalidatePath('/admin/invite')
    return { success: true }
}

// Lightweight context for gating admin UI (buttons, page access).
export async function getMyAdminContext() {
    const res = await getAdminContext()
    if (!res.ctx) {
        return { isSuperadmin: false, canInviteAdmins: false, canManageUsers: false, role: null as string | null }
    }
    return {
        isSuperadmin: res.ctx.isSuperadmin,
        canInviteAdmins: res.ctx.canInviteAdmins,
        canManageUsers: res.ctx.canManageUsers,
        role: res.ctx.role as string,
    }
}
