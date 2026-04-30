'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
    const supabase = await createClient()

    const identifierRaw = formData.get('identifier') as string
    const password = formData.get('password') as string
    const captchaToken = formData.get('captchaToken') as string

    const identifier = (identifierRaw || '').trim()

    if (!identifier || !password) {
        return { error: 'Credenziali non valide.' }
    }

    // Basic sanity check to prevent PostgREST operator abuse: identifiers are emails,
    // usernames, CIF or codice_cliente — all alphanumerical with limited punctuation.
    const safeIdentifierPattern = /^[a-zA-Z0-9._@+\-]+$/
    if (!safeIdentifierPattern.test(identifier)) {
        return { error: 'Credenziali non valide.' }
    }

    let emailToUse = identifier
    const isEmail = identifier.includes('@')

    if (!isEmail) {
        // Two sequential parametrised lookups — no string templating into PostgREST filters.
        const byUsername = await supabase
            .from('profiles')
            .select('email')
            .eq('username', identifier)
            .maybeSingle()

        if (byUsername.data?.email) {
            emailToUse = byUsername.data.email
        } else {
            const byCif = await supabase
                .from('profiles')
                .select('email')
                .eq('cif', identifier)
                .maybeSingle()
            if (byCif.data?.email) {
                emailToUse = byCif.data.email
            }
        }
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password,
        options: { captchaToken }
    })

    if (error) {
        if (error.message.includes('Email not confirmed')) {
            return { error: 'Email non confermata. Controlla la tua casella di posta.' }
        }
        return { error: 'Credenziali non valide.' }
    }

    // We must fetch the role from the 'profiles' table because app_metadata might not be synced
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()

    const userRole = profile?.role || 'user'

    if (userRole === 'admin' || userRole === 'super_admin' || userRole === 'superadmin') {
        redirect('/admin/users') // Default safe admin page
    } else {
        redirect('/profile')
    }
}
export async function logout() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
}
