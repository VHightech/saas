'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/**
 * Fetches the current user's profile and bills securely on the server.
 * Profile is looked up via `auth_user_id` (the canonical link to auth.users).
 * Child rows (bills, supplies, payments) are filtered by `profile.id`.
 */
export async function getUserDashboardData() {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
        redirect('/login')
    }

    // 1. Fetch profile via auth_user_id pointer.
    let { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('auth_user_id', user.id)
        .maybeSingle()

    if (profileError) {
        console.error('Detailed Profile Error:', JSON.stringify(profileError, null, 2))
        return { error: `Failed to fetch profile: ${profileError.message}` }
    }

    // Auto-recovery: if no profile yet, the trigger may not have run (rare) or
    // a shadow exists for the codice in metadata but wasn't linked. Try to
    // link it via the simplified RPC.
    if (!profile) {
        const codiceCliente: string | null =
            user.app_metadata?.codice_cliente
            ?? user.user_metadata?.codice_cliente
            ?? null

        if (codiceCliente) {
            const { createAdminClient } = await import('@/lib/supabase/admin')
            const admin = createAdminClient()

            const { error: activationError } = await admin.rpc('activate_shadow_profile', {
                p_real_user_id: user.id,
                p_codice_cliente: codiceCliente,
            })

            if (activationError) {
                console.error('[getUserDashboardData] activation recovery failed:', activationError.message)
                return { error: 'Profilo non disponibile. Contatta il supporto.' }
            }

            const retry = await supabase
                .from('profiles')
                .select('*')
                .eq('auth_user_id', user.id)
                .maybeSingle()

            profile = retry.data
        }

        if (!profile) {
            console.error('Profile not found for auth user:', user.id, '— recovery exhausted')
            return { error: 'Profilo non disponibile. Contatta il supporto.' }
        }
    }

    const profileId = profile.id as string

    // 2. Bills
    const { data: bills, error: billsError } = await supabase
        .from('bills')
        .select('*')
        .eq('user_id', profileId)
        .order('data_emissione', { ascending: false })

    if (billsError) {
        console.error('Error fetching bills:', billsError)
        return { profile, bills: [] as any[], supplies: [] as any[], error: 'Failed to fetch bills' }
    }

    // 3. User supplies
    const { data: supplies, error: suppliesError } = await supabase
        .from('user_supplies')
        .select('*')
        .eq('user_id', profileId)
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
