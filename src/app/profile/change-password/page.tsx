'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ChangePasswordPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [passwords, setPasswords] = useState({
        newPassword: '',
        confirmPassword: ''
    })
    const [message, setMessage] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setMessage(null)

        if (passwords.newPassword !== passwords.confirmPassword) {
            setMessage('Le password non coincidono')
            return
        }

        setLoading(true)
        try {
            const { error } = await supabase.auth.updateUser({
                password: passwords.newPassword
            })

            if (error) throw error

            setMessage('Password aggiornata con successo! Reindirizzamento...')
            setTimeout(() => {
                router.push('/profile')
            }, 2000)
        } catch (error: any) {
            console.error('Error updating password:', error)
            setMessage(error.message || 'Errore durante l\'aggiornamento della password.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
            <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg border border-slate-100">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Imposta Nuova Password</h1>
                    <p className="text-slate-600">Inserisci la tua nuova password</p>
                </div>

                {message && (
                    <div className={`p-4 mb-4 rounded-xl text-sm ${message.includes('successo') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {message}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Nuova Password
                        </label>
                        <input
                            type="password"
                            required
                            minLength={6}
                            value={passwords.newPassword}
                            onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            placeholder="••••••••"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Conferma Password
                        </label>
                        <input
                            type="password"
                            required
                            minLength={6}
                            value={passwords.confirmPassword}
                            onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 px-6 rounded-xl bg-blue-600 text-white font-semibold shadow-lg hover:shadow-xl hover:bg-blue-700 transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            'Aggiorna Password'
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}
