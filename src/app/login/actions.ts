'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
    const supabase = await createClient()

    const identifier = formData.get('identifier') as string
    const password = formData.get('password') as string

    let emailToUse = identifier

    // If it's not an email (simple check), try to find the email by username or CIF
    const isEmail = identifier.includes('@')

    if (!isEmail) {
        // Try to look up profile by username or CIF
        // Note: 'username' column needs to exist in your schema.
        // Based on register action, it seems you have it or intend to have it.
        // We check against 'cif' or 'username' (if column exists).
        // Assuming 'username' might not be in schema.sql but implied by register action.

        const { data: profile } = await supabase
            .from('profiles')
            .select('email')
            .eq('username', identifier)
            .single()

        if (profile && profile.email) {
            emailToUse = profile.email
        }
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password,
    })

    if (error) {
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
