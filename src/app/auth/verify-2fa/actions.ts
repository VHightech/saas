'use server'

import { redirect } from 'next/navigation'
// import { createClient } from '@/lib/supabase/server'

export async function verifyOtp(formData: FormData) {
    // const supabase = await createClient()
    const token = formData.get('token') as string

    console.log('Verifying token:', token)

    // Verify logic here with Supabase
    // const { error } = await supabase.auth.verifyOtp({ token, type: 'email', email: '...' })

    // Mock success for now
    redirect('/dashboard')
}
