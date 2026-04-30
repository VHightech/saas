'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/**
 * Fetches the current user's profile and bills securely on the server.
 * No query parameters are accepted - everything is derived from the session.
 */
export async function getUserDashboardData() {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
        redirect('/login')
    }

    // 1. Fetch Profile
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .eq('id', user.id)
        .maybeSingle()

    if (profileError) {
        console.error('Detailed Profile Error:', JSON.stringify(profileError, null, 2))
        return { error: `Failed to fetch profile: ${profileError.message}` }
    }

    if (!profile) {
        console.error('Profile not found for user:', user.id)
        // Check if RLS is the cause or data is missing
        return { error: 'Profile not found. (Check RLS policies or Database)' }
    }

    // 2. Fetch Bills (Only for this user)
    // We order by emission date descending to show newest first
    const { data: bills, error: billsError } = await supabase
        .from('bills')
        .select('*')
        .eq('user_id', user.id)
        .order('data_emissione', { ascending: false })

    if (billsError) {
        console.error('Error fetching bills:', billsError)
        return { profile, bills: [] as any[], supplies: [] as any[], error: 'Failed to fetch bills' }
    }

    // 3. Fetch User Supplies (per-fornitura address/city)
    const { data: supplies, error: suppliesError } = await supabase
        .from('user_supplies')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

    if (suppliesError) {
        console.error('Error fetching user_supplies:', suppliesError)
    }

    return {
        profile,
        bills: (bills || []) as any[],
        supplies: (supplies || []) as any[],
    }
}
