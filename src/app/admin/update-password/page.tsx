'use client'

import { useState } from 'react'
import { updatePassword } from './actions'
import { Lock, Loader2, CheckCircle2 } from 'lucide-react'

export default function UpdatePasswordPage() {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(formData: FormData) {
        setLoading(true)
        setError(null)

        const res = await updatePassword(formData)
        if (res?.error) {
            setError(res.error)
            setLoading(false)
        }
        // Redirect is handled by action
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0a0a0a] p-4">
            <div className="w-full max-w-md bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 p-8">
                <div className="text-center mb-8">
                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <Lock size={24} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Imposta Password</h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Per completare l'attivazione del tuo account, imposta una password sicura.
                    </p>
                </div>

                <form action={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-500/30 rounded-lg text-red-600 dark:text-red-400 text-sm font-medium">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Nuova Password</label>
                            <input
                                name="password"
                                type="password"
                                required
                                minLength={6}
                                placeholder="••••••••"
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Conferma Password</label>
                            <input
                                name="confirmPassword"
                                type="password"
                                required
                                minLength={6}
                                placeholder="••••••••"
                                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all dark:text-white"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {loading ? <Loader2 size={18} className="animate-spin" /> : 'Imposta e Accedi'}
                    </button>
                </form>
            </div>
        </div>
    )
}
