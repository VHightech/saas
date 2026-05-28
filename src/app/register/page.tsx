"use client"

import { register, resendConfirmationEmail } from '@/app/register/actions'
import { useState, useRef } from 'react'
import { ArrowRight, ArrowLeft, TrendingUp, ShieldCheck, Sparkles, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'
import { ModeToggle } from '@/components/mode-toggle'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'

export default function RegisterPage() {
    const [success, setSuccess] = useState(false)
    const [step, setStep] = useState(1)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [captchaToken, setCaptchaToken] = useState<string | null>(null)
    const captchaRef = useRef<TurnstileInstance | null>(null)

    // Resend Email State
    const [resendLoading, setResendLoading] = useState(false)
    const [resendSuccess, setResendSuccess] = useState(false)

    // Form State
    const [formData, setFormData] = useState({
        full_name: '',
        fiscal_code: '',
        email: '',
        client_code: '',
        password: ''
    })

    const [fiscalType, setFiscalType] = useState<'fiscal_code' | 'piva'>('fiscal_code')

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        })
    }

    async function handleResendEmail() {
        setResendLoading(true)
        const result: any = await resendConfirmationEmail(formData.email)
        setResendLoading(false)
        if (result?.success) {
            setResendSuccess(true)
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setNotFound(false) // Reset not found state


        if (!formData.password) {
            setError("Per favore, compila tutti i campi obbligatori.")
            setLoading(false)
            return
        }

        if (!captchaToken) {
            setError("Per favore, completa il controllo di sicurezza (Captcha).")
            setLoading(false)
            return
        }

        // Create FormData from state
        const submissionData = new FormData()
        Object.entries(formData).forEach(([key, value]) => {
            submissionData.append(key, value)
        })
        submissionData.append('captchaToken', captchaToken)

        const result: any = await register(submissionData)

        if (result?.errorCode === 'CLIENT_NOT_FOUND') {
            setNotFound(true)
            setLoading(false)
            setCaptchaToken(null)
            captchaRef.current?.reset()
        } else if (result?.error) {
            setError(result.error)
            setLoading(false)
            captchaRef.current?.reset() // Reset captcha on error
            setCaptchaToken(null)
        } else if (result?.success) {
            setSuccess(true)
            setLoading(false)
        }
    }

    const [notFound, setNotFound] = useState(false)

    if (success) {
        return (
            <div className="min-h-screen flex bg-white dark:bg-[#0a0a0a] transition-colors duration-500">
                <div className="w-full lg:w-[480px] flex flex-col justify-center p-8 lg:p-16 border-r border-slate-100 dark:border-white/10 relative z-20 bg-white dark:bg-[#0a0a0a]">
                    <div className="mb-6">
                        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-2xl flex items-center justify-center text-green-600 dark:text-green-400 mb-6 mx-auto lg:mx-0">
                            <Sparkles size={32} />
                        </div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3 tracking-tight">Controlla la tua email!</h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium text-lg leading-relaxed mb-6">
                            Ti abbiamo inviato un link per confermare il tuo account. <br />
                            Clicca sul link per attivare l'accesso.
                        </p>

                        {!resendSuccess ? (
                            <button
                                onClick={handleResendEmail}
                                disabled={resendLoading}
                                className="text-sm font-bold text-slate-900 dark:text-white underline hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-2 mb-8 disabled:opacity-50"
                            >
                                {resendLoading ? <RefreshCw className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                                Non hai ricevuto l'email? Invia di nuovo
                            </button>
                        ) : (
                            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-bold mb-8 text-sm">
                                <CheckCircle2 size={16} /> Email inviata con successo!
                            </div>
                        )}
                    </div>

                    <a href="/login" className="w-full py-3.5 px-6 rounded-lg bg-black dark:bg-white text-white dark:text-black font-bold hover:bg-slate-800 dark:hover:bg-slate-200 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
                        Torna al Login
                    </a>
                </div>
                {/* RIGHT: VISUAL SECTION (Preserve Existing) */}
                <div className="hidden lg:flex flex-1 bg-slate-50 dark:bg-[#111] relative overflow-hidden items-center justify-center p-12">
                    {/* Decorative Circle */}
                    <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full border border-slate-200/50 dark:border-white/5 opacity-50 dark:opacity-20" />
                    <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full border border-slate-200/50 dark:border-white/5 opacity-50 dark:opacity-20" />

                    {/* Content Container */}
                    <div className="max-w-2xl w-full flex flex-col gap-12 relative z-10">
                        <div className="relative group">
                            <div className="absolute top-4 -right-4 w-full h-full bg-slate-200 dark:bg-white/5 rounded-3xl -rotate-2 scale-95 transition-transform duration-700 group-hover:rotate-0 group-hover:scale-100 group-hover:bg-slate-300 dark:group-hover:bg-white/10" />
                            <div className="bg-white dark:bg-[#1e1e1e] rounded-3xl shadow-2xl shadow-slate-200 dark:shadow-black/50 border border-slate-100 dark:border-white/10 p-8 relative flex flex-col gap-6 w-full rotate-1 transition-transform duration-700 group-hover:rotate-0">
                                <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-black"><TrendingUp size={20} /></div>
                                        <div><div className="h-2.5 w-24 bg-slate-900 dark:bg-white rounded-full mb-1.5 opacity-80" /><div className="h-2 w-16 bg-slate-200 dark:bg-white/20 rounded-full" /></div>
                                    </div>
                                    <div className="px-3 py-1 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 rounded-full text-xs font-bold font-mono">+24.5%</div>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-white/5 rounded-2xl">
                                        <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400"><ShieldCheck size={16} /></div><div className="h-2 w-32 bg-slate-300 dark:bg-white/10 rounded-full" /></div><div className="h-2 w-12 bg-slate-300 dark:bg-white/10 rounded-full" />
                                    </div>
                                    <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-white/5 rounded-2xl">
                                        <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400"><Sparkles size={16} /></div><div className="h-2 w-24 bg-slate-300 dark:bg-white/10 rounded-full" /></div><div className="h-2 w-12 bg-slate-300 dark:bg-white/10 rounded-full" />
                                    </div>
                                </div>
                                <div className="h-24 bg-slate-50 dark:bg-white/5 rounded-xl flex items-end justify-between p-4 gap-2">
                                    {[40, 70, 45, 90, 60, 80, 50, 95].map((h, i) => (<div key={i} className="w-full bg-slate-800 dark:bg-slate-400 rounded-t-sm opacity-80 hover:opacity-100 hover:bg-black dark:hover:bg-white transition-all" style={{ height: `${h}%` }} />))}
                                </div>
                            </div>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Archivio Bollette Digitale</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-lg leading-relaxed">
                                Accedi al tuo storico, visualizza i consumi e scarica le fatture in totale autonomia.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (notFound) {
        return (
            <div className="min-h-screen flex bg-white dark:bg-[#0a0a0a] transition-colors duration-500">
                <div className="w-full lg:w-[480px] flex flex-col justify-center p-8 lg:p-16 border-r border-slate-100 dark:border-white/10 relative z-20 bg-white dark:bg-[#0a0a0a]">
                    <div className="mb-6">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-2xl flex items-center justify-center text-red-600 dark:text-red-400 mb-6 mx-auto lg:mx-0">
                            <AlertCircle size={32} />
                        </div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3 tracking-tight">Account Non Riconosciuto</h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium text-lg leading-relaxed mb-6">
                            Il Codice Cliente inserito non è presente nei nostri archivi. Assicurati di averlo digitato correttamente.
                        </p>

                        <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 mb-8">
                            <p className="text-sm text-slate-600 dark:text-slate-300 mb-2 font-medium">Se il problema persiste, contattaci:</p>
                            <a href="mailto:supporto@acquambiente.it" className="text-black dark:text-white font-bold text-lg hover:underline flex items-center gap-2">
                                supporto@acquambiente.it
                            </a>
                        </div>
                    </div>

                    <button
                        onClick={() => setNotFound(false)}
                        className="w-full py-3.5 px-6 rounded-lg bg-black dark:bg-white text-white dark:text-black font-bold hover:bg-slate-800 dark:hover:bg-slate-200 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                    >
                        <ArrowLeft size={18} /> Riprova
                    </button>
                </div>
                {/* RIGHT: VISUAL SECTION (Preserve Existing) */}
                <div className="hidden lg:flex flex-1 bg-slate-50 dark:bg-[#111] relative overflow-hidden items-center justify-center p-12">
                    {/* Decorative Circle */}
                    <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full border border-slate-200/50 dark:border-white/5 opacity-50 dark:opacity-20" />
                    <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full border border-slate-200/50 dark:border-white/5 opacity-50 dark:opacity-20" />

                    {/* Content Container */}
                    <div className="max-w-2xl w-full flex flex-col gap-12 relative z-10 opacity-50 grayscale transition-all duration-500 hover:opacity-100 hover:grayscale-0">
                        {/* Simplified Visual for Error State */}
                        <div className="text-center">
                            <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">Serve aiuto?</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-xl max-w-md mx-auto">
                                Il nostro team di supporto è a tua disposizione per risolvere qualsiasi problema di registrazione.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex bg-white dark:bg-[#0a0a0a] transition-colors duration-500">

            {/* LEFT: FORM SECTION */}
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


                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3 tracking-tight">Attiva Area Riservata</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Inserisci i dati per consultare le tue bollette.</p>
                </div>

                {/* Stepper */}
                <div className="flex gap-2 mb-8">
                    <div className={`h-1.5 w-12 rounded-full transition-colors ${step >= 1 ? 'bg-black dark:bg-white' : 'bg-slate-200 dark:bg-white/20'}`} />
                    <div className={`h-1.5 w-12 rounded-full transition-colors ${step >= 2 ? 'bg-black dark:bg-white' : 'bg-slate-200 dark:bg-white/20'}`} />
                </div>

                <form onSubmit={handleSubmit} className="space-y-5" noValidate>

                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-sm font-medium">
                            {error}
                        </div>
                    )}

                    {/* STEP 1: Personal Info */}
                    <div className={step === 1 ? 'block space-y-4' : 'hidden'}>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Codice Cliente</label>
                            <div className="flex gap-2 justify-between">
                                {[0, 1, 2, 3, 4, 5].map((index) => (
                                    <input
                                        key={index}
                                        id={`otp-${index}`}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        placeholder="0"
                                        onFocus={(e) => e.target.select()}
                                        className="w-12 h-14 text-center text-xl font-bold rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:bg-white dark:focus:bg-black focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 font-mono"
                                        value={formData.client_code[index] || ''}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^0-9]/g, '')
                                            if (!val && e.target.value) return // If non-numeric was typed/pasted and removed

                                            const newCode = formData.client_code.split('')
                                            // Ensure array has 6 elements
                                            while (newCode.length < 6) newCode.push('')

                                            newCode[index] = val
                                            const newCodeString = newCode.join('').slice(0, 6)
                                            setFormData({ ...formData, client_code: newCodeString })

                                            // Auto-focus next
                                            if (val && index < 5) {
                                                document.getElementById(`otp-${index + 1}`)?.focus()
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Backspace' && !formData.client_code[index] && index > 0) {
                                                document.getElementById(`otp-${index - 1}`)?.focus()
                                            }
                                        }}
                                        onPaste={(e) => {
                                            e.preventDefault()
                                            const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6)
                                            if (pastedData) {
                                                setFormData({ ...formData, client_code: pastedData })
                                                // Focus the box after the pasted length or the last one
                                                const focusIndex = Math.min(pastedData.length, 5)
                                                document.getElementById(`otp-${focusIndex}`)?.focus()
                                            }
                                        }}
                                    />
                                ))}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                Inserisci le 6 cifre del tuo Codice Cliente.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Nome e Cognome (o Ragione Sociale)</label>
                            <input
                                name="full_name"
                                type="text"
                                required
                                className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:bg-white dark:focus:bg-black focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium"
                                placeholder="Mario Rossi"
                                value={formData.full_name}
                                onChange={handleChange}
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="blocks text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    {fiscalType === 'fiscal_code' ? 'Codice Fiscale' : 'Partita IVA'}
                                </label>
                                <div className="relative bg-slate-100 dark:bg-white/10 p-1 rounded-lg w-[200px] flex h-9">
                                    {/* Animated Background */}
                                    <div
                                        className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white dark:bg-black rounded-md shadow-sm transition-all duration-300 ease-in-out ${fiscalType === 'fiscal_code' ? 'left-1' : 'left-[calc(50%+2px)]'
                                            }`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFiscalType('fiscal_code')
                                            setFormData({ ...formData, fiscal_code: '' })
                                        }}
                                        className={`flex-1 relative z-10 text-xs font-bold rounded-md transition-colors text-center ${fiscalType === 'fiscal_code' ? 'text-black dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                                    >
                                        Codice Fiscale
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFiscalType('piva')
                                            setFormData({ ...formData, fiscal_code: '' })
                                        }}
                                        className={`flex-1 relative z-10 text-xs font-bold rounded-md transition-colors text-center ${fiscalType === 'piva' ? 'text-black dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                                    >
                                        Partita IVA
                                    </button>
                                </div>
                            </div>
                            <input
                                name="fiscal_code"
                                type="text"
                                required
                                maxLength={fiscalType === 'fiscal_code' ? 16 : 11}
                                className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:bg-white dark:focus:bg-black focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium"
                                placeholder={fiscalType === 'fiscal_code' ? "Inserisci Codice Fiscale" : "Inserisci Partita IVA"}
                                value={formData.fiscal_code}
                                onChange={(e) => {
                                    const val = e.target.value.toUpperCase()
                                    if (fiscalType === 'piva' && !/^\d*$/.test(val)) return
                                    setFormData({ ...formData, fiscal_code: val })
                                }}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Email</label>
                            <input
                                name="email"
                                type="email"
                                required
                                className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:bg-white dark:focus:bg-black focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium"
                                placeholder="Inserisci email"
                                value={formData.email}
                                onChange={handleChange}
                            />
                        </div>


                        <button
                            type="button"
                            onClick={() => {
                                if (!formData.full_name || !formData.fiscal_code || !formData.email || !formData.client_code) {
                                    setError("Per favore, compila tutti i campi obbligatori prima di proseguire.")
                                    return
                                }

                                if (fiscalType === 'fiscal_code' && formData.fiscal_code.length !== 16) {
                                    setError("Il Codice Fiscale deve essere di 16 caratteri.")
                                    return
                                }

                                if (fiscalType === 'piva' && formData.fiscal_code.length !== 11) {
                                    setError("La Partita IVA deve essere di 11 cifre.")
                                    return
                                }
                                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                                if (!emailRegex.test(formData.email)) {
                                    setError("Per favore, inserisci un indirizzo email valido.")
                                    return
                                }
                                if (formData.client_code.length !== 6) {
                                    setError("Il Codice Cliente deve essere composto da 6 cifre.")
                                    return
                                }
                                setStep(2)
                                setError(null)
                            }}
                            className="w-full mt-4 py-3.5 px-6 rounded-lg bg-black dark:bg-white text-white dark:text-black font-bold hover:bg-slate-800 dark:hover:bg-slate-200 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                        >
                            Avanti <ArrowRight size={18} />
                        </button>
                    </div>

                    {/* STEP 2: Account Details */}
                    <div className={step === 2 ? 'block space-y-4' : 'hidden'}>




                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Password</label>
                            <input
                                name="password"
                                type="password"
                                required
                                className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:bg-white dark:focus:bg-black focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={handleChange}
                            />
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

                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={() => setStep(1)} className="flex-1 py-3.5 px-6 rounded-lg bg-white dark:bg-black border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-white/5 transition-all flex items-center justify-center gap-2">
                                <ArrowLeft size={18} /> Indietro
                            </button>
                            <button disabled={loading} className="flex-[2] py-3.5 px-6 rounded-lg bg-black dark:bg-white text-white dark:text-black font-bold hover:bg-slate-800 dark:hover:bg-slate-200 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                                {loading ? 'Attivazione...' : 'Attiva Accesso'}
                            </button>
                        </div>
                    </div>

                </form>

                <div className="pt-6 text-center border-t border-slate-100 dark:border-white/5 mt-6">
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                        Hai già attivato l'utenza?{' '}
                        <a href="/login" className="text-black dark:text-white font-bold hover:underline">
                            Accedi al portale
                        </a>
                    </p>
                </div>

                <div className="mt-auto pt-10 text-xs text-slate-400 dark:text-slate-600 font-medium flex justify-between">
                    <span>© 2026 Portale Acquambiente</span>
                    <a href="/privacy" className="hover:text-slate-600 dark:hover:text-slate-300">Privacy Policy</a>
                </div>
            </div>

            {/* RIGHT: VISUAL SECTION (Preserve Existing) */}
            <div className="hidden lg:flex flex-1 bg-slate-50 dark:bg-[#111] relative overflow-hidden items-center justify-center p-12">
                {/* Decorative Circle */}
                <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full border border-slate-200/50 dark:border-white/5 opacity-50 dark:opacity-20" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full border border-slate-200/50 dark:border-white/5 opacity-50 dark:opacity-20" />

                {/* Content Container */}
                <div className="max-w-2xl w-full flex flex-col gap-12 relative z-10">
                    <div className="relative group">
                        <div className="absolute top-4 -right-4 w-full h-full bg-slate-200 dark:bg-white/5 rounded-3xl -rotate-2 scale-95 transition-transform duration-700 group-hover:rotate-0 group-hover:scale-100 group-hover:bg-slate-300 dark:group-hover:bg-white/10" />
                        <div className="bg-white dark:bg-[#1e1e1e] rounded-3xl shadow-2xl shadow-slate-200 dark:shadow-black/50 border border-slate-100 dark:border-white/10 p-8 relative flex flex-col gap-6 w-full rotate-1 transition-transform duration-700 group-hover:rotate-0">
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-black"><TrendingUp size={20} /></div>
                                    <div><div className="h-2.5 w-24 bg-slate-900 dark:bg-white rounded-full mb-1.5 opacity-80" /><div className="h-2 w-16 bg-slate-200 dark:bg-white/20 rounded-full" /></div>
                                </div>
                                <div className="px-3 py-1 bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 rounded-full text-xs font-bold font-mono">+24.5%</div>
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-white/5 rounded-2xl">
                                    <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400"><ShieldCheck size={16} /></div><div className="h-2 w-32 bg-slate-300 dark:bg-white/10 rounded-full" /></div><div className="h-2 w-12 bg-slate-300 dark:bg-white/10 rounded-full" />
                                </div>
                                <div className="flex justify-between items-center p-4 bg-slate-50 dark:bg-white/5 rounded-2xl">
                                    <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400"><Sparkles size={16} /></div><div className="h-2 w-24 bg-slate-300 dark:bg-white/10 rounded-full" /></div><div className="h-2 w-12 bg-slate-300 dark:bg-white/10 rounded-full" />
                                </div>
                            </div>
                            <div className="h-24 bg-slate-50 dark:bg-white/5 rounded-xl flex items-end justify-between p-4 gap-2">
                                {[40, 70, 45, 90, 60, 80, 50, 95].map((h, i) => (<div key={i} className="w-full bg-slate-800 dark:bg-slate-400 rounded-t-sm opacity-80 hover:opacity-100 hover:bg-black dark:hover:bg-white transition-all" style={{ height: `${h}%` }} />))}
                            </div>
                        </div>
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Archivio Bollette Digitale</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-lg leading-relaxed">
                            Accedi al tuo storico, visualizza i consumi e scarica le fatture in totale autonomia.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
