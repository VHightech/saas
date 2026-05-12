import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export type AuthEventOutcome = 'success' | 'failure' | 'blocked' | 'rate_limited' | 'captcha_failed'

export interface AuthEventInput {
    eventType: string
    codiceCliente?: string | null
    email?: string | null
    ip?: string | null
    userAgent?: string | null
    outcome: AuthEventOutcome
    reason?: string
    metadata?: Record<string, unknown>
}

function sha256Hex(input: string): string {
    return createHash('sha256').update(input).digest('hex')
}

export async function logAuthEvent(evt: AuthEventInput): Promise<void> {
    try {
        const admin = createAdminClient()
        await admin.from('auth_events').insert({
            event_type: evt.eventType,
            codice_cliente_hash: evt.codiceCliente ? sha256Hex(evt.codiceCliente) : null,
            email_hash: evt.email ? sha256Hex(evt.email.toLowerCase()) : null,
            ip_address: evt.ip || null,
            user_agent: evt.userAgent || null,
            outcome: evt.outcome,
            reason: evt.reason || null,
            metadata: evt.metadata || {},
        })
    } catch (err) {
        console.error('[auth-events] insert failed:', err instanceof Error ? err.message : String(err))
    }
}

export interface RateLimitCheck {
    limited: boolean
    count: number
}

export async function bumpAndCheckRateLimit(
    bucketKey: string,
    maxHits: number,
    windowMinutes = 10
): Promise<RateLimitCheck> {
    try {
        const admin = createAdminClient()
        await admin.rpc('bump_rate_limit', { p_bucket_key: bucketKey })
        const { data } = await admin.rpc('count_rate_limit', {
            p_bucket_key: bucketKey,
            p_minutes: windowMinutes,
        })
        const count = typeof data === 'number' ? data : 0
        return { limited: count > maxHits, count }
    } catch (err) {
        console.error('[rate-limit] error:', err instanceof Error ? err.message : String(err))
        // Fail open on rate-limit errors — better to allow a few requests than lock everyone out.
        return { limited: false, count: 0 }
    }
}
