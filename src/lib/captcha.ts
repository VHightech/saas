const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

interface TurnstileResponse {
    success: boolean
    'error-codes'?: string[]
    challenge_ts?: string
    hostname?: string
    action?: string
    cdata?: string
}

export async function verifyTurnstileToken(token: string | null | undefined, remoteIp?: string): Promise<boolean> {
    if (!token) return false

    const secret = process.env.TURNSTILE_SECRET_KEY
    if (!secret) {
        console.error('[captcha] TURNSTILE_SECRET_KEY not configured')
        return false
    }

    try {
        const body = new URLSearchParams()
        body.append('secret', secret)
        body.append('response', token)
        if (remoteIp) body.append('remoteip', remoteIp)

        const res = await fetch(TURNSTILE_VERIFY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
        })

        if (!res.ok) {
            console.error('[captcha] verify HTTP', res.status)
            return false
        }

        const data = (await res.json()) as TurnstileResponse
        if (!data.success) {
            console.warn('[captcha] verification failed:', data['error-codes'])
        }
        return data.success === true
    } catch (err) {
        console.error('[captcha] verify exception:', err instanceof Error ? err.message : String(err))
        return false
    }
}
