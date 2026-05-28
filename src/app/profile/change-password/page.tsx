'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { changePassword } from './actions'

export default function ChangePasswordPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    })
    const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setMessage(null)

        if (form.newPassword !== form.confirmPassword) {
            setMessage({ kind: 'err', text: 'Le password non coincidono.' })
            return
        }

        setLoading(true)
        const res = await changePassword(form.currentPassword, form.newPassword)

        if (res?.error) {
            setMessage({ kind: 'err', text: res.error })
            setLoading(false)
            return
        }

        setMessage({ kind: 'ok', text: 'Password aggiornata. Reindirizzamento...' })
        setTimeout(() => router.push('/profile'), 1500)
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-[#0a0a0a]">
            <div className="w-full max-w-md bg-white dark:bg-white/[0.04] p-8 rounded-2xl shadow-lg border border-slate-100 dark:border-white/10">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Cambia Password</h1>
                    <p className="text-slate-600 dark:text-slate-400 text-sm">
                        Per motivi di sicurezza inserisci la password attuale e quella nuova.
                    </p>
                </div>

                {message && (
                    <div
                        className={`p-4 mb-4 rounded-xl text-sm ${
                            message.kind === 'ok'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                                : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                        }`}
                    >
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <Field
                        label="Password Attuale"
                        value={form.currentPassword}
                        onChange={v => setForm({ ...form, currentPassword: v })}
                    />
                    <Field
                        label="Nuova Password"
                        value={form.newPassword}
                        onChange={v => setForm({ ...form, newPassword: v })}
                        helper="Almeno 8 caratteri, una maiuscola, una minuscola, un numero e un carattere speciale."
                    />
                    <Field
                        label="Conferma Nuova Password"
                        value={form.confirmPassword}
                        onChange={v => setForm({ ...form, confirmPassword: v })}
                    />

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => router.push('/profile')}
                            disabled={loading}
                            className="flex-1 py-3.5 px-6 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-200 dark:hover:bg-white/[0.1] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Annulla
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-3.5 px-6 rounded-xl bg-blue-600 text-white font-semibold shadow-lg hover:shadow-xl hover:bg-blue-700 transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Aggiorna'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

function Field({
    label,
    value,
    onChange,
    helper
}: {
    label: string
    value: string
    onChange: (v: string) => void
    helper?: string
}) {
    return (
        <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">{label}</label>
            <input
                type="password"
                required
                minLength={8}
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-900 dark:text-white"
                placeholder="••••••••"
                autoComplete="current-password"
            />
            {helper && <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">{helper}</p>}
        </div>
    )
}
