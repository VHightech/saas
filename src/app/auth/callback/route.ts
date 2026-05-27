
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const rawNext = searchParams.get('next') ?? '/profile'
    // Whitelist: solo path interni assoluti, niente '//' né backslash (che alcuni
    // browser normalizzano in '/', aggirando un controllo su solo '//').
    const SAFE_NEXT = /^\/(?!\/)[A-Za-z0-9/_\-.]*$/
    const next = SAFE_NEXT.test(rawNext) ? rawNext : '/profile'

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            return NextResponse.redirect(`${origin}${next}`)
        }
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
