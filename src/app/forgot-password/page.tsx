"use client"

import { ArrowRight, ArrowLeft, TrendingUp, ShieldCheck, Sparkles, CheckCircle2, Lock, Mail, UserSearch } from 'lucide-react'
import { ModeToggle } from '@/components/mode-toggle'
import { useState } from 'react'
import { lookupUser, sendRecoveryOTP, verifyRecoveryOTP, updatePassword } from './actions'
import { useRouter } from 'next/navigation'

export default function ForgotPasswordPage() {
    const router = useRouter()
    const [step, setStep] = useState(1) // 1: Search, 2: Confirm Email, 3: OTP, 4: New Password, 5: Success
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // State
    const [identifier, setIdentifier] = useState('')
    const [maskedEmail, setMaskedEmail] = useState('')
    const [otp, setOtp] = useState('')
    const [newPassword, setNewPassword] = useState('')

    // Handlers
    async function handleLookup(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true); setError(null)
        const res = await lookupUser(identifier)
        setLoading(false)
        if (res.success && res.maskedEmail) {
            setMaskedEmail(res.maskedEmail)
            setStep(2)
        } else {
            setError(res.error || 'Utenza non trovata.')
        }
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

                {/* STEP 1: Identification */}
                {step === 1 && (
                    <form onSubmit={handleLookup} className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Email o Codice Utenza</label>
                            <input
                                type="text"
                                placeholder="Inserisci la tua email o codice cliente"
                                required
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:bg-white dark:focus:bg-black focus:outline-none focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium"
                            />
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

                {step === 1 && (
                    <a href="/login" className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 hover:text-black dark:hover:text-white font-bold transition-colors pt-6 mt-auto">
                        <ArrowLeft size={16} /> Torna al Login
                    </a>
                )}

                <div className="mt-auto pt-10 text-xs text-slate-400 dark:text-slate-600 font-medium flex justify-between">
                    <span>© 2026 Portale Acquambiente</span>
                    <a href="#" className="hover:text-slate-600 dark:hover:text-slate-300">Privacy Policy</a>
                </div>
            </div>

            {/* RIGHT: VISUAL SECTION */}
            <div className="hidden lg:flex flex-1 bg-slate-50 dark:bg-[#111] relative overflow-hidden items-center justify-center p-12 transition-colors duration-500">
                {/* Decorative Circle */}
                <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full border border-slate-200/50 dark:border-white/5 opacity-50 dark:opacity-20" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full border border-slate-200/50 dark:border-white/5 opacity-50 dark:opacity-20" />

                {/* Content Container */}
                <div className="max-w-2xl w-full flex flex-col gap-12 relative z-10">

                    {/* Floating Cards Mockup (Reusing from Login for consistency) */}
                    <div className="relative group">
                        <div className="absolute top-4 -right-4 w-full h-full bg-slate-200 dark:bg-white/5 rounded-3xl -rotate-2 scale-95 transition-transform duration-700 group-hover:rotate-0 group-hover:scale-100 group-hover:bg-slate-300 dark:group-hover:bg-white/10" />
                        <div className="bg-white dark:bg-[#1e1e1e] rounded-3xl shadow-2xl shadow-slate-200 dark:shadow-black/50 border border-slate-100 dark:border-white/10 p-8 relative flex flex-col gap-6 w-full rotate-1 transition-transform duration-700 group-hover:rotate-0">
                            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-4">
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
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Recupero Account Avanzato</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-lg leading-relaxed">
                            Sicurezza al primo posto. Verifica la tua identità tramite codice OTP e recupera l'accesso in pochi secondi.
                        </p>
                    </div>

                </div>
            </div>
        </div>
    )
}
