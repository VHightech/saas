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

    // TENANT RESOLUTION STRATEGY
    // 1. Check for query parameter (Override for testing/preview)
    const searchParams = request.nextUrl.searchParams
    const tenantOverride = searchParams.get('tenant')

    // 2. Resolve by hostname (Custom Domains)
    const hostname = request.headers.get('host') || ''

    let tenantSlug = 'acq'

    if (tenantOverride) {
        tenantSlug = tenantOverride
    } else if (hostname && !hostname.includes('localhost') && !hostname.includes('192.168.')) {
        // Try finding by custom domain
        const { data: tenantByDomain } = await supabase
            .from('tenants')
            .select('slug')
            .eq('domain', hostname)
            .single()

        if (tenantByDomain) {
            tenantSlug = tenantByDomain.slug
        }
    }

    // Set the tenant slug in a header so server components can read it easily
    response.headers.set('x-tenant-slug', tenantSlug)

    // Add CSP for tunnel compatibility and Supabase
    // Note: In production this should be more restrictive
    response.headers.set(
        'Content-Security-Policy',
        "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
        "script-src * 'unsafe-inline' 'unsafe-eval'; " +
        "style-src * 'unsafe-inline'; " +
        "img-src * data: blob:; " +
        "font-src * data:; " +
        "connect-src *; " +
        "frame-src *; " +
        "object-src 'none';"
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
