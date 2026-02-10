import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type UserRole = 'admin' | 'user'

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

    if (profile?.role && profile.role === 'admin') {
        return profile.role as UserRole
    }

    // 2. Default to 'user'
    return 'user'
}

export async function requireAdmin() {
    const role = await getCurrentUserRole()

    if (role !== 'admin') {
        redirect('/dashboard') // Redirect unauthorized users
    }
}
