'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { setFirstPassword } from './actions'
import { Lock, Eye, EyeOff, CheckCircle2, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function SetPasswordPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [ready, setReady] = useState(false)

    // Only allow setting a password when this page was reached from a genuine
    // invite (?invite=1) or recovery (?recovery=1, set on the email redirect)
    // flow — or a PASSWORD_RECOVERY event from the URL hash. A bare pre-existing
    // session (e.g. an admin opened a link in their already-logged-in browser)
    // is NOT a valid context and must not set a password for the wrong account.
    useEffect(() => {
        const supabase = createClient()
        const params = new URLSearchParams(window.location.search)
        const fromLink = params.get('invite') === '1' || params.get('recovery') === '1'
        let settled = false
        const allow = () => { if (!settled) { settled = true; setReady(true) } }

        const { data: sub } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') allow()
        })

        ;(async () => {
            const { data } = await supabase.auth.getSession()
            const user = data.session?.user
            if (!user) { router.replace('/login'); return }
            if (fromLink) { allow(); return }
            // Session present but no invite/recovery context: wait briefly for a
            // recovery event (hash processing is async), otherwise bounce.
            setTimeout(async () => {
                if (settled) return
                const { data: profile } = await supabase
                    .from('profiles').select('role').eq('auth_user_id', user.id).maybeSingle()
                const role = profile?.role
                router.replace(
                    role === 'admin' || role === 'super_admin' || role === 'superadmin'
                        ? '/admin/users'
                        : '/profile'
                )
            }, 1500)
        })()

        return () => { sub.subscription.unsubscribe() }
    }, [router])

    // Password strength rules (visual feedback)
    const rules = [
        { label: 'Almeno 8 caratteri', ok: password.length >= 8 },
        { label: 'Una lettera maiuscola', ok: /[A-Z]/.test(password) },
        { label: 'Una lettera minuscola', ok: /[a-z]/.test(password) },
        { label: 'Un numero', ok: /\d/.test(password) },
        { label: 'Un carattere speciale (!@#$%...)', ok: /[!@#$%^&*()_+\-=\[\]{};':"|\<\>?,./`~]/.test(password) },
    ]
    const allRulesMet = rules.every(r => r.ok)
    const passwordsMatch = password === confirm && confirm.length > 0

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (!allRulesMet) {
            setError('La password non soddisfa i requisiti di sicurezza.')
            return
        }
        if (!passwordsMatch) {
            setError('Le password non coincidono.')
            return
        }
        setLoading(true)
        setError(null)

        const fd = new FormData()
        fd.set('password', password)
        fd.set('confirmPassword', confirm)
        const result = await setFirstPassword(fd)

        // If action returned an error (no redirect happened)
        if (result?.error) {
            setError(result.error)
            setLoading(false)
        }
        // On success, the server action calls redirect('/profile') — no extra handling needed
    }

    if (!ready) {
        return (
            <div className="min-h-[100dvh] w-full flex items-center justify-center bg-white dark:bg-[#0a0a0a]">
                <Loader2 className="animate-spin text-slate-400" size={32} />
            </div>
        )
    }

    return (
        <div className="min-h-[100dvh] w-full flex bg-white dark:bg-[#0a0a0a] transition-colors duration-500">

            {/* LEFT: FORM */}
            <div className="w-full lg:w-[480px] flex flex-col justify-center p-8 lg:p-16 border-r border-slate-100 dark:border-white/10 relative z-20 bg-white dark:bg-[#0a0a0a] transition-colors duration-500">

                {/* Logo */}
                <div className="mb-12">
                    <span className="font-black text-2xl tracking-tighter text-black dark:text-white flex items-center gap-3">
                        <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center text-white dark:text-black shadow-sm overflow-hidden p-1 bg-white">
                            <img src="/acq_logo.jpg" alt="Logo" className="w-full h-full object-contain" />
                        </div>
                        Portale Acquambiente
                    </span>
                </div>

                <div className="mb-8">
                    <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-6">
                        <ShieldCheck size={26} />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3 tracking-tight">
                        Imposta la tua Password
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">
                        Crea una password sicura per accedere alla tua area riservata.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-sm font-medium animate-in slide-in-from-top-1">
                            {error}
                        </div>
                    )}

                    {/* Password Field */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            Nuova Password
                        </label>
                        <div className="relative">
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                required
                                autoFocus
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full px-4 py-3 pr-12 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:bg-white dark:focus:bg-black focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 text-slate-900 dark:text-white font-medium"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                aria-label="Mostra/Nascondi password"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {/* Password strength checklist */}
                    {password.length > 0 && (
                        <ul className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                            {rules.map(r => (
                                <li key={r.label} className={`flex items-center gap-2 text-xs font-medium transition-colors ${r.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                    <CheckCircle2 size={13} className={r.ok ? 'opacity-100' : 'opacity-30'} />
                                    {r.label}
                                </li>
                            ))}
                        </ul>
                    )}

                    {/* Confirm Password Field */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            Conferma Password
                        </label>
                        <div className="relative">
                            <input
                                id="confirmPassword"
                                type={showConfirm ? 'text' : 'password'}
                                required
                                placeholder="••••••••"
                                value={confirm}
                                onChange={e => setConfirm(e.target.value)}
                                className={`w-full px-4 py-3 pr-12 rounded-lg bg-slate-50 dark:bg-white/5 border focus:bg-white dark:focus:bg-black focus:outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 text-slate-900 dark:text-white font-medium ${
                                    confirm.length > 0
                                        ? passwordsMatch
                                            ? 'border-emerald-400 dark:border-emerald-500 focus:ring-1 focus:ring-emerald-400'
                                            : 'border-red-400 dark:border-red-500 focus:ring-1 focus:ring-red-400'
                                        : 'border-slate-200 dark:border-white/10 focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white'
                                }`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirm(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                aria-label="Mostra/Nascondi conferma"
                            >
                                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        {confirm.length > 0 && !passwordsMatch && (
                            <p className="text-xs text-red-500 mt-1.5 font-medium">Le password non coincidono.</p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !allRulesMet || !passwordsMatch}
                        className="w-full py-3.5 px-6 rounded-lg bg-black dark:bg-white text-white dark:text-black font-bold hover:bg-slate-800 dark:hover:bg-slate-200 hover:-translate-y-0.5 transition-all duration-200 shadow-xl shadow-slate-200/50 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2"
                    >
                        {loading
                            ? <><Loader2 size={18} className="animate-spin" /> Salvataggio...</>
                            : <>Accedi al Portale <ArrowRight size={18} /></>
                        }
                    </button>
                </form>

                <div className="mt-auto pt-10 text-xs text-slate-400 dark:text-slate-600 font-medium flex justify-between">
                    <span>© 2026 Portale Acquambiente</span>
                    <a href="https://www.acquambientemarche.it/privacy-policy/" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 dark:hover:text-slate-300">Privacy Policy</a>
                </div>
            </div>

            {/* RIGHT: VISUAL */}
            <div className="hidden lg:flex flex-1 bg-slate-50 dark:bg-[#111] relative overflow-hidden items-center justify-center p-12 transition-colors duration-500">
                <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full border border-slate-200/50 dark:border-white/5 opacity-50 dark:opacity-20" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full border border-slate-200/50 dark:border-white/5 opacity-50 dark:opacity-20" />

                <div className="max-w-md w-full relative z-10 flex flex-col gap-8">
                    {/* Step indicator */}
                    <div className="flex flex-col gap-6">
                        {[
                            { step: 1, label: 'Codice Cliente inserito', done: true },
                            { step: 2, label: 'Link di attivazione ricevuto', done: true },
                            { step: 3, label: 'Imposta la tua password', done: false, active: true },
                            { step: 4, label: 'Accesso alla tua area riservata', done: false },
                        ].map(({ step, label, done, active }) => (
                            <div key={step} className="flex items-center gap-4">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 transition-all ${
                                    done
                                        ? 'bg-emerald-500 text-white'
                                        : active
                                            ? 'bg-black dark:bg-white text-white dark:text-black ring-4 ring-black/10 dark:ring-white/10'
                                            : 'bg-slate-200 dark:bg-white/10 text-slate-400 dark:text-slate-500'
                                }`}>
                                    {done ? <CheckCircle2 size={16} /> : step}
                                </div>
                                <span className={`text-sm font-semibold ${
                                    done
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : active
                                            ? 'text-slate-900 dark:text-white'
                                            : 'text-slate-400 dark:text-slate-500'
                                }`}>
                                    {label}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="p-5 bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10">
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            <strong className="text-slate-700 dark:text-slate-300">Consiglio di sicurezza:</strong> Usa una password unica per questo portale, diversa da quelle che usi su altri siti. Salvala in un gestore di password.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
