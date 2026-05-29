import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Identifier whitelist (§1.1) — emails, usernames, CIF, codice_cliente only.
 * No characters that could be abused as PostgREST operators.
 */
export const SAFE_IDENTIFIER = /^[a-zA-Z0-9._@+\-]+$/

/**
 * Resolve a login/recovery identifier to the account email.
 *
 * Single source of truth for the "identifier → email" mapping shared by login
 * and forgot-password (§3.1). Validates against {@link SAFE_IDENTIFIER}, returns
 * emails as-is, otherwise tries cif / codice_cliente / username via sequential
 * `.eq()` (never interpolated `.or()`). Returns null when unresolved.
 *
 * Uses the service-role client to read shadow profiles pre-session — an explicit
 * auth-flow exception to §1.2.
 */
export async function resolveEmailFromIdentifier(identifier: string): Promise<string | null> {
    const clean = identifier.trim()
    if (!SAFE_IDENTIFIER.test(clean)) return null

    if (clean.includes('@')) return clean

    const supabaseAdmin = createAdminClient()

    for (const column of ['cif', 'codice_cliente', 'username'] as const) {
        const { data } = await supabaseAdmin
            .from('profiles')
            .select('email')
            .eq(column, clean)
            .maybeSingle()
        if (data?.email) return data.email.trim()
    }

    return null
}
