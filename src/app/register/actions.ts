'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'
import { render } from '@react-email/render'
import SecurityAlertEmail from '@/components/emails/security-alert'
import { headers } from 'next/headers'

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY)

export async function register(formData: FormData) {
    const supabase = await createClient()

    // Admin client for privileged pre-session lookups on shadow profiles (§1.2 auth-flow exception).
    const supabaseAdmin = createAdminClient()

    const email = (formData.get('email') as string)?.trim()
    const password = formData.get('password') as string
    const fiscalCode = (formData.get('fiscal_code') as string)?.trim().toUpperCase()
    const clientCode = (formData.get('client_code') as string)?.trim()
    const fullNameInput = (formData.get('full_name') as string)?.trim() || ''

    // 1. Tenant Resolution Removed (Single Tenant)
    const headersList = await headers()

    // 0. SECURITY CHECK: Verify if Client Code exists AND matches Fiscal Code
    // We only allow registration if the user's data is already pre-loaded (e.g. from CSV import)
    const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, codice_cliente, name, email, cfpi')
        .eq('codice_cliente', clientCode)
        .maybeSingle()

    // Validation Logic:
    // 1. Profile must exist (or they must have valid bills/supplies)
    // 2. Must match the provided Fiscal Code (either via CIF or CFPI)
    let isValid = false;
    let name = '';

    if (existingProfile) {
        // Validate against CFPI (Fiscal Code / VAT)
        isValid = (existingProfile.cfpi && existingProfile.cfpi.toUpperCase() === fiscalCode)
        if (isValid) {
            name = existingProfile.name || fullNameInput;
        }
    }

    // Fallback: If no shadow profile exists, check if they have valid supplies or bills.
    // SECURITY (C-1 fix 2026-05-06): we MUST validate against the user's CF/PIVA (cfpi),
    // NOT against the technical Codice Identificativo Fornitura (cif) — `cif` is printed
    // on every paper bill and would let anyone with a paper bill claim the account.
    if (!isValid && !existingProfile) {
        const { data: supplyFallback } = await supabaseAdmin
            .from('user_supplies')
            .select('id, codice_cliente, cfpi')
            .eq('codice_cliente', clientCode)
            .not('cfpi', 'is', null)
            .limit(1)
            .maybeSingle()

        if (supplyFallback?.cfpi && supplyFallback.cfpi.toUpperCase() === fiscalCode) {
            isValid = true;
            name = fullNameInput;
        } else {
            const { data: billFallback } = await supabaseAdmin
                .from('bills')
                .select('id, codice_cliente, cfpi')
                .eq('codice_cliente', clientCode)
                .not('cfpi', 'is', null)
                .limit(1)
                .maybeSingle()

            if (billFallback?.cfpi && billFallback.cfpi.toUpperCase() === fiscalCode) {
                isValid = true;
                name = fullNameInput;
            }
        }
    }

    if (!isValid) {
        console.warn('[SECURITY] Registration blocked: identity mismatch')
        return {
            error: "Dati non corrispondenti. Verifica di aver inserito correttamente Codice Cliente e Codice Fiscale/P.IVA."
        }
    }

    // Name is already set above

    // 1b. Password Complexity Validation
    // Requires: Lowercase, Uppercase, Digit, Special Character, Min 8 chars
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"|<>?,./`~]).{8,}$/

    if (!passwordRegex.test(password)) {
        return {
            error: "La password deve contenere almeno 8 caratteri, una lettera maiuscola, una minuscola, un numero e un carattere speciale (es. ! @ # $ % & *)."
        }
    }

    // 2. Create User via Public API (Triggers Confirm Email)
    const captchaToken = formData.get('captchaToken') as string
    const origin = headersList.get('origin')

    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            captchaToken,
            emailRedirectTo: `${origin}/auth/callback`,
            data: {
                full_name: name,
                codice_cliente: clientCode || null
            }
        }
    })
    if (authError) {
        console.error('Sign Up Error:', authError)
        return { error: authError.message }
    }

    if (!authData.user) {
        // If email confirmation is required, user object is returned but session is null.
        // If approval required, user might be null? Usually user is returned.
        return { error: "Errore durante la creazione dell'account. Riprova." }
    }

    // 3. Profile finalization.
    //    The handle_new_user trigger has already done one of two things:
    //      (a) If a shadow profile existed for clientCode, it set
    //          auth_user_id = new.id and is_shadow = false on that shadow row
    //          — bills/supplies/payments remain pointing at profiles.id, no
    //          row migration needed.
    //      (b) Otherwise, it inserted a fresh profile with
    //          id = auth_user_id = new.id.
    //    We just enrich the linked profile row with any extra fields collected
    //    by the form that the trigger didn't set.
    const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
            name: name,
            email: email,
            cfpi: fiscalCode,
            role: 'user',
            is_shadow: false,
        })
        .eq('auth_user_id', authData.user.id)

    if (profileError) {
        console.error('Profile finalize error:', profileError.code)
        if (profileError.code === '23505') {
            return { error: 'Dati non validi o già in uso. Verifica e riprova.' }
        }
        return { error: 'Account creato, ma errore nel salvataggio del profilo.' }
    }

    revalidatePath('/', 'layout')

    // Do NOT redirect. Return success so UI can show check email message.
    return { success: true }
}

export async function resendConfirmationEmail(email: string) {
    const supabase = await createClient()
    const headersList = await headers()
    const origin = headersList.get('origin')

    const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
            emailRedirectTo: `${origin}/auth/callback`
        }
    })

    if (error) {
        console.error('Resend Error:', error)
        return { error: 'Si è verificato un errore. Riprova più tardi.' }
    }

    return { success: true }
}
