'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

import { createClient as createAdminClient } from '@supabase/supabase-js'

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
    // const surname = (formData.get('surname') as string)?.trim() // Removed
    const username = (formData.get('username') as string)?.trim()
    const cfpi = (formData.get('cfpi') as string)?.trim()
    const cif = (formData.get('cif') as string)?.trim()
    const clientCode = (formData.get('client_code') as string)?.trim()

    // 1. Password Complexity Validation
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/
    if (!passwordRegex.test(password)) {
        return {
            error: "La password deve essere di almeno 8 caratteri e contenere almeno una lettera maiuscola e un numero."
        }
    }

    // 2. Create User via Admin API (Detailed Errors & Auto-Confirm)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-verify email
        user_metadata: {
            full_name: name,
            username,
        }
    })

    if (authError) {
        console.error('Admin Create Error:', authError)
        return { error: authError.message }
    }

    if (!authData.user) {
        return { error: "Errore durante la creazione dell'account." }
    }

    // 2b. Sign In immediately to create session (since Admin createUser doesn't return session)
    const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
    })

    if (signInError) {
        console.error('Auto-login failed:', signInError)
        // We continue anyway, user can login manually if needed, but best to warn?
        // Actually, preventing the redirect is better if login fails.
        return { error: "Account creato, ma login automatico fallito. Prova ad accedere manualmente." }
    }

    // 3. Link Existing Bills (Claim Shadow Data)
    // Check if there are bills for this CIF/ClientCode that need to be claimed
    // We update bills to point to the new user_id
    // Use Admin Client to bypass RLS
    await supabaseAdmin.from('bills')
        .update({ user_id: authData.user.id })
        .or(`cif.eq.${cif},codice_cliente.eq.${clientCode}`)

    // 4. Handle potentially existing Shadow Profile
    // Use Admin Client to bypass RLS
    await supabaseAdmin.from('profiles')
        .delete()
        .eq('is_shadow', true)
        .or(`cif.eq.${cif},codice_cliente.eq.${clientCode}`)

    // 5. Create Profile (Public Table)
    // Use Admin Client to bypass RLS (INSERT usually requires admin if no policy exists for 'authenticated' to insert self)
    const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
            id: authData.user.id,
            name,
            surname: '', // Empty as requested
            email,
            username,
            cfpi,       // Codice Fiscale or P.IVA
            cif,        // CIF
            codice_cliente: clientCode,
            legacy_id: 0,    // New users are not legacy
            is_shadow: false // Explicitly not shadow
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
    redirect('/dashboard') // Or specific success page
}
