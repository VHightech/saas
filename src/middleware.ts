import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    // Only protected areas need the (network) auth check. Public pages skip it
    // entirely — calling supabase.auth.getUser() on every request adds a
    // round-trip to the Supabase Auth server (in eu-west-1) to every page load.
    const path = request.nextUrl.pathname
    const needsAuth = path.startsWith('/profile') || path.startsWith('/admin')

    let user = null
    if (needsAuth) {
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return request.cookies.getAll()
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
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
        const result = await supabase.auth.getUser()
        user = result.data.user
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseDomain = supabaseUrl ? new URL(supabaseUrl).hostname : ''

    const isDev = process.env.NODE_ENV !== 'production'
    // React Server Components currently require 'unsafe-inline' for style hydration.
    // In dev we keep 'unsafe-eval' for React DevTools + Turbopack HMR.
    const scriptSrcExtras = isDev ? `'unsafe-eval'` : ''

    const csp = [
        `default-src 'self'`,
        `script-src 'self' 'unsafe-inline' ${scriptSrcExtras} challenges.cloudflare.com`,
        `style-src 'self' 'unsafe-inline'`,
        `img-src 'self' data: blob: ${supabaseDomain} challenges.cloudflare.com`,
        `font-src 'self' data: fonts.gstatic.com`,
        `connect-src 'self' ${supabaseDomain} *.supabase.co challenges.cloudflare.com${isDev ? ' *.trycloudflare.com localhost:* 127.0.0.1:* ws://localhost:* ws://127.0.0.1:*' : ''}`,
        `frame-src 'self' challenges.cloudflare.com`,
        `object-src 'none'`,
        `base-uri 'self'`,
        `form-action 'self'`,
        `frame-ancestors 'none'`,
    ].join('; ')

    response.headers.set('Content-Security-Policy', csp)
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    if (!isDev) {
        response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
    }

    if (!user && request.nextUrl.pathname.startsWith('/profile')) {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/login'
        return NextResponse.redirect(redirectUrl)
    }

    if (!user && request.nextUrl.pathname.startsWith('/admin')) {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/login'
        return NextResponse.redirect(redirectUrl)
    }

    return response
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|api/auth|api/upload|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
