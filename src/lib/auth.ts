import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type UserRole = 'super_admin' | 'admin' | 'user'

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

    if (profile?.role && (profile.role === 'admin' || profile.role === 'superadmin')) {
        return profile.role as UserRole
    }

    // 2. Fallback: Check tenant_admins (Legacy/Staff table)
    const { data: adminData } = await supabase
        .from('tenant_admins')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

    if (adminData?.role) {
        return adminData.role as UserRole
    }

    // 3. Default to 'user'
    return 'user'
}

export async function requireSuperAdmin() {
    const role = await getCurrentUserRole()

    if (role !== 'super_admin') {
        redirect('/dashboard') // Redirect unauthorized users
    }
}
