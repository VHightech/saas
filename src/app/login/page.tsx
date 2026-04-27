'use client'

import { login } from '@/app/login/actions'
import { ArrowRight, Sparkles, CheckCircle2, TrendingUp, ShieldCheck } from 'lucide-react'
import { useState, useRef } from 'react'
import { ModeToggle } from '@/components/mode-toggle'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'

export default function LoginPage() {
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [captchaToken, setCaptchaToken] = useState<string | null>(null)
    const captchaRef = useRef<TurnstileInstance | null>(null)

    async function handleSubmit(formData: FormData) {
        setLoading(true)
        setError(null)

        if (!captchaToken) {
            setError("Per favore, completa il controllo di sicurezza (Captcha).")
            setLoading(false)
            return
        }

        formData.append('captchaToken', captchaToken)
        const result = await login(formData)

        if (result?.error) {
            setError(result.error)
            setLoading(false)
            captchaRef.current?.reset()
            setCaptchaToken(null)
        }
    }

    return (
        <div className="min-h-[100dvh] w-full flex bg-white dark:bg-[#0a0a0a] transition-colors duration-500">

            {/* LEFT: FORM SECTION (35-40%) */}
            <div className="w-full lg:w-[480px] flex flex-col justify-center p-8 lg:p-16 border-r border-slate-100 dark:border-white/10 relative z-20 bg-white dark:bg-[#0a0a0a] transition-colors duration-500">

                {/* Top Right Actions */}
                <div className="absolute top-6 right-6 lg:top-10 lg:right-10">
                    <ModeToggle />
                </div>

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
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3 tracking-tight">Accesso Area Riservata</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Inserisci le tue credenziali per consultare le fatture.</p>
                </div>

                <form action={handleSubmit} className="space-y-5">
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-sm font-medium animate-in slide-in-from-top-1">
                            {error === 'Invalid login credentials' ? 'Credenziali non valide.' : error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Email</label>
                        <input
                            name="identifier"
                            type="text"
                            placeholder="Inserisci la tua email"
                            required
                            className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:bg-white dark:focus:bg-black focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 text-slate-900 dark:text-white font-medium"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Password</label>
                        <input
                            name="password"
                            type="password"
                            placeholder="••••••••"
                            required
                            className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:bg-white dark:focus:bg-black focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 text-slate-900 dark:text-white font-medium"
                        />
                    </div>

                    <div className="flex items-center justify-between text-sm pt-1">
                        <label className="flex items-center space-x-2 cursor-pointer group">
                            <input type="checkbox" className="rounded border-slate-300 dark:border-slate-600 text-black dark:text-white focus:ring-black dark:focus:ring-white bg-transparent" />
                            <span className="text-slate-500 dark:text-slate-400 font-medium group-hover:text-black dark:group-hover:text-white transition-colors">Ricordami</span>
                        </label>
                        <a href="/forgot-password" className="text-slate-500 dark:text-slate-400 font-semibold hover:text-black dark:hover:text-white hover:underline transition-colors">
                            Password dimenticata?
                        </a>
                    </div>

                    <div className="py-2 flex justify-center">
                        <Turnstile
                            ref={captchaRef}
                            siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
                            options={{ theme: 'auto' }}
                            onSuccess={(token) => {
                                setCaptchaToken(token)
                                setError(null)
                            }}
                            onExpire={() => setCaptchaToken(null)}
                            onError={() => setCaptchaToken(null)}
                        />
                    </div>

                    <button
                        disabled={loading}
                        className="w-full py-3.5 px-6 rounded-lg bg-black dark:bg-white text-white dark:text-black font-bold hover:bg-slate-800 dark:hover:bg-slate-200 hover:-translate-y-0.5 transition-all duration-200 shadow-xl shadow-slate-200/50 dark:shadow-none disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? 'Accesso...' : 'Continua'}
                        {!loading && <ArrowRight size={18} />}
                    </button>

                    <div className="pt-2 text-center">
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                            Non hai un account?{' '}
                            <a href="/register" className="text-black dark:text-white font-bold hover:underline">
                                Registrati
                            </a>
                        </p>
                    </div>
                </form>

                <div className="mt-auto pt-10 text-xs text-slate-400 dark:text-slate-600 font-medium flex justify-between">
                    <span>© 2026 Portale Acquambiente</span>
                    <a href="#" className="hover:text-slate-600 dark:hover:text-slate-300">Privacy Policy</a>
                </div>
            </div >

            {/* RIGHT: VISUAL SECTION (60-65%) */}
            < div className="hidden lg:flex flex-1 bg-slate-50 dark:bg-[#111] relative overflow-hidden items-center justify-center p-12 transition-colors duration-500" >
                {/* Decorative Circle */}
                {/* Light Mode Circles */}
                <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full border border-slate-200/50 dark:border-white/5 opacity-50 dark:opacity-20" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full border border-slate-200/50 dark:border-white/5 opacity-50 dark:opacity-20" />

                {/* Content Container */}
                <div className="max-w-2xl w-full flex flex-col gap-12 relative z-10">

                    {/* Floating Cards Mockup */}
                    <div className="relative group">
                        {/* Back Card */}
                        <div className="absolute top-4 -right-4 w-full h-full bg-slate-200 dark:bg-white/5 rounded-3xl -rotate-2 scale-95 transition-transform duration-700 group-hover:rotate-0 group-hover:scale-100 group-hover:bg-slate-300 dark:group-hover:bg-white/10" />

                        {/* Main Interaction Card */}
                        <div className="bg-white dark:bg-[#1e1e1e] rounded-3xl shadow-2xl shadow-slate-200 dark:shadow-black/50 border border-slate-100 dark:border-white/10 p-8 relative flex flex-col gap-6 w-full rotate-1 transition-transform duration-700 group-hover:rotate-0">

                            {/* Fake UI Header */}
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-black">
                                        <TrendingUp size={20} />
                                    </div>
                                    <div>
                                        <div className="h-2.5 w-24 bg-slate-900 dark:bg-white rounded-full mb-1.5 opacity-80" />
                                        <div className="h-2 w-16 bg-slate-200 dark:bg-white/20 rounded-full" />
                                    </div>
                                </div>
                                <div className="px-3 py-1 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 rounded-full text-xs font-bold font-mono">
                                    +24.5%
                                </div>
                            </div>

                            {/* Fake UI Content */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-white/5 rounded-2xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                            <ShieldCheck size={16} />
                                        </div>
                                        <div className="h-2 w-32 bg-slate-300 dark:bg-white/10 rounded-full" />
                                    </div>
                                    <div className="h-2 w-12 bg-slate-300 dark:bg-white/10 rounded-full" />
                                </div>
                                <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-white/5 rounded-2xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                                            <Sparkles size={16} />
                                        </div>
                                        <div className="h-2 w-24 bg-slate-300 dark:bg-white/10 rounded-full" />
                                    </div>
                                    <div className="h-2 w-12 bg-slate-300 dark:bg-white/10 rounded-full" />
                                </div>
                            </div>

                            {/* Fake Graph */}
                            <div className="h-24 bg-slate-50 dark:bg-white/5 rounded-xl flex items-end justify-between p-4 gap-2">
                                {[40, 70, 45, 90, 60, 80, 50, 95].map((h, i) => (
                                    <div key={i} className="w-full bg-slate-800 dark:bg-slate-400 rounded-t-sm opacity-80 hover:opacity-100 hover:bg-black dark:hover:bg-white transition-all" style={{ height: `${h}%` }} />
                                ))}
                            </div>
                        </div>
                    </div>

                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Archivio Bollette Digitale</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-lg leading-relaxed">
                            Consulta, scarica e gestisci tutte le tue utenze di luce, gas e acqua in un'unica area riservata.
                        </p>
                    </div>

                </div>
            </div >
        </div >
    )
}
