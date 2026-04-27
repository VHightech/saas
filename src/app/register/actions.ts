'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { render } from '@react-email/render'
import SecurityAlertEmail from '@/components/emails/security-alert'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY)

export async function register(formData: FormData) {
    const supabase = await createClient()

    // Create Admin Client for privileged operations (bypassing public API restrictions)
    const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )

    const email = (formData.get('email') as string)?.trim()
    const password = formData.get('password') as string
    const fiscalCode = (formData.get('fiscal_code') as string)?.trim().toUpperCase()
    const clientCode = (formData.get('client_code') as string)?.trim()
    const fullNameInput = (formData.get('full_name') as string)?.trim() || ''

    // Automatically assign the username since the UI no longer collects it.
    // Fiscal Code is unique per user and works perfectly as a behind-the-scenes username.
    const username = fiscalCode || clientCode;

    // 1. Tenant Resolution Removed (Single Tenant)
    const headersList = await headers()

    // 0. SECURITY CHECK: Verify if Client Code exists AND matches Fiscal Code
    // We only allow registration if the user's data is already pre-loaded (e.g. from CSV import)
    const { data: existingProfile, error: profileCheckError } = await supabaseAdmin
        .from('profiles')
        .select('id, codice_cliente, name, email, cif, cfpi')
        .eq('codice_cliente', clientCode)
        .maybeSingle()

    // Validation Logic:
    // 1. Profile must exist (or they must have valid bills/supplies)
    // 2. Must match the provided Fiscal Code (either via CIF or CFPI)
    let isValid = false;
    let name = '';
    let existingProfileId: string | null = null;

    if (existingProfile) {
        isValid = (
            (existingProfile.cif && existingProfile.cif.toUpperCase() === fiscalCode) ||
            (existingProfile.cfpi && existingProfile.cfpi.toUpperCase() === fiscalCode)
        )
        if (isValid) {
            name = existingProfile.name || fullNameInput;
            existingProfileId = existingProfile.id;
        }
    }

    // Fallback: If no shadow profile exists, check if they have valid supplies or bills
    // We must validate that the provided fiscalCode matches the 'cif' in these tables.
    if (!isValid && !existingProfile) {
        const { data: supplyFallback } = await supabaseAdmin
            .from('user_supplies')
            .select('id, codice_cliente, cif')
            .eq('codice_cliente', clientCode)
            .limit(1)
            .maybeSingle()

        if (supplyFallback && supplyFallback.cif && supplyFallback.cif.toUpperCase() === fiscalCode) {
            isValid = true;
            name = fullNameInput; // Fallback to user-provided name
        } else {
            const { data: billFallback } = await supabaseAdmin
                .from('bills')
                .select('id, codice_cliente, cif')
                .eq('codice_cliente', clientCode)
                .limit(1)
                .maybeSingle()

            if (billFallback && billFallback.cif && billFallback.cif.toUpperCase() === fiscalCode) {
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
                username,
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

    // 3. Update/Create Profile (Skeleton)
    // We do this FIRST to ensure foreign key constraints on bills and user_supplies don't fail.
    // CRITICAL: We purposely omit `codice_cliente` here because the old shadow profile still holds it,
    // and passing it now would violate the `profiles_codice_cliente_key` unique constraint.
    const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
            id: authData.user.id,
            name,
            email,
            username,
            cfpi: fiscalCode, // Save the CFPI from registration
            is_shadow: false,
            role: 'user'
        })

    if (profileError) {
        console.error('Profile creation error:', profileError)
        if (profileError.code === '23505') {
            if (profileError.message.includes('username')) return { error: 'Questo Username è già stato utilizzato.' }
            if (profileError.message.includes('cif')) return { error: 'Questo CIF/P.IVA risulta già registrato.' }
            return { error: 'Dati duplicati (Username o CIF già in uso).' }
        }
        return { error: 'Account creato, ma errore nel salvataggio del profilo.' }
    }

    // 4. Link Existing Data (Claim Shadow Data)
    if (existingProfileId) {
        const { error: billsUpdateError } = await supabaseAdmin.from('bills')
            .update({ user_id: authData.user.id })
            .eq('user_id', existingProfileId)
        if (billsUpdateError) console.error("Bills Update Error:", billsUpdateError)

        const { error: suppliesUpdateError } = await supabaseAdmin.from('user_supplies')
            .update({ user_id: authData.user.id })
            .eq('user_id', existingProfileId)
        if (suppliesUpdateError) console.error("Supplies Update Error:", suppliesUpdateError)
    } else {
        // Fallback: Claim orphaned bills and supplies by codice_cliente directly
        const { error: billsUpdateError } = await supabaseAdmin.from('bills')
            .update({ user_id: authData.user.id })
            .eq('codice_cliente', clientCode)
        if (billsUpdateError) console.error("Bills Update Error (Fallback):", billsUpdateError)

        const { error: suppliesUpdateError } = await supabaseAdmin.from('user_supplies')
            .update({ user_id: authData.user.id })
            .eq('codice_cliente', clientCode)
        if (suppliesUpdateError) console.error("Supplies Update Error (Fallback):", suppliesUpdateError)
    }

    // 5. Handle existing Shadow Profile
    // Delete the old shadow profile to avoid duplicates now that data is migrated.
    // This officially frees up the unique `codice_cliente`.
    if (existingProfileId && existingProfileId !== authData.user.id) {
        const { error: shadowDeleteError } = await supabaseAdmin.from('profiles')
            .delete()
            .eq('id', existingProfileId)
            .eq('is_shadow', true)
        if (shadowDeleteError) console.error("Shadow Profile Delete Error:", shadowDeleteError)
    }

    // 6. Complete Profile Migration
    // Now that the unique constraint lock is lifted, attach the codice_cliente to the real profile.
    if (clientCode) {
        const { error: finalUpdateError } = await supabaseAdmin.from('profiles')
            .update({ codice_cliente: clientCode })
            .eq('id', authData.user.id)

        if (finalUpdateError) console.error("Profile Finalization Error:", finalUpdateError)
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
