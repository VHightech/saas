import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client for local admin scripts. Bypasses RLS.
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (from .env.local).
 */
export function createServiceClient(): SupabaseClient {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
        throw new Error(
            'Config mancante: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (controlla .env.local)'
        )
    }
    return createClient(url, key)
}
