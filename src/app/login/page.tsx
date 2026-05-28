'use client'

import { login, initiateFirstAccess } from '@/app/login/actions'
import { ArrowRight, Droplets, Home, FileText, BarChart3 } from 'lucide-react'
import { useState, useRef } from 'react'
import { ModeToggle } from '@/components/mode-toggle'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'

export default function LoginPage() {
    const [view, setView] = useState<'login' | 'activation'>('login')
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [code, setCode] = useState('')
    const [showError, setShowError] = useState(false)
    const [isCodeInvalid, setIsCodeInvalid] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [captchaToken, setCaptchaToken] = useState<string | null>(null)
    const captchaRef = useRef<TurnstileInstance | null>(null)

    async function handleSubmit(formData: FormData) {
        setLoading(true)
        setError(null)
        setSuccessMessage(null)
        setShowError(false)
        setIsCodeInvalid(false)

        if (!captchaToken) {
            setError("Per favore, completa il controllo di sicurezza (Captcha).")
            setLoading(false)
            return
        }

        if (view === 'login') {
            if (code.length < 6) {
                setShowError(true)
                setError("Inserisci il tuo Codice Cliente di 6 cifre.")
                setLoading(false)
                return
            }
            formData.append('identifier', code)
            formData.append('captchaToken', captchaToken)
            const result = await login(formData)
            if (result?.error) {
                setError(result.error)
                if (result.error.toLowerCase().includes('credenziali')) {
                    setIsCodeInvalid(true)
                }
                setLoading(false)
                captchaRef.current?.reset()
                setCaptchaToken(null)
            }
        } else {
            if (code.length < 6) {
                setShowError(true)
                setError("Inserisci tutte le 6 cifre del tuo Codice Cliente.")
                setLoading(false)
                return
            }

            const result = await initiateFirstAccess(code, captchaToken)
            if (result.error) {
                setError(result.error)
            } else if (result.success) {
                setSuccessMessage(result.message)
                setCode('')
            }
            setLoading(false)
            captchaRef.current?.reset()
            setCaptchaToken(null)
        }
    }

    return (
        <div className="min-h-[100dvh] w-full flex bg-white dark:bg-[#0a0a0a] transition-colors duration-500">

            {/* LEFT: FORM SECTION */}
            <div className="w-full lg:w-[480px] flex flex-col justify-start lg:justify-center px-5 py-6 sm:px-8 sm:py-8 lg:px-16 lg:py-16 lg:border-r lg:border-slate-100 dark:lg:border-white/10 relative z-20 bg-white dark:bg-[#0a0a0a] transition-colors duration-500 overflow-y-auto">

                {/* Logo + Theme toggle */}
                <div className="mb-6 sm:mb-8 lg:mb-12 pt-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center shrink-0">
                            <img src="/acq_favicon.ico" alt="Acquambiente" width={40} height={40} className="w-full h-full object-contain" />
                        </div>
                        <div className="leading-tight">
                            <p className="text-[15px] sm:text-[17px] font-extrabold text-[#0A2540] dark:text-white whitespace-nowrap">Acquambiente</p>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Marche</p>
                        </div>
                    </div>
                    <ModeToggle />
                </div>

                <div className="mb-5 sm:mb-8">
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2 sm:mb-3 tracking-tight">
                        {view === 'login' ? 'Area Riservata' : 'Attivazione Account'}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm sm:text-base">
                        {view === 'login'
                            ? 'Inserisci il tuo Codice Cliente e la password.'
                            : 'Inserisci il tuo Codice Cliente per ricevere il link di attivazione.'}
                    </p>
                </div>

                <form action={handleSubmit} className="space-y-4 sm:space-y-5">
                    {(error || showError) && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-sm font-medium animate-in slide-in-from-top-1">
                            {error === 'Invalid login credentials' ? 'Credenziali non valide.' : error}
                        </div>
                    )}

                    {successMessage && (
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-500/30 rounded-lg text-emerald-600 dark:text-emerald-400 text-sm font-medium animate-in slide-in-from-top-1">
                            {successMessage}
                        </div>
                    )}

                    {/* OTP Boxes — fluid sizing so they fit any screen */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Codice Cliente</label>
                        <div className="grid grid-cols-6 gap-1.5 sm:gap-2 w-full">
                            {[0, 1, 2, 3, 4, 5].map((index) => {
                                const isEmpty = !code[index]
                                const isError = isCodeInvalid || (showError && isEmpty)

                                return (
                                    <input
                                        key={index}
                                        id={`otp-${index}`}
                                        aria-label={`Cifra ${index + 1} del Codice Cliente`}
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={1}
                                        placeholder="0"
                                        autoComplete="off"
                                        onFocus={(e) => e.target.select()}
                                        className={`w-full aspect-square min-h-[48px] text-center text-lg sm:text-2xl font-bold rounded-xl bg-slate-50 dark:bg-white/5 border focus:bg-white dark:focus:bg-black focus:outline-none transition-all duration-150 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-white/15 font-mono shadow-sm focus:shadow-md touch-manipulation ${
                                            isError
                                            ? 'border-red-500 ring-2 ring-red-500/30'
                                            : 'border-slate-200 dark:border-white/10 focus:border-[#1E5BFF] focus:ring-2 focus:ring-[#1E5BFF]/20 dark:focus:border-[#93C5FD] dark:focus:ring-[#93C5FD]/20'
                                        }`}
                                        value={code[index] || ''}
                                        onChange={(e) => {
                                            setShowError(false)
                                            setIsCodeInvalid(false)
                                            const val = e.target.value.replace(/[^0-9]/g, '')
                                            if (!val && e.target.value) return

                                            const newCode = code.split('')
                                            while (newCode.length < 6) newCode.push('')

                                            newCode[index] = val
                                            const newCodeString = newCode.join('').slice(0, 6)
                                            setCode(newCodeString)

                                            if (val && index < 5) {
                                                document.getElementById(`otp-${index + 1}`)?.focus()
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Backspace' && !code[index] && index > 0) {
                                                document.getElementById(`otp-${index - 1}`)?.focus()
                                            }
                                        }}
                                        onPaste={(e) => {
                                            e.preventDefault()
                                            const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6)
                                            if (pastedData) {
                                                setCode(pastedData)
                                                const focusIndex = Math.min(pastedData.length, 5)
                                                document.getElementById(`otp-${focusIndex}`)?.focus()
                                            }
                                        }}
                                    />
                                )
                            })}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 text-center">
                            Inserisci il codice di 6 cifre della tua utenza.
                        </p>
                    </div>

                    {view === 'login' && (
                        <div>
                            <label htmlFor="password" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Password</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                placeholder="••••••••"
                                aria-label="Password"
                                required
                                className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:bg-white dark:focus:bg-black focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 text-slate-900 dark:text-white font-medium text-base"
                            />
                            <div className="mt-2 text-right">
                                <a href="/forgot-password" className="text-xs font-semibold text-slate-500 hover:text-black dark:hover:text-white transition-colors">
                                    Password dimenticata?
                                </a>
                            </div>
                        </div>
                    )}

                    {/* Turnstile CAPTCHA — constrained on mobile */}
                    <div className="flex justify-center overflow-hidden rounded-lg">
                        <div className="w-full max-w-[300px]">
                            <Turnstile
                                ref={captchaRef}
                                siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
                                options={{ theme: 'auto', size: 'flexible' }}
                                onSuccess={(token) => {
                                    setCaptchaToken(token)
                                    // Clear only the "complete the captcha" prompt — keep
                                    // real server errors visible (the captcha auto-resets
                                    // after submit and would otherwise wipe them).
                                    setError(prev => (prev && prev.toLowerCase().includes('captcha')) ? null : prev)
                                }}
                                onExpire={() => setCaptchaToken(null)}
                                onError={() => setCaptchaToken(null)}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 px-6 rounded-lg bg-black dark:bg-white text-white dark:text-black font-bold hover:bg-slate-800 dark:hover:bg-slate-200 active:scale-95 transition-all duration-200 shadow-xl shadow-slate-200/50 dark:shadow-none disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base touch-manipulation min-h-[52px]"
                    >
                        {loading ? 'Elaborazione...' : view === 'login' ? 'Accedi' : 'Ricevi Link'}
                        {!loading && <ArrowRight size={18} />}
                    </button>

                    {/* First Access / Back to Login — large tap target */}
                    <div className="pt-1">
                        <button
                            type="button"
                            onClick={() => {
                                setView(view === 'login' ? 'activation' : 'login')
                                setError(null)
                                setSuccessMessage(null)
                                setCode('')
                            }}
                            className="w-full min-h-[48px] flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm font-medium hover:text-black dark:hover:text-white transition-colors rounded-lg touch-manipulation"
                        >
                            {view === 'login' ? (
                                <>È il tuo primo accesso?&nbsp;<span className="text-black dark:text-white font-bold underline underline-offset-2">Attiva account</span></>
                            ) : (
                                <>Hai già un account?&nbsp;<span className="text-black dark:text-white font-bold underline underline-offset-2">Torna al Login</span></>
                            )}
                        </button>
                    </div>
                </form>

                <div className="mt-auto pt-8 text-xs text-slate-400 dark:text-slate-600 font-medium flex justify-between">
                    <span>© 2026 Portale Acquambiente</span>
                    <a href="/privacy" className="hover:text-slate-600 dark:hover:text-slate-300">Privacy Policy</a>
                </div>
            </div>

            {/* RIGHT: VISUAL SECTION (desktop only) */}
            <div
                className="hidden lg:flex flex-1 relative overflow-hidden items-center justify-center p-16 text-white animate-gradient-shift"
                style={{ background: 'linear-gradient(135deg, #064E3B 0%, #065F46 50%, #1E5BFF 100%)' }}
            >
                {/* Animated waves + glow */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full bg-emerald-400/20 blur-3xl animate-wave-pulse" />
                    <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-white/10 blur-3xl animate-wave-pulse" style={{ animationDelay: '2.5s' }} />
                    <div className="absolute bottom-0 left-0 w-full h-64 overflow-hidden">
                        <div className="absolute bottom-0 left-0 w-[200%] h-full flex animate-wave-slide reverse opacity-15" style={{ animationDuration: '25s' }}>
                            <svg className="w-1/2 h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
                                <path fill="#ffffff" d="M0,160 C240,160 480,60 720,160 C960,260 1200,160 1440,160 L1440,320 L0,320 Z" />
                            </svg>
                            <svg className="w-1/2 h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
                                <path fill="#ffffff" d="M0,160 C240,160 480,60 720,160 C960,260 1200,160 1440,160 L1440,320 L0,320 Z" />
                            </svg>
                        </div>
                        <div className="absolute bottom-0 left-0 w-[200%] h-full flex animate-wave-slide opacity-25" style={{ animationDuration: '18s' }}>
                            <svg className="w-1/2 h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
                                <path fill="#ffffff" d="M0,200 C360,200 480,100 720,200 C960,300 1080,200 1440,200 L1440,320 L0,320 Z" />
                            </svg>
                            <svg className="w-1/2 h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
                                <path fill="#ffffff" d="M0,200 C360,200 480,100 720,200 C960,300 1080,200 1440,200 L1440,320 L0,320 Z" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="relative z-10 max-w-xl w-full flex flex-col gap-10">

                    {/* Floating dashboard mockup — faithful to the real app */}
                    <div className="relative group">
                        {/* Back Card */}
                        <div className="absolute top-4 -right-4 w-full h-full bg-white/10 rounded-[2rem] -rotate-2 scale-95 transition-transform duration-700 group-hover:rotate-0 group-hover:scale-100" />

                        {/* Main Card — mimics dashboard surface */}
                        <div className="bg-[#F8FAFC] dark:bg-[#0F1115] rounded-[2rem] shadow-2xl shadow-black/20 p-4 relative flex flex-col gap-3 w-full rotate-1 transition-transform duration-700 group-hover:rotate-0">

                            {/* Top row: KPI + Fornitura + Graph */}
                            <div className="grid grid-cols-3 gap-3">
                                {/* Ultima bolletta KPI */}
                                <div className="rounded-2xl p-3 text-white relative overflow-hidden flex flex-col justify-between" style={{ background: 'linear-gradient(135deg, #064E3B 0%, #065F46 50%, #1E5BFF 100%)' }}>
                                    <div className="h-1.5 w-12 bg-white/30 rounded-full mb-2" />
                                    <div className="h-3.5 w-16 bg-white/80 rounded-md" />
                                    <div className="flex gap-1 mt-2">
                                        <div className="h-3 w-14 bg-white/20 rounded" />
                                    </div>
                                </div>
                                {/* Fornitura */}
                                <div className="rounded-2xl p-3 text-white relative overflow-hidden flex flex-col justify-between" style={{ background: 'linear-gradient(135deg, #064E3B 0%, #065F46 50%, #1E5BFF 100%)' }}>
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="w-4 h-4 rounded bg-white/20 flex items-center justify-center"><Home size={9} /></div>
                                        <div className="h-2.5 w-8 rounded-full bg-emerald-500/30 border border-emerald-400/30" />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="h-1.5 w-full bg-white/40 rounded-full" />
                                        <div className="h-1.5 w-3/4 bg-white/40 rounded-full" />
                                    </div>
                                    <div className="h-3 w-12 bg-white/20 rounded mt-1" />
                                </div>
                                {/* Graph */}
                                <div className="rounded-2xl p-3 bg-white dark:bg-[#1A1D23] flex flex-col">
                                    <div className="flex items-center gap-1 mb-2">
                                        <BarChart3 size={10} className="text-[#1E5BFF]" />
                                        <div className="h-1.5 w-10 bg-slate-200 dark:bg-white/10 rounded-full" />
                                    </div>
                                    <div className="flex-1 flex items-end justify-between gap-1 min-h-[44px]">
                                        {[45, 70, 50, 90, 65, 80].map((h, i) => (
                                            <div key={i} className="w-full rounded-t-sm" style={{ height: `${h}%`, background: 'linear-gradient(to top, #1E5BFF, #60A5FA)' }} />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="bg-white dark:bg-[#1A1D23] rounded-2xl p-3">
                                <div className="h-2 w-16 bg-slate-200 dark:bg-white/10 rounded-full mb-3" />
                                <div className="space-y-1.5">
                                    {[
                                        { w: 'w-20', sc: 'bg-orange-100 dark:bg-orange-500/20', amt: 'w-10' },
                                        { w: 'w-16', sc: 'bg-blue-100 dark:bg-blue-500/20', amt: 'w-12' },
                                        { w: 'w-24', sc: 'bg-blue-100 dark:bg-blue-500/20', amt: 'w-8' },
                                    ].map((b, i) => (
                                        <div key={i} className="flex items-center gap-2 py-1.5 border-b border-slate-50 dark:border-white/5 last:border-0">
                                            <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-[#1E5BFF] shrink-0">
                                                <FileText size={11} />
                                            </div>
                                            <div className="flex-1 min-w-0 space-y-1">
                                                <div className={`h-1.5 ${b.w} bg-slate-300 dark:bg-white/15 rounded-full`} />
                                                <div className="flex items-center gap-1">
                                                    <Droplets size={8} className="text-[#1E5BFF]" fill="currentColor" fillOpacity={0.25} />
                                                    <div className="h-1.5 w-8 bg-slate-200 dark:bg-white/10 rounded-full" />
                                                </div>
                                            </div>
                                            <div className={`h-3 w-10 rounded-full ${b.sc}`} />
                                            <div className={`h-1.5 ${b.amt} bg-slate-300 dark:bg-white/15 rounded-full`} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tagline */}
                    <div>
                        <h2 className="text-3xl font-extrabold tracking-tight mb-3">I tuoi consumi a portata di mano</h2>
                        <p className="text-blue-50/80 text-lg leading-relaxed">
                            Bollette, pagamenti e andamento dei consumi idrici, tutto in un&apos;unica area riservata.
                        </p>
                    </div>

                </div>
            </div>
        </div>
    )
}
