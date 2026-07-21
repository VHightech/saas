'use client'

import { useState, useEffect } from 'react'
import {
    AlertCircle, Loader2, Check, Trash2, History, Search, Download, Database, Terminal,
} from 'lucide-react'
import { toast } from 'sonner'
import { AdminPageHero } from '@/components/admin/admin-page-hero'
import { DbHealthCard } from '@/components/admin/db-health-card'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AdminUploadPage() {
    const [role, setRole] = useState<string | null>(null)
    const [loadingRole, setLoadingRole] = useState(true)
    const [logs, setLogs] = useState<any[]>([])
    const [loadingLogs, setLoadingLogs] = useState(false)
    const supabase = createClient()
    const router = useRouter()

    const fetchLogs = async () => {
        setLoadingLogs(true)
        try {
            const { data, error } = await supabase
                .from('import_logs')
                .select('*')
                .eq('kind', 'bills')
                .order('created_at', { ascending: false })
                .limit(200)
            if (error) throw error
            setLogs(data || [])
        } catch (err: any) {
            console.error('Error fetching logs:', err.message)
        } finally {
            setLoadingLogs(false)
        }
    }

    useEffect(() => {
        if (role === 'superadmin' || role === 'super_admin') fetchLogs()
    }, [role])

    const handleDeleteImport = async (id: string) => {
        if (!confirm('Sei sicuro di voler eliminare questo caricamento? Verranno eliminate anche tutte le bollette associate e i file su R2.')) return
        try {
            const res = await fetch(`/api/upload/${id}`, { method: 'DELETE' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Errore eliminazione')
            toast.success('Importazione eliminata con successo')
            fetchLogs()
        } catch (err: any) {
            toast.error(err.message)
        }
    }

    useEffect(() => {
        async function checkRole() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.push('/login'); return }
            const { data: profile } = await supabase
                .from('profiles').select('role').eq('auth_user_id', user.id).single()
            const userRole = profile?.role
            setRole(userRole)
            setLoadingRole(false)
            if (userRole !== 'superadmin' && userRole !== 'super_admin') {
                toast.error('Accesso limitato ai Super Admin')
                router.push('/admin/users')
            }
        }
        checkRole()
    }, [])

    if (loadingRole) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="animate-spin text-slate-300 dark:text-slate-700" size={32} />
                    <span className="text-[12px] font-medium text-slate-400">Verifica permessi...</span>
                </div>
            </div>
        )
    }

    if (role !== 'superadmin' && role !== 'super_admin') return null

    return (
        <>
            <AdminPageHero title="Centro Caricamento" />
            <div className="h-full overflow-y-auto custom-scrollbar flex flex-col gap-6 px-6 py-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <DbHealthCard />
                <ImportInfoBanner />
                <UploadHistory logs={logs} loading={loadingLogs} onDelete={handleDeleteImport} />
            </div>
        </>
    )
}

function ImportInfoBanner() {
    return (
        <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-6">
            <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
                    <Terminal size={22} />
                </div>
                <div className="min-w-0">
                    <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">Le importazioni si eseguono in locale</h3>
                    <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Per motivi di dimensione e sicurezza, il caricamento massivo di bollette (CSV + 7z) e anagrafiche
                        non avviene più dal web. Eseguilo dal computer autorizzato con:
                    </p>
                    <code className="inline-block mt-3 px-3 py-2 rounded-lg bg-slate-100 dark:bg-white/5 text-[13px] font-mono font-bold text-slate-800 dark:text-slate-100">
                        npm run import
                    </code>
                    <p className="text-[12px] text-slate-400 mt-3 leading-relaxed">
                        Lo script è interattivo: scegli la modalità (anagrafiche oppure bollette+PDF), indica i file,
                        controlla l&apos;anteprima e conferma. I risultati compaiono qui sotto nello storico.
                    </p>
                </div>
            </div>
        </div>
    )
}

function UploadHistory({ logs, loading, onDelete }: any) {
    const [query, setQuery] = useState('')

    if (loading && logs.length === 0) {
        return (
            <div className="mt-4 p-12 text-center flex flex-col items-center gap-3">
                <Loader2 className="animate-spin text-slate-300" size={24} />
                <span className="text-[13px] font-medium text-slate-400">Caricamento storico...</span>
            </div>
        )
    }

    const filtered = query.trim()
        ? logs.filter((l: any) => (l.archive_name || 'Importazione Manuale').toLowerCase().includes(query.trim().toLowerCase()))
        : logs
    const totalRecords = logs.reduce((s: number, l: any) => s + (l.processed_files || 0), 0)

    const exportCsv = () => {
        const header = ['Archivio', 'Record', 'Stato', 'Data']
        const rows = logs.map((l: any) => [
            l.archive_name || 'Importazione Manuale',
            String(l.processed_files ?? 0),
            l.status || '',
            new Date(l.created_at).toLocaleString('it-IT'),
        ])
        const csv = [header, ...rows]
            .map(r => r.map((c: string) => `"${String(c).replace(/"/g, '""')}"`).join(','))
            .join('\n')
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'storico_caricamenti.csv'
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="space-y-5 pb-20">
            <div className="flex items-center justify-between gap-4 px-2 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-600 dark:text-slate-400">
                        <History size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Storico Caricamenti</h2>
                        <p className="text-[11px] text-slate-500 font-medium">
                            {logs.length} importazion{logs.length === 1 ? 'e' : 'i'}
                            {query.trim() && ` · ${filtered.length} risultat${filtered.length === 1 ? 'o' : 'i'}`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                    <div className="flex items-center gap-2 h-9 px-3.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 shrink-0">
                        <Database size={13} className="text-slate-400" />
                        <span className="text-[13px] font-bold text-slate-800 dark:text-white tabular-nums">{totalRecords.toLocaleString('it-IT')}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">record totali</span>
                    </div>
                    <div className="relative flex-1 sm:w-56">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                            placeholder="Cerca archivio..."
                            className="w-full h-9 pl-9 pr-4 rounded-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[12px] text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-slate-300 dark:focus:border-white/20 transition-all"
                        />
                    </div>
                    <button
                        onClick={exportCsv} disabled={logs.length === 0}
                        className="h-9 px-3.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-[#1A1F2A] text-[12px] font-bold flex items-center gap-2 hover:bg-slate-800 dark:hover:bg-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                        title="Esporta la lista (archivio + n. record) in CSV"
                    >
                        <Download size={14} />
                        <span className="hidden sm:inline">Esporta CSV</span>
                    </button>
                </div>
            </div>

            {logs.length === 0 ? (
                <div className="p-12 text-center rounded-[2rem] border border-dashed border-slate-200 dark:border-white/10">
                    <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-300 dark:text-slate-700 mx-auto mb-4">
                        <History size={24} />
                    </div>
                    <p className="text-slate-400 text-[13px] font-medium">Nessun caricamento registrato nel database.</p>
                </div>
            ) : (
                <div className="rounded-3xl border border-slate-200 dark:border-white/10 overflow-hidden bg-white dark:bg-white/[0.02]">
                    <div className="divide-y divide-slate-100 dark:divide-white/5">
                        {filtered.map((log: any) => (
                            <div key={log.id} className="group flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors">
                                <div className="flex items-center gap-3.5 min-w-0">
                                    <div className={cn(
                                        'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                                        log.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                                        log.status === 'error' ? 'bg-rose-500/10 text-rose-500' : 'bg-sky-500/10 text-sky-500'
                                    )}>
                                        {log.status === 'completed' ? <Check size={16} strokeWidth={3} /> :
                                         log.status === 'error' ? <AlertCircle size={16} /> : <Loader2 size={16} className="animate-spin" />}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <h4 className="font-bold text-slate-900 dark:text-white text-[13.5px] truncate">{log.archive_name || 'Importazione Manuale'}</h4>
                                            <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-[9px] font-bold text-slate-500 font-mono tracking-tighter">
                                                {new Date(log.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 min-w-0">
                                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 shrink-0">
                                                <Database size={11} className="text-slate-400" />
                                                <span className="text-slate-700 dark:text-slate-300 font-bold tabular-nums">{log.processed_files}</span>
                                                <span className="text-[10px] text-slate-400 uppercase tracking-tight">record</span>
                                            </div>
                                            {log.status === 'error' && (
                                                <span className="text-[11px] text-rose-500 font-bold bg-rose-500/5 px-2 py-0.5 rounded-lg border border-rose-500/10 truncate">{log.current_file}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => onDelete(log.id)}
                                    className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100 shrink-0"
                                    title="Elimina questo import"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                        {filtered.length === 0 && (
                            <div className="px-4 py-10 text-center text-[12px] text-slate-400 italic">
                                Nessun caricamento corrisponde a "{query}".
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
