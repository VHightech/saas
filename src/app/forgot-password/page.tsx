"use client"

import { ArrowRight, ArrowLeft, ShieldCheck, CheckCircle2, Lock, Mail, UserSearch, Droplets, Home, FileText, BarChart3 } from 'lucide-react'
import { ModeToggle } from '@/components/mode-toggle'
import { useState } from 'react'
import { lookupUser, sendRecoveryOTP, verifyRecoveryOTP, updatePassword } from './actions'
import { useRouter } from 'next/navigation'

export default function ForgotPasswordPage() {
    const router = useRouter()
    const [step, setStep] = useState(1) // 1: Search, 2: Confirm Email, 3: OTP, 4: New Password, 5: Success
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showError, setShowError] = useState(false)
    const [isCodeInvalid, setIsCodeInvalid] = useState(false)

    // State
    const [identifier, setIdentifier] = useState('')
    const [maskedEmail, setMaskedEmail] = useState('')
    const [otp, setOtp] = useState('')
    const [newPassword, setNewPassword] = useState('')

    // Handlers
    async function handleLookup(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setShowError(false)
        setIsCodeInvalid(false)

        if (identifier.length < 6) {
            setShowError(true)
            setError("Inserisci il tuo Codice Cliente di 6 cifre.")
            setLoading(false)
            return
        }

        // Risposta uniforme lato server (anti-enumeration): si avanza sempre.
        // Un eventuale codice OTP arriva solo se l'utenza esiste davvero.
        const res = await lookupUser(identifier)
        setLoading(false)
        setMaskedEmail(res.maskedEmail)
        setStep(2)
    }

    async function handleSendCode() {
        setLoading(true); setError(null)
        const res = await sendRecoveryOTP(identifier)
        setLoading(false)
        if (res.success) {
            setStep(3)
        } else {
            setError(res.error || 'Errore invio codice.')
        }
    }

    async function handleVerifyOTP(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true); setError(null)
        const res = await verifyRecoveryOTP(identifier, otp)
        setLoading(false)
        if (res.success) {
            setStep(4)
        } else {
            setError(res.error || 'Codice non valido.')
        }
    }

    async function handleResetPassword(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true); setError(null)
        const res = await updatePassword(newPassword)
        setLoading(false)
        if (res.success) {
            setStep(5)
        } else {
            setError(res.error || 'Errore aggiornamento password.')
        }
    }

    return (
        <div className="min-h-screen flex bg-white dark:bg-[#0a0a0a] transition-colors duration-500">

            {/* LEFT: FORM SECTION */}
            <div className="w-full lg:w-[480px] flex flex-col justify-center p-8 lg:p-16 lg:border-r lg:border-slate-100 dark:lg:border-white/10 relative z-20 bg-white dark:bg-[#0a0a0a] transition-colors duration-500">

                {/* Logo + Theme toggle */}
                <div className="mb-12 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center shrink-0">
                            <img src="/logo-mark.png" alt="Acquambiente" width={40} height={40} className="w-full h-full object-contain" />
                        </div>
                        <div className="leading-tight">
                            <p className="text-[15px] sm:text-[17px] font-extrabold text-[#0A2540] dark:text-white whitespace-nowrap">Acquambiente</p>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Marche</p>
                        </div>
                    </div>
                    <ModeToggle />
                </div>

                <div className="mb-8">
                    {step === 1 && (
                        <a
                            href="/login"
                            aria-label="Torna al login"
                            className="inline-flex items-center justify-center w-10 h-10 mb-4 -ml-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </a>
                    )}
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3 tracking-tight">Recupero Password</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">
                        {step === 1 && "Inserisci i tuoi dati per recuperare l'accesso."}
                        {step === 2 && "Abbiamo trovato la tua utenza. Conferma per ricevere il codice."}
                        {step === 3 && "Inserisci il codice di sicurezza inviato alla tua email."}
                        {step === 4 && "Scegli una nuova password sicura."}
                        {step === 5 && "Password aggiornata correttamente!"}
                    </p>
                </div>

                {error && (
                    <div className="p-3 mb-6 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-sm font-medium animate-in slide-in-from-top-1">
                        {error}
                    </div>
                )}

                {/* Identification Step */}
                {step === 1 && (
                    <form onSubmit={handleLookup} className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Codice Cliente</label>
                            <div className="flex gap-2 justify-between">
                                {[0, 1, 2, 3, 4, 5].map((index) => {
                                    const isEmpty = !identifier[index]
                                    const isError = isCodeInvalid || (showError && isEmpty)
                                    
                                    return (
                                        <input
                                            key={index}
                                            id={`otp-${index}`}
                                            aria-label={`Cifra ${index + 1} del Codice Cliente`}
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={1}
                                            placeholder="0"
                                            onFocus={(e) => e.target.select()}
                                            className={`w-full aspect-square min-h-[48px] text-center text-lg sm:text-2xl font-bold rounded-xl bg-slate-50 dark:bg-white/5 border focus:bg-white dark:focus:bg-black focus:outline-none transition-all duration-150 text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-white/15 font-mono shadow-sm focus:shadow-md touch-manipulation ${
                                                isError
                                                ? 'border-red-500 ring-2 ring-red-500/30'
                                                : 'border-slate-200 dark:border-white/10 focus:border-[#1E5BFF] focus:ring-2 focus:ring-[#1E5BFF]/20 dark:focus:border-[#93C5FD] dark:focus:ring-[#93C5FD]/20'
                                            }`}
                                            value={identifier[index] || ''}
                                            onChange={(e) => {
                                                setShowError(false)
                                                setIsCodeInvalid(false)
                                                const val = e.target.value.replace(/[^0-9]/g, '')
                                                if (!val && e.target.value) return 

                                                const newCode = identifier.split('')
                                                while (newCode.length < 6) newCode.push('')

                                                newCode[index] = val
                                                const newCodeString = newCode.join('').slice(0, 6)
                                                setIdentifier(newCodeString)

                                                if (val && index < 5) {
                                                    document.getElementById(`otp-${index + 1}`)?.focus()
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Backspace' && !identifier[index] && index > 0) {
                                                    document.getElementById(`otp-${index - 1}`)?.focus()
                                                }
                                            }}
                                            onPaste={(e) => {
                                                e.preventDefault()
                                                const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6)
                                                if (pastedData) {
                                                    setIdentifier(pastedData)
                                                    const focusIndex = Math.min(pastedData.length, 5)
                                                    document.getElementById(`otp-${focusIndex}`)?.focus()
                                                }
                                            }}
                                        />
                                    )
                                })}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 text-center">
                                Inserisci il codice di 6 cifre della tua utenza.
                            </p>
                        </div>
                        
                        <button disabled={loading} className="w-full py-3.5 px-6 rounded-lg bg-black dark:bg-white text-white dark:text-black font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                            {loading ? 'Ricerca...' : 'Trova Account'} <UserSearch size={18} />
                        </button>
                    </form>
                )}

                {/* STEP 2: Confirm Email */}
                {step === 2 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-500/30 flex items-start gap-4">
                            <div className="p-2 bg-white dark:bg-blue-500/20 rounded-lg text-blue-600 dark:text-blue-400">
                                <Mail size={24} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white text-sm">Account Trovato</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                                    Abbiamo trovato un account associato a: <strong className="text-slate-900 dark:text-slate-200">{maskedEmail}</strong>
                                </p>
                            </div>
                        </div>
                        <button onClick={handleSendCode} disabled={loading} className="w-full py-3.5 px-6 rounded-lg bg-black dark:bg-white text-white dark:text-black font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                            {loading ? 'Invio in corso...' : 'Invia Codice OTP'} <ArrowRight size={18} />
                        </button>
                        <button onClick={() => setStep(1)} className="w-full text-sm font-medium text-slate-500 hover:text-black dark:hover:text-white">Non è la tua email? Cerca di nuovo</button>
                    </div>
                )}

                {/* STEP 3: OTP */}
                {step === 3 && (
                    <form onSubmit={handleVerifyOTP} className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Codice di Sicurezza (OTP)</label>
                            <input
                                type="text"
                                placeholder="123456"
                                required
                                maxLength={8}
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:bg-white dark:focus:bg-black focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium text-center tracking-[0.5em] text-xl font-mono"
                            />
                        </div>
                        <button disabled={loading} className="w-full py-3.5 px-6 rounded-lg bg-black dark:bg-white text-white dark:text-black font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                            {loading ? 'Verifica...' : 'Verifica Codice'} <ShieldCheck size={18} />
                        </button>
                    </form>
                )}

                {/* STEP 4: New Password */}
                {step === 4 && (
                    <form onSubmit={handleResetPassword} className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Nuova Password</label>
                            <input
                                type="password"
                                placeholder="Min. 8 caratteri"
                                required
                                minLength={8}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:bg-white dark:focus:bg-black focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium"
                            />
                        </div>
                        <button disabled={loading} className="w-full py-3.5 px-6 rounded-lg bg-black dark:bg-white text-white dark:text-black font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                            {loading ? 'Salvataggio...' : 'Imposta Password'} <Lock size={18} />
                        </button>
                    </form>
                )}

                {/* STEP 5: Success */}
                {step === 5 && (
                    <div className="text-center space-y-6 animate-in zoom-in duration-300">
                        <div className="mx-auto w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400">
                            <CheckCircle2 size={40} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Password Aggiornata!</h3>
                        <p className="text-slate-500 dark:text-slate-400">Ora puoi accedere alla tua area riservata con le nuove credenziali.</p>
                        <button onClick={() => router.push('/login')} className="w-full py-3.5 px-6 rounded-lg bg-black dark:bg-white text-white dark:text-black font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition-all">
                            Vai al Login
                        </button>
                    </div>
                )}

                <div className="mt-auto pt-10 text-xs text-slate-400 dark:text-slate-600 font-medium flex justify-between">
                    <span>© 2026 Portale Acquambiente</span>
                    <a href="https://www.acquambientemarche.it/privacy-policy/" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 dark:hover:text-slate-300">Privacy Policy</a>
                </div>
            </div>

            {/* RIGHT: VISUAL SECTION */}
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

                        {/* Main Card */}
                        <div className="bg-[#F8FAFC] dark:bg-[#0F1115] rounded-[2rem] shadow-2xl shadow-black/20 p-4 relative flex flex-col gap-3 w-full rotate-1 transition-transform duration-700 group-hover:rotate-0">

                            {/* Top row: KPI + Fornitura + Graph */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="rounded-2xl p-3 text-white relative overflow-hidden flex flex-col justify-between" style={{ background: 'linear-gradient(135deg, #064E3B 0%, #065F46 50%, #1E5BFF 100%)' }}>
                                    <div className="h-1.5 w-12 bg-white/30 rounded-full mb-2" />
                                    <div className="h-3.5 w-16 bg-white/80 rounded-md" />
                                    <div className="flex gap-1 mt-2">
                                        <div className="h-3 w-14 bg-white/20 rounded" />
                                    </div>
                                </div>
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
