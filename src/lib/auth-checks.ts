import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function requireAdmin() {
    const supabase = await createClient()

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
        return { error: 'Unauthorized', status: 401 }
    }

    // 1. Check Profiles (Standard Users)
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

    if (profile?.role === 'admin' || profile?.role === 'superadmin') {
        return { user, profile, startServiceRole: false }
    }

    // 2. Check Tenant Admins (Admins/Staff)
    const { data: adminProfile, error: adminError } = await supabase
        .from('tenant_admins')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

    if (adminProfile?.role === 'admin' || adminProfile?.role === 'super_admin') {
        // Return a mock profile object or the admin profile so downstream code works
        // We merge it with user metadata if needed, or just return basic info
        return {
            user,
            profile: { ...adminProfile, id: user.id },
            startServiceRole: false
        }
    }

    return { error: 'Forbidden: Admin access required', status: 403 }

    return { user, profile, startServiceRole: false } // Success
}
