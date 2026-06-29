'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { verifyTurnstileToken } from '@/lib/captcha'
import { logAuthEvent, bumpAndCheckRateLimit } from '@/lib/auth-events'

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
        const { createAdminClient } = await import('@/lib/supabase/admin')
        const adminClient = createAdminClient()

        // 1. Try Lookup by Codice Cliente (6 digits)
        if (identifier.length === 6 && /^\d+$/.test(identifier)) {
            const { data } = await adminClient
                .from('profiles')
                .select('email')
                .eq('codice_cliente', identifier)
                .maybeSingle()
            if (data?.email) {
                emailToUse = data.email
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

    // Resolve the role from the just-authenticated user id via the admin client.
    // Doing it here (rather than re-reading the session with getUser() right after
    // sign-in, which can race the cookie write and is also constrained by RLS)
    // guarantees the redirect sees the real role. Profiles link to the auth user
    // by auth_user_id (shadow-claimed) OR id (script/invite-created) — check both.
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const adminClient = createAdminClient()

    let { data: roleRow } = await adminClient
        .from('profiles')
        .select('role')
        .eq('auth_user_id', data.user.id)
        .maybeSingle()

    if (!roleRow) {
        const byId = await adminClient
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .maybeSingle()
        roleRow = byId.data
    }

    const userRole = roleRow?.role || 'user'

    if (userRole === 'admin' || userRole === 'super_admin' || userRole === 'superadmin') {
        redirect('/admin/users') // Default safe admin page
    } else {
        redirect('/profile')
    }
}

// Generic response — never reveals whether a codice exists, whether the account
// is already activated, or any email information. Returned for ALL non-error
// outcomes (success, not found, already activated, captcha fail, rate limit).
// Only true system errors return a different message.
const GENERIC_OK_MESSAGE =
    "Se il Codice Cliente è registrato e non ancora attivato, riceverai un'email con il link per completare l'attivazione. Controlla anche la cartella spam."

// Numero assistenza mostrato quando l'utenza esiste ma non ha un'email a sistema.
// TODO: sostituire con il numero reale dell'assistenza Acquambiente.
const ASSISTANCE_PHONE = '800069718'

export async function initiateFirstAccess(codiceCliente: string, captchaToken?: string) {
    const { headers } = await import('next/headers')
    const headersList = await headers()
    const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim()
              || headersList.get('x-real-ip')
              || null
    const userAgent = headersList.get('user-agent') || null

    // 1. Input validation — uniform response on any malformed input.
    const cleanCode = (codiceCliente || '').trim()
    if (!/^\d{6}$/.test(cleanCode)) {
        await logAuthEvent({
            eventType: 'first_access',
            ip,
            userAgent,
            outcome: 'failure',
            reason: 'invalid_format',
        })
        return { error: 'Codice Cliente non valido. Inserisci 6 cifre.' }
    }

    // Dev-mode bypass: skip rate limits and captcha while NODE_ENV !== 'production'.
    // This keeps the defensive code paths in place but lets us hammer the flow during
    // local testing. Production behaviour is unchanged.
    const isDev = process.env.NODE_ENV !== 'production'

    if (!isDev) {
        // 2. IP-based rate limit (covers enumeration / brute force).
        const ipBucket = `first_access:ip:${ip ?? 'unknown'}`
        const ipCheck = await bumpAndCheckRateLimit(ipBucket, 10, 10) // 10 attempts / 10 min
        if (ipCheck.limited) {
            await logAuthEvent({
                eventType: 'first_access',
                codiceCliente: cleanCode,
                ip,
                userAgent,
                outcome: 'rate_limited',
                reason: 'ip_throttle',
                metadata: { count: ipCheck.count },
            })
            return { error: 'Troppi tentativi. Riprova tra qualche minuto.' }
        }

        // 3. Per-codice rate limit (prevents targeted DoS of a single user's invite flow).
        const codiceBucket = `first_access:codice:${cleanCode}`
        const codiceCheck = await bumpAndCheckRateLimit(codiceBucket, 3, 30) // 3 attempts / 30 min
        if (codiceCheck.limited) {
            await logAuthEvent({
                eventType: 'first_access',
                codiceCliente: cleanCode,
                ip,
                userAgent,
                outcome: 'rate_limited',
                reason: 'codice_throttle',
                metadata: { count: codiceCheck.count },
            })
            return { success: true, message: GENERIC_OK_MESSAGE }
        }

        // 4. CAPTCHA verification (defense-in-depth on top of rate limits).
        const captchaOk = await verifyTurnstileToken(captchaToken, ip || undefined)
        if (!captchaOk) {
            await logAuthEvent({
                eventType: 'first_access',
                codiceCliente: cleanCode,
                ip,
                userAgent,
                outcome: 'captcha_failed',
            })
            return { error: 'Controllo di sicurezza fallito. Ricarica la pagina e riprova.' }
        }
    } else {
        console.info('[initiateFirstAccess] dev mode — skipping rate limits and captcha verification')
    }

    const { createAdminClient } = await import('@/lib/supabase/admin')
    const adminClient = createAdminClient()

    // 5. Profile lookup — outcome NOT leaked to the user.
    const { data: profile, error: profileErr } = await adminClient
        .from('profiles')
        .select('id, email, auth_user_id')
        .eq('codice_cliente', cleanCode)
        .maybeSingle()

    if (profileErr) {
        console.error('[initiateFirstAccess] profile lookup failed:', profileErr.code)
        await logAuthEvent({
            eventType: 'first_access',
            codiceCliente: cleanCode,
            ip,
            userAgent,
            outcome: 'failure',
            reason: 'db_error',
        })
        return { error: 'Errore di sistema. Riprova più tardi.' }
    }

    // Utenza esistente ma SENZA email a sistema: non possiamo inviare il link di
    // attivazione, quindi indirizziamo l'utente all'assistenza. NB: questo esito
    // è volutamente distinto dal messaggio generico (scelta di prodotto) — rivela
    // che il codice esiste ma non ha email. Mitigazione: rate-limit per codice/IP
    // + captcha già applicati sopra.
    if (profile && !profile.email) {
        await logAuthEvent({
            eventType: 'first_access',
            codiceCliente: cleanCode,
            ip,
            userAgent,
            outcome: 'blocked',
            reason: 'no_email_on_file',
        })
        return {
            needsAssistance: true,
            error: `Non è stato possibile completare la richiesta. Per assistenza contatta il numero ${ASSISTANCE_PHONE}.`,
        }
    }

    // Unknown codice → uniform generic response (no email sent).
    if (!profile) {
        await logAuthEvent({
            eventType: 'first_access',
            codiceCliente: cleanCode,
            ip,
            userAgent,
            outcome: 'blocked',
            reason: 'codice_not_found',
        })
        return { success: true, message: GENERIC_OK_MESSAGE }
    }

    const origin = process.env.NEXT_PUBLIC_SITE_URL
                || headersList.get('origin')
                || 'http://localhost:3000'

    // Determine whether an auth account already exists via profiles.auth_user_id
    // (set by the handle_new_user trigger when the account is created). This avoids
    // auth.admin.listUsers() (paginates at 50 → unreliable at scale) and the
    // is_shadow gate, which the trigger flips to false at INVITE time — so a user
    // who was invited but never set a password used to be wrongly treated as
    // "already activated" and could not get a new link.
    if (profile.auth_user_id) {
        // Account already exists (e.g. a previous link that expired, or an active
        // user). Send a fresh set-password / recovery link. This is SAFE — it never
        // deletes the account — and works whether or not onboarding was completed.
        // Service-role call bypasses the captcha; Supabase delivers the email.
        const { error: recErr } = await adminClient.auth.resetPasswordForEmail(profile.email, {
            redirectTo: `${origin}/auth/set-password?recovery=1`,
        })
        if (recErr) {
            console.error('[initiateFirstAccess] recovery send failed:', recErr.message)
            await logAuthEvent({
                eventType: 'first_access',
                codiceCliente: cleanCode,
                email: profile.email,
                ip,
                userAgent,
                outcome: 'failure',
                reason: 'recovery_send_failed',
            })
            return { error: 'Errore di sistema. Riprova più tardi.' }
        }
    } else {
        // Brand-new: send an invite. The trigger links the shadow profile on create.
        const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
            profile.email,
            {
                data: { codice_cliente: cleanCode },
                redirectTo: `${origin}/auth/confirm-invite`,
            }
        )
        if (inviteError) {
            console.error('[initiateFirstAccess] inviteUserByEmail failed:', inviteError.message)
            await logAuthEvent({
                eventType: 'first_access',
                codiceCliente: cleanCode,
                email: profile.email,
                ip,
                userAgent,
                outcome: 'failure',
                reason: 'invite_send_failed',
            })
            return { error: 'Errore di sistema. Riprova più tardi.' }
        }
    }

    await logAuthEvent({
        eventType: 'first_access',
        codiceCliente: cleanCode,
        email: profile.email,
        ip,
        userAgent,
        outcome: 'success',
    })

    return { success: true, message: GENERIC_OK_MESSAGE }
}

export async function logout() {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
}
