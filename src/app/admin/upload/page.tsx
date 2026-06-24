'use client'

import { useState, useEffect, useMemo } from 'react'
import { 
    UploadCloud, 
    FileText, 
    CheckCircle2, 
    AlertCircle, 
    Loader2, 
    FileArchive, 
    ArrowRight, 
    Database, 
    X, 
    Users,
    ShieldAlert,
    Check,
    Trash2,
    History,
    Search,
    Download
} from 'lucide-react'
import { useAdminUpload } from '@/components/providers/admin-upload-provider'
import { toast } from 'sonner'
import { AdminPageHero } from '@/components/admin/admin-page-hero'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface UploadResult {
    processed: number
    newUsers: number
    matchedByCif?: number
    matchedByCfpi?: number
    pdfsUploaded: number
    pdfsSkipped?: number
    pdfsLinked: number
    errors: string[]
    preview?: boolean
    previewPdfCount?: number
    previewPdfMatches?: number
    previewAlreadyLinked?: number
    uniqueMatchedUsers?: number
    duplicateArchive?: boolean
    existingArchiveTotal?: number
    overwriteWarning?: boolean
}

export default function AdminUploadPage() {
    const [csvFiles, setCsvFiles] = useState<File[]>([])
    const [archiveFiles, setArchiveFiles] = useState<File[]>([])
    const [showPreviewModal, setShowPreviewModal] = useState(false)
    const [previewStats, setPreviewStats] = useState<UploadResult | null>(null)
    const [analyzing, setAnalyzing] = useState(false)
    const [role, setRole] = useState<string | null>(null)
    const [loadingRole, setLoadingRole] = useState(true)
    
    const [logs, setLogs] = useState<any[]>([])
    const [loadingLogs, setLoadingLogs] = useState(false)
    
    const { uploadFiles, uploadBatch, isUploading, batchIndex, batchTotal } = useAdminUpload()
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
        if (role === 'superadmin' || role === 'super_admin') {
            fetchLogs()
        }
    }, [role])

    const handleDeleteImport = async (id: string) => {
        if (!confirm("Sei sicuro di voler eliminare questo caricamento? Verranno eliminate anche tutte le bollette associate e i file su R2.")) return
        
        try {
            const res = await fetch(`/api/upload/${id}`, { method: 'DELETE' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Errore eliminazione')
            toast.success("Importazione eliminata con successo")
            fetchLogs()
        } catch (err: any) {
            toast.error(err.message)
        }
    }

    useEffect(() => {
        async function checkRole() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
                return
            }
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('auth_user_id', user.id)
                .single()
            
            const userRole = profile?.role
            setRole(userRole)
            setLoadingRole(false)

            // Strict SuperAdmin check
            if (userRole !== 'superadmin' && userRole !== 'super_admin') {
                toast.error("Accesso limitato ai Super Admin")
                router.push('/admin/users')
            }
        }
        checkRole()
    }, [])

    // Merge newly picked files into the list, de-duped by name (so re-picking the
    // same file doesn't add a duplicate).
    const mergeFiles = (prev: File[], picked: File[]) => {
        const names = new Set(prev.map(f => f.name))
        return [...prev, ...picked.filter(f => !names.has(f.name))]
    }

    const handleCsvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const picked = Array.from(e.target.files ?? [])
        if (picked.length) { setCsvFiles(prev => mergeFiles(prev, picked)); setPreviewStats(null) }
        e.target.value = ''
    }

    const handleArchiveChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const picked = Array.from(e.target.files ?? [])
        if (picked.length) { setArchiveFiles(prev => mergeFiles(prev, picked)); setPreviewStats(null) }
        e.target.value = ''
    }

    // Pair each CSV with its archive by the shared yyyymmdd date token in the name.
    const dateToken = (name: string) => name.match(/(\d{8})/)?.[1] ?? null
    const pairs = useMemo(() => {
        const arc = new Map<string, File>()
        for (const a of archiveFiles) { const d = dateToken(a.name); if (d) arc.set(d, a) }
        const out: { csv: File; archive: File; date: string }[] = []
        for (const c of csvFiles) {
            const d = dateToken(c.name)
            if (d && arc.has(d)) out.push({ csv: c, archive: arc.get(d)!, date: d })
        }
        return out
    }, [csvFiles, archiveFiles])

    const handleAnalyze = async () => {
        if (pairs.length !== 1) return
        const { csv, archive } = pairs[0]
        if (!csv.name.toLowerCase().startsWith('xml')) {
            toast.error("Il file CSV del flusso dati deve iniziare con 'Xml'.")
            return
        }

        setAnalyzing(true)
        const formData = new FormData()
        formData.append('csv', csv)
        formData.append('archive', archive)

        try {
            const res = await fetch('/api/upload?preview=true', { method: 'POST', body: formData })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Analisi fallita')
            setPreviewStats(data)
            setShowPreviewModal(true)
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setAnalyzing(false)
        }
    }

    const handleConfirmUpload = async () => {
        if (pairs.length !== 1) return
        const { csv, archive } = pairs[0]
        setShowPreviewModal(false)
        const force = previewStats?.duplicateArchive || false
        await uploadFiles(csv, archive, force)
        setCsvFiles([]); setArchiveFiles([])
    }

    // Bulk: run every paired (csv, archive) sequentially, each its own batch.
    const handleRunBatch = async () => {
        if (pairs.length === 0) return
        await uploadBatch(pairs.map(p => ({ csv: p.csv, archive: p.archive })))
        setCsvFiles([]); setArchiveFiles([])
    }

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

    if (role !== 'superadmin' && role !== 'super_admin') {
        return (
            <div className="h-full flex items-center justify-center p-8">
                <div className="max-w-md w-full p-8 rounded-3xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center animate-in fade-in zoom-in-95 duration-500">
                    <div className="w-16 h-16 rounded-full bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-500 mx-auto mb-6">
                        <ShieldAlert size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Accesso Negato</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-[13px] leading-relaxed mb-6">
                        Questa sezione è riservata esclusivamente agli amministratori di sistema con privilegi superiori.
                    </p>
                    <button 
                        onClick={() => router.push('/admin/users')}
                        className="px-6 py-2.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[13px] font-bold hover:opacity-90 transition-all"
                    >
                        Torna all'Anagrafica
                    </button>
                </div>
            </div>
        )
    }

    return (
        <>
            <AdminPageHero 
                title="Centro Caricamento"
            />

            <div className="h-full overflow-y-auto custom-scrollbar flex flex-col gap-6 px-6 py-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                
                {/* Main Content Grid — three compact cards in one row */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

                    {/* CSV Upload Card */}
                    <UploadCard
                        title="Flusso Dati CSV"
                        subtitle="Clienti, fatturazioni e scadenze"
                        icon={<Database size={20} />}
                        files={csvFiles}
                        onFileChange={handleCsvChange}
                        onClearAll={() => setCsvFiles([])}
                        accept=".csv"
                        color="sky"
                        description={<span>File <code className="font-mono text-[11px] font-bold bg-sky-100 dark:bg-sky-500/20 px-1.5 py-0.5 rounded">.csv</code> esportati</span>}
                    />

                    {/* Archive Upload Card */}
                    <UploadCard
                        title="Archivio Fatture"
                        subtitle="Documenti PDF compressi"
                        icon={<FileArchive size={20} />}
                        files={archiveFiles}
                        onFileChange={handleArchiveChange}
                        onClearAll={() => setArchiveFiles([])}
                        accept=".7z"
                        color="emerald"
                        description={<span>Archivi <code className="font-mono text-[11px] font-bold bg-emerald-100 dark:bg-emerald-500/20 px-1.5 py-0.5 rounded">.7z</code> con i PDF</span>}
                    />

                    {/* User Upload Card */}
                    <UserUploadCard />
                </div>

                {/* Pairing summary (bulk) */}
                {(csvFiles.length > 0 || archiveFiles.length > 0) && (
                    <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 text-[12px] flex-wrap">
                        <span className="font-bold text-slate-700 dark:text-slate-200">{pairs.length}</span>
                        <span className="text-slate-500">coppia/e CSV↔archivio abbinate per data</span>
                        {(csvFiles.length !== pairs.length || archiveFiles.length !== pairs.length) && (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                                · {Math.max(csvFiles.length, archiveFiles.length) - pairs.length} file senza corrispondenza
                            </span>
                        )}
                    </div>
                )}

                {/* Floating Action Button */}
                {pairs.length > 0 && !isUploading && (
                    <div className="fixed bottom-12 right-12 z-40 animate-in fade-in slide-in-from-bottom-8 duration-500">
                        <button
                            onClick={pairs.length === 1 ? handleAnalyze : handleRunBatch}
                            disabled={analyzing}
                            className={cn(
                                "group relative px-8 py-4 rounded-2xl font-bold text-[15px] flex items-center gap-3 transition-all active:scale-95 shadow-xl",
                                analyzing
                                    ? "bg-slate-100 dark:bg-white/5 text-slate-400 cursor-wait"
                                    : "bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/20"
                            )}
                        >
                            {analyzing ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Analisi in corso...
                                </>
                            ) : pairs.length === 1 ? (
                                <>
                                    Avvia Analisi Flusso
                                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            ) : (
                                <>
                                    Carica {pairs.length} flussi
                                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* Upload History Section */}
                <UploadHistory 
                    logs={logs} 
                    loading={loadingLogs} 
                    onDelete={handleDeleteImport} 
                />
            </div>

            {/* PREVIEW MODAL */}
            {showPreviewModal && previewStats && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowPreviewModal(false)} />
                    
                    <div className="relative bg-white dark:bg-[#0F1115] rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-500">
                        {/* Header */}
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                                    <CheckCircle2 size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Analisi Completata</h2>
                                    <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Verifica i dati rilevati</p>
                                </div>
                            </div>
                            <button onClick={() => setShowPreviewModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-8 space-y-6">
                            {previewStats.duplicateArchive && (
                                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/5 border border-amber-200/50 dark:border-amber-500/20 flex gap-3">
                                    <AlertCircle className="text-amber-500 shrink-0" size={18} />
                                    <div>
                                        <h4 className="text-[13px] font-bold text-amber-900 dark:text-amber-400">Archivio già presente</h4>
                                        <p className="text-[11px] text-amber-700/80 dark:text-amber-500/80 mt-0.5 leading-relaxed">
                                            Questo archivio è già stato caricato. Procedendo verranno aggiornati i record esistenti.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <StatBox 
                                    label="Record CSV" 
                                    value={previewStats.processed} 
                                    sub="Totale righe"
                                />
                                <StatBox 
                                    label="Clienti Trovati" 
                                    value={previewStats.uniqueMatchedUsers || ((previewStats.matchedByCif || 0) + (previewStats.matchedByCfpi || 0))} 
                                    sub={`${previewStats.matchedByCif} CIF · ${previewStats.matchedByCfpi} CFPI`}
                                    color="emerald"
                                />
                            </div>

                            <div className="p-6 rounded-[1.5rem] bg-slate-50 dark:bg-white/5 border border-slate-200/50 dark:border-white/10">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-2">
                                        <FileArchive size={16} className="text-slate-400" />
                                        <span className="text-[12px] font-bold text-slate-700 dark:text-slate-200">Dettaglio Archivio</span>
                                    </div>
                                    <span className="text-[11px] font-medium text-slate-400 font-mono">{pairs[0]?.archive?.name}</span>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    <div className="text-center">
                                        <span className="block text-[20px] font-bold text-slate-900 dark:text-white">{previewStats.previewPdfCount || 0}</span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Totali</span>
                                    </div>
                                    <div className="text-center border-x border-slate-200 dark:border-white/10">
                                        <span className="block text-[20px] font-bold text-sky-500">{(previewStats.previewPdfMatches || 0) - (previewStats.previewAlreadyLinked || 0)}</span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Nuovi</span>
                                    </div>
                                    <div className="text-center">
                                        <span className="block text-[20px] font-bold text-slate-400">{previewStats.previewAlreadyLinked || 0}</span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Presenti</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-8 pt-0 flex gap-3">
                            <button
                                onClick={() => setShowPreviewModal(false)}
                                className="flex-1 px-6 py-3 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 text-[13px] font-bold hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                            >
                                Annulla
                            </button>
                            <button
                                onClick={handleConfirmUpload}
                                className={cn(
                                    "flex-[2] px-6 py-3 rounded-xl text-white text-[13px] font-bold transition-all shadow-lg",
                                    previewStats.duplicateArchive 
                                        ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20" 
                                        : "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20"
                                )}
                            >
                                {previewStats.duplicateArchive ? 'Sovrascrivi e Continua' : 'Conferma e Avvia Importazione'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

function UploadCard({ title, subtitle, icon, files = [], onFileChange, onClearAll, accept, color, description }: any) {
    const colors = {
        sky: 'text-sky-500 bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/20',
        emerald: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
        violet: 'text-violet-500 bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20',
    } as any

    const has = files.length > 0
    const totalMb = files.reduce((s: number, f: File) => s + f.size, 0) / (1024 * 1024)

    return (
        <div className={cn(
            "relative group rounded-3xl border transition-all duration-300 p-5 flex flex-col gap-4",
            has
                ? "bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/10 shadow-sm"
                : "bg-white dark:bg-[#0F1115] border-dashed border-slate-300 dark:border-white/10 hover:border-slate-400 dark:hover:border-white/20"
        )}>
            <div className="flex items-start justify-between">
                <div className="flex gap-3">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105", colors[color])}>
                        {icon}
                    </div>
                    <div>
                        <h3 className="text-[15px] font-bold text-slate-900 dark:text-white leading-tight">{title}</h3>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">{subtitle}</p>
                    </div>
                </div>
                {has && (
                    <div className="flex flex-col items-end gap-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 flex items-center gap-1">
                            <Check size={12} strokeWidth={3} /> {files.length} file
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">{totalMb.toFixed(2)} MB</span>
                    </div>
                )}
            </div>

            <div className="flex-1 flex flex-col gap-3">
                <div className="text-[12px] text-slate-500 leading-relaxed">
                    {description}
                </div>

                {has && (
                    <div className="flex flex-col gap-1 max-h-28 overflow-y-auto custom-scrollbar">
                        {files.map((f: File, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-white/5 rounded-lg px-2 py-1">
                                <FileText size={12} className="text-slate-400 shrink-0" />
                                <span className="truncate">{f.name}</span>
                            </div>
                        ))}
                    </div>
                )}

                <div className="relative mt-auto">
                    <input type="file" accept={accept} multiple onChange={onFileChange} className="hidden" id={`file-${color}`} />
                    <label
                        htmlFor={`file-${color}`}
                        className={cn(
                            "flex items-center justify-center gap-2 w-full py-3 rounded-2xl border-2 border-dashed transition-all cursor-pointer font-bold text-[12px]",
                            has
                                ? "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200"
                                : "bg-transparent border-slate-200 dark:border-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-white/20"
                        )}
                    >
                        <UploadCloud size={16} />
                        {has ? 'Aggiungi altri…' : 'Scegli i file…'}
                    </label>
                    {has && (
                        <button
                            onClick={onClearAll}
                            title="Rimuovi tutti"
                            className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white dark:bg-[#1A1F2A] border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400 hover:text-red-500 shadow-sm transition-all active:scale-90"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

function UserUploadCard() {
    const [file, setFile] = useState<File | null>(null)
    const { uploadUsers, isUploading, kind } = useAdminUpload()
    const uploading = isUploading && kind === 'users'

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0]
            if (!selectedFile.name.toLowerCase().startsWith('contratti')) {
                toast.error("Il file deve iniziare con 'contratti'")
                return
            }
            setFile(selectedFile)
        }
    }

    const handleUpload = async () => {
        if (!file || isUploading) return
        await uploadUsers(file)
        setFile(null)
    }

    return (
        <div className="bg-white dark:bg-white/[0.02] rounded-3xl border border-slate-200 dark:border-white/10 p-5">
            <div className="flex flex-col gap-4 h-full">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center shrink-0">
                        <Users size={20} />
                    </div>
                    <div>
                        <h3 className="text-[15px] font-bold text-slate-900 dark:text-white leading-tight">Anagrafica Utenti</h3>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">Sincronizzazione massiva profili clienti</p>
                    </div>
                </div>

                <div className="flex flex-col gap-2 w-full mt-auto">
                    <div className="relative w-full">
                        <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" id="user-csv" />
                        <label 
                            htmlFor="user-csv"
                            className={cn(
                                "flex items-center justify-center gap-3 w-full h-11 px-4 rounded-xl border border-dashed transition-all cursor-pointer font-bold text-[13px]",
                                file 
                                    ? "bg-violet-50 dark:bg-violet-500/5 border-violet-200 dark:border-violet-500/20 text-violet-700 dark:text-violet-300" 
                                    : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            )}
                        >
                            <span className="truncate">{file ? file.name : 'Scegli CSV Clienti'}</span>
                        </label>
                        {file && (
                            <button onClick={() => setFile(null)} className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-white dark:bg-[#1A1F2A] border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400 hover:text-red-500 shadow-sm">
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    <button
                        onClick={handleUpload}
                        disabled={!file || uploading}
                        className={cn(
                            "h-11 w-full px-6 rounded-xl font-bold text-[13px] transition-all active:scale-95",
                            !file || uploading
                                ? "bg-slate-100 dark:bg-white/5 text-slate-400 cursor-not-allowed"
                                : "bg-violet-600 text-white shadow-lg shadow-violet-600/20 hover:bg-violet-700"
                        )}
                    >
                        {uploading ? <Loader2 size={18} className="animate-spin" /> : 'Esegui'}
                    </button>
                </div>
            </div>
        </div>
    )
}

function StatBox({ label, value, sub, color = 'slate' }: any) {
    const colors = {
        slate: 'text-slate-900 dark:text-white',
        emerald: 'text-emerald-600 dark:text-emerald-400'
    } as any
    
    return (
        <div className="bg-slate-50 dark:bg-white/5 p-6 rounded-2xl border border-slate-200/50 dark:border-white/10 flex flex-col items-center text-center gap-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-1">{label}</span>
            <span className={cn("text-4xl font-black tabular-nums", colors[color])}>{value}</span>
            {sub && <span className="text-[10px] font-bold text-slate-400">{sub}</span>}
        </div>
    )
}

function UploadHistory({ logs, loading, onDelete }: any) {
    const [query, setQuery] = useState('')

    if (loading && logs.length === 0) {
        return (
            <div className="mt-12 p-12 text-center flex flex-col items-center gap-3">
                <Loader2 className="animate-spin text-slate-300" size={24} />
                <span className="text-[13px] font-medium text-slate-400">Caricamento storico...</span>
            </div>
        )
    }

    const filtered = query.trim()
        ? logs.filter((l: any) => (l.archive_name || 'Importazione Manuale').toLowerCase().includes(query.trim().toLowerCase()))
        : logs

    const totalRecords = logs.reduce((s: number, l: any) => s + (l.processed_files || 0), 0)

    // Download a CSV of every import: archive name + record count + status + date.
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
        <div className="mt-12 space-y-5 pb-20">
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
                    {/* Total records summary */}
                    <div className="flex items-center gap-2 h-9 px-3.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 shrink-0">
                        <Database size={13} className="text-slate-400" />
                        <span className="text-[13px] font-bold text-slate-800 dark:text-white tabular-nums">{totalRecords.toLocaleString('it-IT')}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">record totali</span>
                    </div>

                    <div className="relative flex-1 sm:w-56">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Cerca archivio..."
                            className="w-full h-9 pl-9 pr-4 rounded-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[12px] text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-slate-300 dark:focus:border-white/20 transition-all"
                        />
                    </div>

                    <button
                        onClick={exportCsv}
                        disabled={logs.length === 0}
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
                                        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                                        log.status === 'completed' ? "bg-emerald-500/10 text-emerald-500" :
                                        log.status === 'error' ? "bg-rose-500/10 text-rose-500" : "bg-sky-500/10 text-sky-500"
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
                                            {log.status === 'processing' && (
                                                <span className="text-[11px] text-sky-500 font-bold animate-pulse truncate">{log.current_file}...</span>
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
                                Nessun caricamento corrisponde a “{query}”.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
