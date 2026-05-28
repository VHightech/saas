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

// Generic response — never reveals whether a codice exists, whether the account
// is already activated, or any email information. Returned for ALL non-error
// outcomes (success, not found, already activated, captcha fail, rate limit).
// Only true system errors return a different message.
const GENERIC_OK_MESSAGE =
    "Se il Codice Cliente è registrato e non ancora attivato, riceverai un'email con il link per completare l'attivazione. Controlla anche la cartella spam."

// Numero assistenza mostrato quando l'utenza esiste ma non ha un'email a sistema.
// TODO: sostituire con il numero reale dell'assistenza Acquambiente.
const ASSISTANCE_PHONE = '800 000 000'

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
        .select('id, email, is_shadow')
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

    // Uniform response — codice sconosciuto o già attivato collassano nello stesso
    // messaggio generico, così un attaccante non può distinguere lo stato.
    if (!profile || profile.is_shadow !== true) {
        await logAuthEvent({
            eventType: 'first_access',
            codiceCliente: cleanCode,
            email: profile?.email ?? null,
            ip,
            userAgent,
            outcome: 'blocked',
            reason: !profile ? 'codice_not_found' : 'already_activated',
        })
        return { success: true, message: GENERIC_OK_MESSAGE }
    }

    // 6. Lookup existing auth user; only delete it if the previous invite is
    //    OLD enough that a legitimate retry is reasonable. This prevents an
    //    attacker (with knowledge of a codice) from invalidating a user's
    //    pending invitation by spamming the form.
    const { data: existingAuthUsers } = await adminClient.auth.admin.listUsers()
    const existingAuthUser = existingAuthUsers?.users?.find(
        u => u.email?.toLowerCase() === profile.email.toLowerCase()
    )

    const origin = process.env.NEXT_PUBLIC_SITE_URL
                || headersList.get('origin')
                || 'http://localhost:3000'
    const redirectTo = `${origin}/auth/confirm-invite`

    if (existingAuthUser) {
        const isUnconfirmed = !existingAuthUser.email_confirmed_at
        const createdAt = existingAuthUser.created_at ? Date.parse(existingAuthUser.created_at) : 0
        const ageMs = Date.now() - createdAt
        const COOLDOWN_MS = isDev ? 0 : 2 * 60 * 1000 // disabled in dev, 2 min in prod

        if (!isUnconfirmed) {
            // Auth row already confirmed but profile.is_shadow still true: data
            // inconsistency — refuse to reset and alert.
            await logAuthEvent({
                eventType: 'first_access',
                codiceCliente: cleanCode,
                email: profile.email,
                ip,
                userAgent,
                outcome: 'blocked',
                reason: 'auth_confirmed_but_profile_shadow',
                metadata: { auth_user_id: existingAuthUser.id },
            })
            return { success: true, message: GENERIC_OK_MESSAGE }
        }

        if (ageMs < COOLDOWN_MS) {
            // Recent invite still potentially in the user's inbox — don't nuke it.
            await logAuthEvent({
                eventType: 'first_access',
                codiceCliente: cleanCode,
                email: profile.email,
                ip,
                userAgent,
                outcome: 'blocked',
                reason: 'invite_cooldown',
                metadata: { auth_user_id: existingAuthUser.id, age_ms: ageMs },
            })
            return { success: true, message: GENERIC_OK_MESSAGE }
        }

        const { error: deleteError } = await adminClient.auth.admin.deleteUser(existingAuthUser.id)
        if (deleteError) {
            console.error('[initiateFirstAccess] deleteUser failed:', deleteError.message)
            await logAuthEvent({
                eventType: 'first_access',
                codiceCliente: cleanCode,
                email: profile.email,
                ip,
                userAgent,
                outcome: 'failure',
                reason: 'delete_user_failed',
            })
            return { error: 'Errore di sistema. Riprova più tardi.' }
        }
    }

    const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
        profile.email,
        {
            data: { codice_cliente: cleanCode },
            redirectTo,
        }
    )

    if (inviteError) {
        console.error('[initiateFirstAccess] inviteUserByEmail failed:', JSON.stringify(inviteError))
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
