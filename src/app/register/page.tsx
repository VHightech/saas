"use client"

import { register } from '@/app/register/actions'
import { useState } from 'react'
import { ArrowRight, ArrowLeft, TrendingUp, ShieldCheck, Sparkles } from 'lucide-react'

export default function RegisterPage() {
    const [step, setStep] = useState(1)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        cfpi: '',
        client_code: '',
        cif: '',
        username: '',
        password: ''
    })

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        })
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError(null)

        // Create FormData from state
        const submissionData = new FormData()
        Object.entries(formData).forEach(([key, value]) => {
            submissionData.append(key, value)
        })

        const result = await register(submissionData)

        if (result?.error) {
            setError(result.error)
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex bg-white">

            {/* LEFT: FORM SECTION */}
            <div className="w-full lg:w-[480px] flex flex-col justify-center p-8 lg:p-16 border-r border-slate-100 relative z-20 bg-white">

                {/* Logo */}
                <div className="mb-12">
                    <span className="font-black text-2xl tracking-tighter text-black flex items-center gap-2">
                        <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white text-sm">AQ</div>
                        ACQDASH
                    </span>
                </div>

                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">Attiva Area Riservata</h1>
                    <p className="text-slate-500 font-medium">Inserisci i dati per consultare le tue bollette.</p>
                </div>

                {/* Stepper */}
                <div className="flex gap-2 mb-8">
                    <div className={`h-1.5 w-12 rounded-full transition-colors ${step >= 1 ? 'bg-black' : 'bg-slate-200'}`} />
                    <div className={`h-1.5 w-12 rounded-full transition-colors ${step >= 2 ? 'bg-black' : 'bg-slate-200'}`} />
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm font-medium">
                            {error}
                        </div>
                    )}

                    {/* STEP 1: Personal Info */}
                    <div className={step === 1 ? 'block space-y-4' : 'hidden'}>
                        <div className="col-span-2">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Ragione Sociale / Nome Completo</label>
                            <input
                                name="name"
                                type="text"
                                required
                                className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all text-slate-900 placeholder:text-slate-400 font-medium"
                                placeholder="Mario Rossi o Azienda SRL"
                                value={formData.name}
                                onChange={handleChange}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
                            <input
                                name="email"
                                type="email"
                                required
                                className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all text-slate-900 placeholder:text-slate-400 font-medium"
                                placeholder="nome@azienda.com"
                                value={formData.email}
                                onChange={handleChange}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Codice Fiscale / P.IVA</label>
                            <input
                                name="cfpi"
                                type="text"
                                required
                                className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all text-slate-900 placeholder:text-slate-400 font-medium uppercase font-mono"
                                placeholder="RSSMRA..."
                                value={formData.cfpi}
                                onChange={handleChange}
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                if (!formData.name || !formData.email || !formData.cfpi) {
                                    setError("Per favore, compila tutti i campi obbligatori prima di proseguire.")
                                    return
                                }
                                setStep(2)
                                setError(null)
                            }}
                            className="w-full mt-4 py-3.5 px-6 rounded-lg bg-black text-white font-bold hover:bg-slate-800 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                        >
                            Avanti <ArrowRight size={18} />
                        </button>
                    </div>

                    {/* STEP 2: Account Details */}
                    <div className={step === 2 ? 'block space-y-4' : 'hidden'}>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Codice Cliente</label>
                                <input
                                    name="client_code"
                                    type="text"
                                    required
                                    className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all text-slate-900 placeholder:text-slate-400 font-medium font-mono"
                                    placeholder="000000"
                                    value={formData.client_code}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">CIF</label>
                                <input
                                    name="cif"
                                    type="text"
                                    required
                                    className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all text-slate-900 placeholder:text-slate-400 font-medium font-mono"
                                    placeholder="XYZ..."
                                    value={formData.cif}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Username</label>
                            <input
                                name="username"
                                type="text"
                                required
                                className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all text-slate-900 placeholder:text-slate-400 font-medium"
                                placeholder="mariorossi"
                                value={formData.username}
                                onChange={handleChange}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
                            <input
                                name="password"
                                type="password"
                                required
                                className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all text-slate-900 placeholder:text-slate-400 font-medium"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={() => setStep(1)} className="flex-1 py-3.5 px-6 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                                <ArrowLeft size={18} /> Indietro
                            </button>
                            <button disabled={loading} className="flex-[2] py-3.5 px-6 rounded-lg bg-black text-white font-bold hover:bg-slate-800 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                                {loading ? 'Attivazione...' : 'Attiva Accesso'}
                            </button>
                        </div>
                    </div>

                </form>

                <div className="pt-6 text-center">
                    <p className="text-slate-500 text-sm font-medium">
                        Hai già attivato l'utenza?{' '}
                        <a href="/login" className="text-black font-bold hover:underline">
                            Accedi al portale
                        </a>
                    </p>
                </div>
            </div>

            {/* RIGHT: VISUAL SECTION (Preserve Existing) */}
            <div className="hidden lg:flex flex-1 bg-slate-50 relative overflow-hidden items-center justify-center p-12">
                {/* Decorative Circle */}
                <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full border border-slate-200/50 opacity-50" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full border border-slate-200/50 opacity-50" />

                {/* Content Container */}
                <div className="max-w-2xl w-full flex flex-col gap-12 relative z-10">
                    <div className="relative group">
                        <div className="absolute top-4 -right-4 w-full h-full bg-slate-200 rounded-3xl -rotate-2 scale-95 transition-transform duration-700 group-hover:rotate-0 group-hover:scale-100 group-hover:bg-slate-300" />
                        <div className="bg-white rounded-3xl shadow-2xl shadow-slate-200 border border-slate-100 p-8 relative flex flex-col gap-6 w-full rotate-1 transition-transform duration-700 group-hover:rotate-0">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-white"><TrendingUp size={20} /></div>
                                    <div><div className="h-2.5 w-24 bg-slate-900 rounded-full mb-1.5 opacity-80" /><div className="h-2 w-16 bg-slate-200 rounded-full" /></div>
                                </div>
                                <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold font-mono">+24.5%</div>
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                                    <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600"><ShieldCheck size={16} /></div><div className="h-2 w-32 bg-slate-300 rounded-full" /></div><div className="h-2 w-12 bg-slate-300 rounded-full" />
                                </div>
                                <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                                    <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600"><Sparkles size={16} /></div><div className="h-2 w-24 bg-slate-300 rounded-full" /></div><div className="h-2 w-12 bg-slate-300 rounded-full" />
                                </div>
                            </div>
                            <div className="h-24 bg-slate-50 rounded-xl flex items-end justify-between p-4 gap-2">
                                {[40, 70, 45, 90, 60, 80, 50, 95].map((h, i) => (<div key={i} className="w-full bg-slate-800 rounded-t-sm opacity-80 hover:opacity-100 hover:bg-black transition-all" style={{ height: `${h}%` }} />))}
                            </div>
                        </div>
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-3">Archivio Bollette Digitale</h2>
                        <p className="text-slate-500 text-lg leading-relaxed">
                            Accedi al tuo storico, visualizza i consumi e scarica le fatture in totale autonomia.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
