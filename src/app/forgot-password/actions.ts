'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const SAFE_IDENTIFIER = /^[a-zA-Z0-9._@+\-]+$/

// Maschera un'email reale: "mario.rossi@x.it" -> "ma***@x.it".
function maskEmail(email: string): string {
    const [local, domain] = email.split('@')
    const maskedLocal = local.length > 2 ? `${local.substring(0, 2)}***` : `${local}***`
    return `${maskedLocal}@${domain}`
}

// Email mascherata FITTIZIA ma deterministica per identifier, usata quando
// l'utenza non esiste: garantisce una risposta di forma identica al caso reale
// (anti-enumeration, §1.10) senza rivelare l'esistenza dell'account.
function fakeMaskedEmail(identifier: string): string {
    const h = createHash('sha256').update(identifier.trim().toLowerCase()).digest('hex')
    return `${h.substring(0, 2)}***@***`
}

function createAdminClient() {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    )
}

async function resolveEmailFromIdentifier(identifier: string): Promise<string | null> {
    const clean = identifier.trim()
    if (!SAFE_IDENTIFIER.test(clean)) return null

    if (clean.includes('@')) return clean

    const supabaseAdmin = createAdminClient()

    const { data } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('codice_cliente', clean)
        .maybeSingle()

    if (data?.email) return data.email.trim()

    return null
}

// STEP 1: Lookup User — risposta uniforme (sempre success+maskedEmail) così un
// attaccante non può distinguere un'utenza esistente da una inesistente.
export async function lookupUser(identifier: string) {
    const email = await resolveEmailFromIdentifier(identifier)
    return {
        success: true,
        maskedEmail: email ? maskEmail(email) : fakeMaskedEmail(identifier),
    }
}

// STEP 2: Send OTP
export async function sendRecoveryOTP(identifier: string) {
    const email = await resolveEmailFromIdentifier(identifier)
    if (!email) {
        // Generic response to prevent enumeration.
        return { success: true }
    }

    const supabaseAdmin = createAdminClient()

    const { error } = await supabaseAdmin.auth.signInWithOtp({
        email,
        options: {
            shouldCreateUser: false,
        },
    })

    if (error) {
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
    const email = await resolveEmailFromIdentifier(identifier)
    // Stesso messaggio del codice errato: non riveliamo se l'utenza esiste.
    if (!email) return { success: false, error: 'Codice non valido o scaduto.' }

    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
    })

    if (error) {
        return { success: false, error: 'Codice non valido o scaduto.' }
    }

    return { success: true }
}

// STEP 4: Reset Password
export async function updatePassword(password: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { success: false, error: 'Sessione scaduta. Ricomincia la procedura.' }
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"|<>?,./`~]).{8,}$/
    if (!passwordRegex.test(password)) {
        return {
            success: false,
            error: 'La password deve contenere almeno 8 caratteri, una lettera maiuscola, una minuscola, un numero e un carattere speciale (es. ! @ # $ % & *).',
        }
    }

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
        return { success: false, error: error.message }
    }

    return { success: true }
}
