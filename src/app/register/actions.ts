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
    const name = (formData.get('name') as string)?.trim()

    const username = (formData.get('username') as string)?.trim()
    const clientCode = (formData.get('client_code') as string)?.trim()

    // 1. Tenant Resolution Removed (Single Tenant)
    const headersList = await headers()

    // 0. SECURITY CHECK: Verify if Client Code exists in Profiles
    // We only allow registration if the user's data is already pre-loaded (e.g. from CSV import)
    const { data: existingProfile, error: profileCheckError } = await supabaseAdmin
        .from('profiles')
        .select('id, codice_cliente, name, email')
        .eq('codice_cliente', clientCode)
        .maybeSingle()

    // If NO profile is found with this client code, we BLOCK registration and ALERT admin
    if (!existingProfile) {
        console.warn(`[SECURITY] Registration blocked for invalid Client Code: ${clientCode} (Email: ${email})`)

        // Send Email Alert to Admin
        const adminEmail = process.env.ADMIN_EMAIL
        if (adminEmail) {
            try {
                const emailHtml = await render(
                    SecurityAlertEmail({
                        name,
                        email,
                        username,
                        clientCode,
                        timestamp: new Date().toLocaleString('it-IT')
                    })
                )

                await resend.emails.send({
                    from: 'Acquambiente Security <noreply@resend.dev>',
                    to: adminEmail,
                    subject: '🚨 Tentativo di Registrazione Non Autorizzato',
                    html: emailHtml
                })
                console.log(`[SECURITY] Alert email sent to ${adminEmail}`)
            } catch (emailError) {
                console.error('[SECURITY] Failed to send alert email:', emailError)
            }
        }

        return {
            error: "Codice Cliente non riconosciuto. La registrazione è riservata alle utenze censite. Se ritieni sia un errore, contatta l'assistenza."
        }
    }

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

    // 3. Link Existing Bills (Claim Shadow Data)
    // Check if there are bills for this CIF/ClientCode that need to be claimed
    // We update bills to point to the new user_id
    // Use Admin Client to bypass RLS
    await supabaseAdmin.from('bills')
        .update({ user_id: authData.user.id })
        .eq('codice_cliente', clientCode)

    // 4. Handle potentially existing Shadow Profile
    // Use Admin Client to bypass RLS
    await supabaseAdmin.from('profiles')
        .delete()
        .eq('is_shadow', true)
        .eq('codice_cliente', clientCode)

    // 5. Update/Create Profile
    // We use upsert because the DB Trigger might have already created a skeleton profile.
    const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
            id: authData.user.id,
            name,
            email,
            username,
            codice_cliente: clientCode,
            // legacy_id: 0, // Removed to prevent unique constraint violation (legacy_id must be unique or null)
            is_shadow: false, // Explicitly not shadow
            role: 'user' // Default role
        })

    if (profileError) {
        console.error('Profile creation error:', profileError)
        // Check for unique constraint violation (Postgres error 23505)
        if (profileError.code === '23505') {
            if (profileError.message.includes('username')) {
                return { error: 'Questo Username è già stato utilizzato.' }
            }
            if (profileError.message.includes('cif')) {
                return { error: 'Questo CIF/P.IVA risulta già registrato.' }
            }
            return { error: 'Dati duplicati (Username o CIF già in uso).' }
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
