import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

type ProfileRow = {
    role: 'admin' | 'super_admin' | 'superadmin' | 'user' | null
    can_invite_admins?: boolean | null
    can_manage_users?: boolean | null
}

const SUPER_ROLES = ['super_admin', 'superadmin']
const ADMIN_ROLES = ['admin', 'super_admin', 'superadmin']

export interface AdminContext {
    user: User
    role: NonNullable<ProfileRow['role']>
    isSuperadmin: boolean
    canInviteAdmins: boolean
    canManageUsers: boolean
}

/**
 * Resolve the signed-in admin's role + granular permissions. super_admin
 * implicitly has every permission. Returns a failure shape if not an admin.
 */
export async function getAdminContext(): Promise<
    { ctx: AdminContext; error?: undefined } | { ctx?: undefined; error: string; status: number }
> {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) return { error: 'Unauthorized', status: 401 }

    // Resolve the profile by the canonical link (auth_user_id), falling back to
    // legacy rows linked via profiles.id. Mirrors getCurrentUserRole so admins
    // whose link predates the auth_user_id backfill don't get routed to /profile.
    let { data: profile } = await supabase
        .from('profiles')
        .select('role, can_invite_admins, can_manage_users')
        .eq('auth_user_id', user.id)
        .maybeSingle<ProfileRow>()

    if (!profile) {
        const fallback = await supabase
            .from('profiles')
            .select('role, can_invite_admins, can_manage_users')
            .eq('id', user.id)
            .maybeSingle<ProfileRow>()
        profile = fallback.data
    }

    const role = profile?.role ?? null
    if (!role || !ADMIN_ROLES.includes(role)) {
        return { error: 'Forbidden: Admin access required', status: 403 }
    }
    const isSuperadmin = SUPER_ROLES.includes(role)
    return {
        ctx: {
            user,
            role,
            isSuperadmin,
            canInviteAdmins: isSuperadmin || !!profile?.can_invite_admins,
            canManageUsers: isSuperadmin || !!profile?.can_manage_users,
        },
    }
}

export type AdminCheckSuccess = {
    error?: undefined
    status?: undefined
    user: User
    profile: ProfileRow | null
}

export type AdminCheckFailure = {
    error: string
    status: number
    user?: undefined
    profile?: undefined
}

export type AdminCheckResult = AdminCheckSuccess | AdminCheckFailure

export async function requireAdmin(): Promise<AdminCheckResult> {
    const supabase = await createClient()

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
        return { error: 'Unauthorized', status: 401 }
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('auth_user_id', user.id)
        .maybeSingle<ProfileRow>()

    if (profile?.role === 'admin' || profile?.role === 'super_admin' || profile?.role === 'superadmin') {
        return { user, profile }
    }

    return { error: 'Forbidden: Admin access required', status: 403 }
}

export async function requireSuperadmin(): Promise<AdminCheckResult> {
    const supabase = await createClient()

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
        return { error: 'Unauthorized', status: 401 }
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('auth_user_id', user.id)
        .maybeSingle<ProfileRow>()

    if (profile?.role === 'super_admin' || profile?.role === 'superadmin') {
        return { user, profile }
    }

    return { error: 'Forbidden: Superadmin access required', status: 403 }
}

/** Allow super_admin, or an admin granted `can_manage_users`. */
export async function requireUserManagement(): Promise<AdminCheckResult> {
    const res = await getAdminContext()
    if (!res.ctx) return { error: res.error, status: res.status }
    if (!res.ctx.canManageUsers) {
        return { error: 'Forbidden: gestione utenti non consentita', status: 403 }
    }
    return { user: res.ctx.user, profile: { role: res.ctx.role } }
}

/** Allow super_admin, or an admin granted `can_invite_admins`. */
export async function requireAdminInvite(): Promise<AdminCheckResult> {
    const res = await getAdminContext()
    if (!res.ctx) return { error: res.error, status: res.status }
    if (!res.ctx.canInviteAdmins) {
        return { error: 'Forbidden: invito amministratori non consentito', status: 403 }
    }
    return { user: res.ctx.user, profile: { role: res.ctx.role } }
}
