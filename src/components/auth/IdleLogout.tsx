'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Client-side inactivity guard. While a Supabase session exists, any stretch of
 * `timeoutMs` without user interaction signs the user out and bounces them to the
 * login page with `?expired=1` so the UI can explain why.
 *
 * Mounted once in the root layout: on public pages (login, register, …) there is
 * no session, so it stays a no-op. This is a UX convenience layer — the
 * authoritative timeout must also be configured server-side in Supabase Auth
 * (Dashboard → Authentication → Sessions → Inactivity timeout).
 */
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
const CHECK_INTERVAL_MS = 30 * 1000       // re-check twice a minute

export function IdleLogout({ timeoutMs = DEFAULT_TIMEOUT_MS }: { timeoutMs?: number }) {
    const lastActivityRef = useRef<number>(Date.now())
    const loggingOutRef = useRef(false)

    useEffect(() => {
        const supabase = createClient()

        const markActivity = () => { lastActivityRef.current = Date.now() }

        const events: (keyof WindowEventMap)[] = [
            'mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click',
        ]
        events.forEach((e) => window.addEventListener(e, markActivity, { passive: true }))
        // visibilitychange lives on document, not window.
        document.addEventListener('visibilitychange', markActivity)

        const tick = async () => {
            if (loggingOutRef.current) return
            if (Date.now() - lastActivityRef.current < timeoutMs) return

            // Idle threshold crossed — only act if there is actually a session to end.
            const { data } = await supabase.auth.getSession()
            if (!data.session) {
                // No session (public page or already signed out): keep waiting.
                lastActivityRef.current = Date.now()
                return
            }

            loggingOutRef.current = true
            try {
                await supabase.auth.signOut()
            } finally {
                window.location.href = '/login?expired=1'
            }
        }

        const interval = window.setInterval(tick, CHECK_INTERVAL_MS)

        return () => {
            events.forEach((e) => window.removeEventListener(e, markActivity))
            document.removeEventListener('visibilitychange', markActivity)
            window.clearInterval(interval)
        }
    }, [timeoutMs])

    return null
}
