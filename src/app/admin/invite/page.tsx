'use client'

import { useState, useTransition, useEffect } from 'react'
import { ShieldCheck, Mail, UserPlus, Loader2, X, Check, ArrowRight } from 'lucide-react'
import { inviteAdmin, getAdmins, removeAdmin, setAdminPermissions, getMyAdminContext, resendAdminInvite } from './actions'
import { toast } from 'sonner'
import { AdminPageHero } from '@/components/admin/admin-page-hero'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { Trash2 } from 'lucide-react'

export default function AdminManagementPage() {
    const [admins, setAdmins] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isPending, startTransition] = useTransition()
    const [currentUser, setCurrentUser] = useState<any>(null)
    const [ctx, setCtx] = useState<{ isSuperadmin: boolean; canInviteAdmins: boolean; canManageUsers: boolean } | null>(null)

    // Form State
    const [email, setEmail] = useState('')
    const [name, setName] = useState('')

    const supabase = createClient()

    useEffect(() => {
        const init = async () => {
            try {
                // Get current user profile
                const { data: { user }, error: authError } = await supabase.auth.getUser()
                if (authError) throw authError
                
                if (user) {
                    const { data: profile, error: profileError } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('auth_user_id', user.id)
                        .maybeSingle()
                    
                    if (profileError) console.error('Error fetching profile:', profileError)
                    setCurrentUser(profile)
                }
                setCtx(await getMyAdminContext())
            } catch (err) {
                console.error('Initialization error:', err)
            } finally {
                loadAdmins()
            }
        }
        init()
    }, [])

    const loadAdmins = async () => {
        setLoading(true)
        try {
            const data = await getAdmins()
            setAdmins(data)
        } finally {
            setLoading(false)
        }
    }

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault()

        const formData = new FormData()
        formData.append('email', email)
        formData.append('fullName', name.trim() || 'Amministratore')

        startTransition(async () => {
            const res = await inviteAdmin(formData)
            if (res.success) {
                if (res.codice) {
                    toast.success(`Invito inviato. Codice di accesso: ${res.codice}`, {
                        description: 'Comunica questo Codice Cliente all\'amministratore: gli serve per accedere.',
                        duration: 15000,
                    })
                } else {
                    toast.success("Invito inviato con successo!")
                }
                setEmail('')
                setName('')
                loadAdmins()
            } else {
                toast.error(res.error || "Errore durante l'invio dell'invito")
            }
        })
    }

    const handlePerm = async (adminId: string, key: 'can_invite_admins' | 'can_manage_users', value: boolean) => {
        // optimistic
        setAdmins(prev => prev.map(a => a.id === adminId ? { ...a, [key]: value } : a))
        const res = await setAdminPermissions(adminId, { [key]: value })
        if (!res.success) {
            toast.error(res.error || 'Errore salvataggio permessi')
            loadAdmins()
        }
    }

    const handleResend = async (userId: string) => {
        const res = await resendAdminInvite(userId)
        if (res.success) toast.success('Email con link aggiornato inviata.')
        else toast.error(res.error || "Errore durante l'invio")
    }

    const handleRemove = async (userId: string) => {
        if (!confirm("Eliminare definitivamente questo amministratore? L'account di accesso verrà rimosso e il codice tornerà disponibile. Potrai reinvitare la stessa email in seguito.")) return

        const res = await removeAdmin(userId)
        if (res.success) {
            toast.success("Amministratore eliminato")
            loadAdmins()
        } else {
            toast.error(res.error || "Errore durante l'eliminazione")
        }
    }

    if (ctx && !ctx.canInviteAdmins && !ctx.isSuperadmin) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-12">
                <ShieldCheck size={40} className="text-slate-300 dark:text-slate-700 mb-4" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Accesso non consentito</h3>
                <p className="text-[13px] text-slate-500 max-w-sm">
                    Solo i super amministratori (o gli admin abilitati) possono gestire le utenze amministrative.
                </p>
            </div>
        )
    }

    return (
        <>


            <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-0 flex-1 overflow-hidden bg-white dark:bg-[#0F1115] rounded-2xl">

                    {/* Left: Invite Form Section */}
                    <div className="border-r border-slate-200/70 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01] p-8">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-9 h-9 rounded-full bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-[#0F1115]">
                                <UserPlus size={18} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h3 className="text-[16px] font-bold text-slate-900 dark:text-white leading-tight">Nuova Utenza</h3>
                                <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">Invia un invito via email</p>
                            </div>
                        </div>

                        <form onSubmit={handleInvite} className="space-y-2">
                            <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 ml-4">Nome e Cognome</label>
                            <div className="group/input relative flex items-center bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full p-1 pl-12 focus-within:border-sky-300 dark:focus-within:border-sky-500/50 transition-all duration-300">
                                <UserPlus className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-sky-500 transition-colors" size={16} />
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Es. Mario Rossi"
                                    className="flex-1 h-9 bg-transparent border-none outline-none text-[13px] text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                                />
                            </div>

                            <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 ml-4 pt-1">Indirizzo Email</label>
                            <div className="group/input relative flex items-center bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full p-1 pl-12 focus-within:border-sky-300 dark:focus-within:border-sky-500/50 transition-all duration-300">
                                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-sky-500 transition-colors" size={16} />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    placeholder="admin@acquambiente.it"
                                    className="flex-1 h-9 bg-transparent border-none outline-none text-[13px] text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                                />

                                <button
                                    type="submit"
                                    disabled={isPending || !email}
                                    className={cn(
                                        "group/btn relative inline-flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.9] overflow-hidden shrink-0 ml-1",
                                        isPending
                                            ? "bg-slate-50 dark:bg-white/5 text-slate-400"
                                            : "bg-sky-100 dark:bg-sky-900/40 text-sky-900 dark:text-sky-100 hover:bg-sky-200 dark:hover:bg-sky-800/60"
                                    )}
                                >
                                    <span className="relative flex-shrink-0 w-5 h-5 bg-white dark:bg-white/10 rounded-full flex items-center justify-center overflow-hidden transition-colors duration-300">
                                        {isPending ? (
                                            <Loader2 size={12} className="animate-spin text-sky-600" />
                                        ) : (
                                            <>
                                                <svg
                                                    viewBox="0 0 14 15" fill="none" xmlns="http://www.w3.org/2000/svg"
                                                    className={cn(
                                                        "w-2 text-sky-600 dark:text-sky-400 transition-transform duration-300",
                                                        email ? "group-hover/btn:translate-x-[150%] group-hover/btn:-translate-y-[150%]" : ""
                                                    )}
                                                >
                                                    <path d="M13.376 11.552l-.264-10.44-10.44-.24.024 2.28 6.96-.048L.2 12.56l1.488 1.488 9.432-9.432-.048 6.912 2.304.024z" fill="currentColor" />
                                                </svg>
                                                <svg
                                                    viewBox="0 0 14 15" fill="none" xmlns="http://www.w3.org/2000/svg"
                                                    className={cn(
                                                        "absolute w-2 text-sky-600 dark:text-sky-400 transition-transform duration-300 translate-x-[-150%] translate-y-[150%]",
                                                        email ? "group-hover/btn:translate-x-0 group-hover/btn:translate-y-0 group-hover/btn:delay-75" : ""
                                                    )}
                                                >
                                                    <path d="M13.376 11.552l-.264-10.44-10.44-.24.024 2.28 6.96-.048L.2 12.56l1.488 1.488 9.432-9.432-.048 6.912 2.304.024z" fill="currentColor" />
                                                </svg>
                                            </>
                                        )}
                                    </span>
                                </button>
                            </div>
                        </form>

                        <div className="mt-12 p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-100/50 dark:border-indigo-500/10">
                            <div className="flex gap-3">
                                <ShieldCheck className="text-indigo-500 shrink-0" size={18} />
                                <p className="text-[12px] text-indigo-700/80 dark:text-indigo-300/80 leading-relaxed font-medium">
                                    Le nuove utenze riceveranno un link sicuro via email per impostare la propria password e accedere al pannello.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Right: Active Admins List */}
                    <div className="flex flex-col min-h-0 bg-white dark:bg-[#0F1115]">
                        <div className="h-14 px-8 border-b border-slate-200/70 dark:border-white/5 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-[#0F1115]/80 backdrop-blur-md z-10">
                            <div className="flex items-center gap-2">
                                <h3 className="text-[13px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                                    Utenze Attive
                                </h3>
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                    {admins.length}
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto custom-scrollbar">
                            {loading ? (
                                <div className="p-20 flex flex-col items-center justify-center gap-3">
                                    <Loader2 className="animate-spin text-slate-300 dark:text-slate-700" size={32} strokeWidth={1.5} />
                                    <span className="text-[12px] font-medium text-slate-400 animate-pulse">Caricamento...</span>
                                </div>
                            ) : admins.length === 0 ? (
                                <div className="p-20 text-center">
                                    <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-white/[0.02] flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-white/5">
                                        <ShieldCheck size={28} className="text-slate-300 dark:text-slate-700" />
                                    </div>
                                    <h4 className="text-[14px] font-bold text-slate-900 dark:text-white mb-1">Nessuna Utenza</h4>
                                    <p className="text-[12px] text-slate-500">Non ci sono ancora utenze attive nel sistema.</p>
                                </div>
                            ) : (
                                <div className="flex flex-col">
                                    {/* Table Header */}
                                    <div className="flex items-center px-8 py-3 border-b border-slate-100 dark:border-white/5 bg-slate-50/30 dark:bg-white/[0.01]">
                                        <div className="flex-1">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Utenza</span>
                                        </div>
                                        <div className="w-24 text-center">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ruolo</span>
                                        </div>
                                        <div className="flex items-center justify-center mr-3">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Permessi</span>
                                        </div>
                                        <div className="w-24 text-right">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Azioni</span>
                                        </div>
                                    </div>

                                    <div className="divide-y divide-slate-100 dark:divide-white/5">
                                        {admins.map((admin) => (
                                            <div key={admin.id} className="group flex items-center px-8 py-5 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                                                {/* Admin Info Column */}
                                                <div className="flex-1 flex items-center gap-4 min-w-0">
                                                    <div className="relative shrink-0">
                                                        <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-[12px] tracking-tight">
                                                            {(admin.name || admin.email || 'A')
                                                                .split(' ')
                                                                .map((n: any) => n[0])
                                                                .join('')
                                                                .toUpperCase()
                                                                .slice(0, 2)}
                                                        </div>
                                                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-[#0F1115] rounded-full" />
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[14px] font-bold text-slate-900 dark:text-white truncate">
                                                                {admin.name || 'Utenza'}
                                                            </span>
                                                            {admin.role === 'superadmin' && (
                                                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8px] font-black uppercase tracking-wider">
                                                                    Super
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-[12px] text-slate-500 dark:text-slate-400 font-mono truncate">
                                                            {admin.email}
                                                        </span>
                                                        {admin.codice_cliente && (
                                                            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                                                                Codice accesso: <span className="font-bold text-slate-600 dark:text-slate-300">{admin.codice_cliente}</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Role Column */}
                                                <div className="w-24 text-center">
                                                    <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 capitalize tracking-tight">
                                                        {admin.role}
                                                    </p>
                                                </div>

                                                {/* Permissions Column (super_admin only) */}
                                                <div className="flex items-center justify-center gap-1.5 mr-3">
                                                    {ctx?.isSuperadmin && (
                                                        admin.role === 'admin' ? (
                                                            <>
                                                                <button
                                                                    onClick={() => handlePerm(admin.id, 'can_invite_admins', !admin.can_invite_admins)}
                                                                    className={cn(
                                                                        "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-colors",
                                                                        admin.can_invite_admins
                                                                            ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20"
                                                                            : "bg-slate-50 dark:bg-white/5 text-slate-400 border-slate-200 dark:border-white/10 hover:text-slate-600"
                                                                    )}
                                                                    title="Può invitare altri amministratori"
                                                                >
                                                                    Invita admin
                                                                </button>
                                                                <button
                                                                    onClick={() => handlePerm(admin.id, 'can_manage_users', !admin.can_manage_users)}
                                                                    className={cn(
                                                                        "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-colors",
                                                                        admin.can_manage_users
                                                                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                                                            : "bg-slate-50 dark:bg-white/5 text-slate-400 border-slate-200 dark:border-white/10 hover:text-slate-600"
                                                                    )}
                                                                    title="Può modificare i dati utente e reimpostare le password"
                                                                >
                                                                    Gestione utenti
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                                                                Tutti i permessi
                                                            </span>
                                                        )
                                                    )}
                                                </div>

                                                {/* Actions Column */}
                                                <div className="w-24 flex justify-end items-center gap-2">
                                                    {(currentUser?.role === 'super_admin' || currentUser?.role === 'superadmin') && (
                                                        <button
                                                            onClick={() => handleResend(admin.id)}
                                                            className="w-10 h-10 rounded-full border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:border-sky-400 dark:hover:border-sky-500 hover:bg-sky-50 dark:hover:bg-sky-500/10 hover:text-sky-500 transition-all group/send"
                                                            title="Reinvia email con link aggiornato"
                                                        >
                                                            <Mail size={17} strokeWidth={2} className="group-hover/send:scale-110 transition-transform" />
                                                        </button>
                                                    )}
                                                    {(currentUser?.role === 'super_admin' || currentUser?.role === 'superadmin') && admin.id !== currentUser?.id && (
                                                        <button
                                                            onClick={() => handleRemove(admin.id)}
                                                            className="w-10 h-10 rounded-full border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:border-red-400 dark:hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-all group/trash"
                                                            title="Revoca Accesso Utenza"
                                                        >
                                                            <Trash2 size={18} strokeWidth={2} className="group-hover/trash:scale-110 transition-transform" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
