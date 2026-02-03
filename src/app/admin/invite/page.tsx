'use client'

import { useState, useTransition, useEffect } from 'react'
import { ShieldCheck, Mail, UserPlus, Loader2 } from 'lucide-react'
import { inviteAdmin, getAdmins } from './actions'
import { toast } from 'sonner'

export default function AdminManagementPage() {
    const [admins, setAdmins] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isnamPending, startTransition] = useTransition()
    // Form State
    const [email, setEmail] = useState('')
    const [fullName, setFullName] = useState('')

    useEffect(() => {
        loadAdmins()
    }, [])

    const loadAdmins = async () => {
        setLoading(true)
        const data = await getAdmins()
        setAdmins(data)
        setLoading(false)
    }

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault()

        const formData = new FormData()
        formData.append('email', email)
        formData.append('fullName', fullName)

        startTransition(async () => {
            const res = await inviteAdmin(formData)
            if (res.success) {
                toast.success("Invito inviato con successo! L'utente riceverà una email.")
                setEmail('')
                setFullName('')
                loadAdmins()
            } else {
                toast.error(res.error || "Errore durante l'invio dell'invito")
            }
        })
    }



    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Gestione Amministratori</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-2">Invita nuovi amministratori o gestisci i permessi esistenti.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Column: Invite Form */}
                <div className="lg:col-span-1">
                    <div className="bg-white/60 dark:bg-[#1e1e1e]/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm sticky top-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-black shadow-lg shadow-slate-900/10">
                                <UserPlus size={20} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Invita Admin</h3>
                        </div>

                        <form onSubmit={handleInvite} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5 ml-1">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        placeholder="admin@esempio.com"
                                        className="w-full pl-10 pr-4 py-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1.5 ml-1">Nome Completo</label>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    required
                                    placeholder="Mario Rossi"
                                    className="w-full px-4 py-3 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white transition-all"
                                />
                            </div>



                            <button
                                type="submit"
                                disabled={isnamPending}
                                className="w-full py-3 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-slate-200 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isnamPending ? <Loader2 size={18} className="animate-spin" /> : 'Invia Invito'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Right Column: List */}
                <div className="lg:col-span-2">
                    <div className="bg-white/60 dark:bg-[#1e1e1e]/60 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-slate-100 dark:border-white/10 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <ShieldCheck size={20} className="text-slate-500" />
                                Amministratori Attivi
                            </h3>

                        </div>

                        {loading ? (
                            <div className="p-12 flex justify-center">
                                <Loader2 className="animate-spin text-slate-400" />
                            </div>
                        ) : admins.length === 0 ? (
                            <div className="p-12 text-center text-slate-500">
                                Nessun amministratore trovato.
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-white/5">
                                {admins.map((admin) => (
                                    <div key={admin.id} className="p-4 flex items-center justify-between group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
                                                {(admin.user_metadata?.full_name || admin.email || 'A')[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-900 dark:text-white text-sm">
                                                    {admin.user_metadata?.full_name || 'Admin'}
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                                                    {admin.email}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className="text-right hidden sm:block">
                                                <div className="text-[10px] uppercase font-bold text-slate-400">Ultimo Accesso</div>
                                                <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                                                    {admin.last_sign_in_at ? new Date(admin.last_sign_in_at).toLocaleDateString('it-IT') : 'Mai'}
                                                </div>
                                            </div>


                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    )
}
