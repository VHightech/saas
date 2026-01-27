'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

// Helper to create Admin Client (bypass RLS for lookups)
function createAdminClient() {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )
}

// STEP 1: Lookup User
export async function lookupUser(identifier: string) {
    const supabaseAdmin = createAdminClient()

    // 1. Check if identifier is email
    const isEmail = identifier.includes('@')

    let email = null
    let foundProfile = null

    if (isEmail) {
        email = identifier
        // Verify if user exists in auth (optional, or just blindly send)
        // For better UX in enterprise apps, we might check.
        // But for "CIF" lookup we MUST check profiles.
    } else {
        // 2. Lookup by CIF, Client Code, or Username in Profiles
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('email, name, surname')
            .or(`cif.eq.${identifier},codice_cliente.eq.${identifier},user_name.eq.${identifier}`)
            .single()

        if (profile && profile.email) {
            email = profile.email
            foundProfile = profile
        }
    }

    if (!email) {
        return { success: false, error: 'Utenza non trovata.' }
    }

    // Mask the email for privacy (e.g. m***@gmail.com)
    const [local, domain] = email.split('@')
    const maskedLocal = local.length > 2 ? `${local.substring(0, 2)}***` : `${local}***`
    const maskedEmail = `${maskedLocal}@${domain}`

    return {
        success: true,
        maskedEmail,
        // We do NOT return the full email. We return a "found" state.
        // The client must send the 'identifier' again to trigger the OTP.
    }
}

// STEP 2: Send OTP
export async function sendRecoveryOTP(identifier: string) {
    const supabaseAdmin = createAdminClient()
    const supabase = await createClient() // Standard client for auth context if needed? No, signInWithOtp is public usually.

    // access auth admin to send OTP? standard client can do signInWithOtp.

    // Resolve email again (securely on server)
    let email = identifier
    if (!identifier.includes('@')) {
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('email')
            .or(`cif.eq.${identifier},codice_cliente.eq.${identifier},user_name.eq.${identifier}`)
            .single()

        if (!profile?.email) return { success: false, error: 'Errore tecnico. Riprova.' }
        email = profile.email.trim()
    }

    // Ensure email is trimmed
    email = email.trim()

    // Trigger OTP
    // We use the ADMIN client to maybe avoid rate limits? No, standard flow.
    // Actually, `signInWithOtp` logic is client-side usually? No, we can do it server side.

    // We want the code to be sent to email.
    const { error } = await supabaseAdmin.auth.signInWithOtp({
        email: email,
        options: {
            shouldCreateUser: false, // Don't sign up new users
        }
    })

    if (error) {
        console.error('OTP Error:', error)
        if (error.status === 429) {
            return { success: false, error: 'Troppe richieste. Attendi 60 secondi prima di riprovare.' }
        }
        if (error.status === 504) {
            return { success: false, error: 'Timeout del server di posta (SMTP). Contatta il supporto.' }
        }
        return { success: false, error: 'Impossibile inviare il codice. Riprova tra poco.' }
    }

    return { success: true }
}

// STEP 3: Verify OTP & Login
export async function verifyRecoveryOTP(identifier: string, token: string) {
    const supabaseAdmin = createAdminClient()
    const supabase = await createClient() // We need to set the session on the SERVER RESPONSE (cookies)

    // Resolve email
    let email = identifier
    if (!identifier.includes('@')) {
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('email')
            .or(`cif.eq.${identifier},codice_cliente.eq.${identifier},user_name.eq.${identifier}`)
            .single()

        if (!profile?.email) return { success: false, error: 'Utenza non trovata.' }
        email = profile.email.trim()
    }

    // Ensure email is trimmed
    email = email.trim()

    // Verify OTP
    // IMPORTANT: We must use the *Server Client* that has access to Cookies (`message-level`) to persist the session!
    // The `supabase` client from `@/lib/supabase/server` is configured for that.

    const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email'
    })

    if (error) {
        return { success: false, error: 'Codice non valido o scaduto.' }
    }

    // Logic: The user is now "logged in" with a session.

    return { success: true }
}

// STEP 4: Reset Password
export async function updatePassword(password: string) {
    const supabase = await createClient()

    // Ensure session exists
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { success: false, error: 'Sessione scaduta. Ricomincia la procedura.' }
    }

    const { error } = await supabase.auth.updateUser({
        password: password
    })

    if (error) {
        return { success: false, error: 'Errore aggiornamento password.' }
    }

    return { success: true }
}
