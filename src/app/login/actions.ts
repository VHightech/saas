'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
    const supabase = await createClient()

    const identifier = formData.get('identifier') as string
    const password = formData.get('password') as string
    const captchaToken = formData.get('captchaToken') as string

    let emailToUse = identifier

    console.log('--- Login Attempt ---')
    console.log('Identifier provided:', identifier)

    // If it's not an email (simple check), try to find the email by username or CIF
    const isEmail = identifier.includes('@')

    if (!isEmail) {
        console.log('Identifier is not an email, looking up profile...')
        // Try to look up profile by username or CIF
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('email')
            .or(`username.eq.${identifier},cif.eq.${identifier}`)
            .single()

        if (profileError) {
            console.log('Profile lookup error:', profileError)
        }

        if (profile && profile.email) {
            console.log('Profile found, mapping to email:', profile.email)
            emailToUse = profile.email
        } else {
            console.log('No profile found for this identifier.')
        }
    }

    console.log('Attempting sign in with email:', emailToUse)

    const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password,
        options: { captchaToken }
    })

    if (error) {
        console.error('Supabase Sign In Error:', error)
        if (error.message.includes('Email not confirmed')) {
            return { error: 'Email non confermata. Controlla la tua casella di posta.' }
        }
        // Generic error message for security
        return { error: 'Credenziali non valide.' }
    }

    const role = data.user?.app_metadata?.role

    revalidatePath('/', 'layout')

    if (role === 'admin') {
        redirect('/admin/users')
    } else {
        redirect('/dashboard')
    }
}
export async function logout() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
}
