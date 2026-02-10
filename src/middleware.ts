import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const {
        data: { user },
    } = await supabase.auth.getUser()

    // Authenticated user check if needed (logic simplified)

    // Tighten CSP for better security while maintaining tunnel/Supabase compatibility
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseDomain = supabaseUrl ? new URL(supabaseUrl).hostname : ''

    response.headers.set(
        'Content-Security-Policy',
        `default-src 'self'; ` +
        `script-src 'self' 'unsafe-inline' 'unsafe-eval' *.hcaptcha.com; ` +
        `style-src 'self' 'unsafe-inline' *.hcaptcha.com; ` +
        `img-src 'self' data: blob: ${supabaseDomain} *.hcaptcha.com *; ` +
        `font-src 'self' data: fonts.gstatic.com; ` +
        `connect-src 'self' ${supabaseDomain} *.supabase.co *.trycloudflare.com *.sentry.io *.hcaptcha.com localhost:* 127.0.0.1:* ws://localhost:* ws://127.0.0.1:*; ` +
        `frame-src 'self' *.hcaptcha.com; ` +
        `object-src 'none';`
    )

    // Protected routes logic (optional, can be expanded)
    if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/login'
        return NextResponse.redirect(redirectUrl)
    }

    return response
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - api/auth (auth routes)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|api/auth|api/upload|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
