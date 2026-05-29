import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

type ProfileRow = {
    role: 'admin' | 'super_admin' | 'superadmin' | 'user' | null
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

type Role = NonNullable<ProfileRow['role']>

// Single fetch+check seam. Returns the session user + their profile if the role
// is in `allowed`; otherwise a typed failure. Deny-by-default (§1.3).
async function requireRole(allowed: readonly Role[], forbiddenMsg: string): Promise<AdminCheckResult> {
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

    if (profile?.role && (allowed as readonly (string | null)[]).includes(profile.role)) {
        return { user, profile }
    }

    return { error: forbiddenMsg, status: 403 }
}

/** Allow admin, super_admin, superadmin. */
export function requireAdmin(): Promise<AdminCheckResult> {
    return requireRole(['admin', 'super_admin', 'superadmin'], 'Forbidden: Admin access required')
}

/** Allow super_admin, superadmin only. */
export function requireSuperadmin(): Promise<AdminCheckResult> {
    return requireRole(['super_admin', 'superadmin'], 'Forbidden: Superadmin access required')
}
