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
