import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type UserRole = 'admin' | 'super_admin' | 'superadmin' | 'user'

export async function getCurrentUserRole(): Promise<UserRole> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
        return 'user' // Default safe fallback
    }

    // Profiles can be linked to the auth user in two ways depending on how the
    // account was created:
    //   - auth_user_id = auth.uid  (shadow profile claimed at registration)
    //   - id = auth.uid            (fresh / script / invite-created profile)
    // Resolve the role by EITHER link so admin access is not creation-path
    // dependent (this was the source of admins landing on the user dashboard).
    let { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('auth_user_id', user.id)
        .maybeSingle()

    if (!profile) {
        const byId = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle()
        profile = byId.data
    }

    const role = profile?.role
    if (role === 'admin' || role === 'super_admin' || role === 'superadmin') {
        return role as UserRole
    }

    // Default to 'user'
    return 'user'
}

export async function requireAdmin() {
    const role = await getCurrentUserRole()

    if (role !== 'admin' && role !== 'super_admin' && role !== 'superadmin') {
        redirect('/profile') // Redirect unauthorized users
    }
}
