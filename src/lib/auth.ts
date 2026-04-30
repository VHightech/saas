import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type UserRole = 'admin' | 'super_admin' | 'superadmin' | 'user'

export async function getCurrentUserRole(): Promise<UserRole> {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
        return 'user' // Default safe fallback
    }

    // 1. Check in profiles table (Unified Role System)
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

    const role = profile?.role
    if (role === 'admin' || role === 'super_admin' || role === 'superadmin') {
        return role as UserRole
    }

    // 2. Default to 'user'
    return 'user'
}

export async function requireAdmin() {
    const role = await getCurrentUserRole()

    if (role !== 'admin' && role !== 'super_admin' && role !== 'superadmin') {
        redirect('/profile') // Redirect unauthorized users
    }
}
