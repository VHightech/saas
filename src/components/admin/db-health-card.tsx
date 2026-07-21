'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Activity, CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface CheckResult {
    ok: boolean
    latencyMs: number
    at: Date
}

const POLL_INTERVAL_MS = 30_000
const HISTORY_SIZE = 20
const SLOW_THRESHOLD_MS = 1200

type Status = 'checking' | 'online' | 'slow' | 'offline'

const STATUS_META: Record<Status, { label: string; dot: string; text: string; iconBg: string; icon: typeof Activity; spin?: boolean }> = {
    checking: { label: 'Verifica in corso…', dot: 'bg-slate-300 dark:bg-slate-600', text: 'text-slate-400', iconBg: 'bg-slate-100 dark:bg-white/5', icon: Loader2, spin: true },
    online: { label: 'Database online', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-500/10', icon: CheckCircle2 },
    slow: { label: 'Database online (lento)', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', iconBg: 'bg-amber-500/10', icon: Activity },
    offline: { label: 'Database non raggiungibile', dot: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400', iconBg: 'bg-rose-500/10', icon: XCircle },
}

/**
 * Live DB reachability check for the upload page: a cheap query against
 * import_logs (already admin-only via RLS) run on load, every 30s, and on
 * demand. Not a Supabase metrics/Prometheus integration — that endpoint
 * reports ~200 perf series over time, not a live up/down signal, and needs
 * a separate 'sb_secret_...' key this project doesn't have configured.
 */
export function DbHealthCard() {
    const [history, setHistory] = useState<CheckResult[]>([])
    const [checking, setChecking] = useState(true)
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const runCheck = useCallback(async () => {
        setChecking(true)
        const supabase = createClient()
        const start = performance.now()
        let ok = false
        try {
            const { error } = await supabase.from('import_logs').select('id').limit(1)
            ok = !error
            if (error) console.error('[db-health] check failed:', error.code)
        } catch {
            ok = false
        }
        const latencyMs = Math.round(performance.now() - start)
        setHistory((prev) => [...prev, { ok, latencyMs, at: new Date() }].slice(-HISTORY_SIZE))
        setChecking(false)
    }, [])

    useEffect(() => {
        runCheck()
        timerRef.current = setInterval(runCheck, POLL_INTERVAL_MS)
        return () => { if (timerRef.current) clearInterval(timerRef.current) }
    }, [runCheck])

    const last = history[history.length - 1]
    const recentFailures = history.filter((h) => !h.ok).length
    const status: Status = !last ? 'checking' : !last.ok ? 'offline' : last.latencyMs > SLOW_THRESHOLD_MS ? 'slow' : 'online'
    const meta = STATUS_META[status]
    const Icon = meta.icon

    return (
        <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-4 min-w-0">
                    <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', meta.iconBg)}>
                        <Icon size={22} className={cn(meta.text, meta.spin && 'animate-spin')} />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">{meta.label}</h3>
                            <span className={cn('w-2 h-2 rounded-full shrink-0', meta.dot, status !== 'checking' && 'animate-pulse')} />
                        </div>
                        <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1">
                            {last
                                ? <>Ultimo controllo: {last.at.toLocaleTimeString('it-IT')} · {last.ok ? `${last.latencyMs} ms` : 'nessuna risposta'}</>
                                : 'Primo controllo in corso…'}
                            {recentFailures > 0 && (
                                <span className="text-rose-500 font-semibold">
                                    {' '}· {recentFailures} controll{recentFailures === 1 ? 'o fallito' : 'i falliti'} di recente
                                </span>
                            )}
                        </p>
                        {history.length > 1 && (
                            <div className="flex items-center gap-1 mt-3" title="Ultimi controlli (piu recenti a destra)">
                                {history.map((h, i) => (
                                    <div
                                        key={i}
                                        title={`${h.at.toLocaleTimeString('it-IT')} — ${h.ok ? `${h.latencyMs} ms` : 'errore'}`}
                                        className={cn(
                                            'w-1.5 h-4 rounded-full',
                                            h.ok ? (h.latencyMs > SLOW_THRESHOLD_MS ? 'bg-amber-400' : 'bg-emerald-400') : 'bg-rose-500'
                                        )}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <button
                    onClick={runCheck}
                    disabled={checking}
                    className="h-9 px-3.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[12px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors disabled:opacity-50 shrink-0"
                >
                    <RefreshCw size={13} className={checking ? 'animate-spin' : ''} />
                    Ricontrolla
                </button>
            </div>
        </div>
    )
}
