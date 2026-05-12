'use client'

import { useState, useEffect } from 'react'
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
    History
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
    const [csvFile, setCsvFile] = useState<File | null>(null)
    const [archiveFile, setArchiveFile] = useState<File | null>(null)
    const [showPreviewModal, setShowPreviewModal] = useState(false)
    const [previewStats, setPreviewStats] = useState<UploadResult | null>(null)
    const [analyzing, setAnalyzing] = useState(false)
    const [role, setRole] = useState<string | null>(null)
    const [loadingRole, setLoadingRole] = useState(true)
    
    const [logs, setLogs] = useState<any[]>([])
    const [loadingLogs, setLoadingLogs] = useState(false)
    
    const { uploadFiles, isUploading } = useAdminUpload()
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
                .limit(20)
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

    const handleCsvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setCsvFile(e.target.files[0])
            setPreviewStats(null)
        }
    }

    const handleArchiveChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setArchiveFile(e.target.files[0])
            setPreviewStats(null)
        }
    }

    const validateFiles = () => {
        if (!csvFile || !archiveFile) return "Seleziona entrambi i file (CSV e Archivio 7z)."
        if (!csvFile.name.toLowerCase().startsWith('xml')) {
            return "Il file CSV del flusso dati deve iniziare con 'Xml'."
        }
        const csvDate = csvFile.name.match(/(\d{8})/)?.[1]
        const archiveDate = archiveFile.name.match(/(\d{8})/)?.[1]
        if (csvDate && archiveDate && csvDate !== archiveDate) {
            return `Le date dei file non corrispondono (CSV: ${csvDate}, Archivio: ${archiveDate}).`
        }
        return null
    }

    const handleAnalyze = async () => {
        const validationError = validateFiles()
        if (validationError) {
            toast.error(validationError)
            return
        }

        setAnalyzing(true)
        const formData = new FormData()
        if (csvFile) formData.append('csv', csvFile)
        if (archiveFile) formData.append('archive', archiveFile)

        try {
            const res = await fetch('/api/upload?preview=true', {
                method: 'POST',
                body: formData
            })
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
        if (!csvFile || !archiveFile) return
        setShowPreviewModal(false)
        const force = previewStats?.duplicateArchive || false
        uploadFiles(csvFile, archiveFile, force)
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

            <div className="h-full flex flex-col gap-6 px-6 py-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                
                {/* Main Content Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    
                    {/* CSV Upload Card */}
                    <UploadCard 
                        title="Flusso Dati CSV"
                        subtitle="Contiene clienti, fatturazioni e scadenze"
                        icon={<Database size={24} />}
                        file={csvFile}
                        onFileChange={handleCsvChange}
                        onClear={() => setCsvFile(null)}
                        accept=".csv"
                        color="sky"
                        description={<span>Trascina il file <code className="font-mono text-[11px] font-bold bg-sky-100 dark:bg-sky-500/20 px-1.5 py-0.5 rounded">.csv</code> esportato</span>}
                    />

                    {/* Archive Upload Card */}
                    <UploadCard 
                        title="Archivio Fatture"
                        subtitle="Documenti PDF in formato compresso"
                        icon={<FileArchive size={24} />}
                        file={archiveFile}
                        onFileChange={handleArchiveChange}
                        onClear={() => setArchiveFile(null)}
                        accept=".7z"
                        color="emerald"
                        description={<span>Seleziona l'archivio <code className="font-mono text-[11px] font-bold bg-emerald-100 dark:bg-emerald-500/20 px-1.5 py-0.5 rounded">.7z</code> con i PDF</span>}
                    />

                    {/* User Upload Card (Bottom Full Width) */}
                    <div className="xl:col-span-2">
                        <UserUploadCard />
                    </div>
                </div>

                {/* Floating Action Button */}
                {csvFile && archiveFile && !isUploading && (
                    <div className="fixed bottom-12 right-12 z-40 animate-in fade-in slide-in-from-bottom-8 duration-500">
                        <button
                            onClick={handleAnalyze}
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
                            ) : (
                                <>
                                    Avvia Analisi Flusso
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
                                    <span className="text-[11px] font-medium text-slate-400 font-mono">{archiveFile?.name}</span>
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

function UploadCard({ title, subtitle, icon, file, onFileChange, onClear, accept, color, description }: any) {
    const colors = {
        sky: 'text-sky-500 bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/20',
        emerald: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
        violet: 'text-violet-500 bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20',
    } as any

    return (
        <div className={cn(
            "relative group rounded-3xl border transition-all duration-300 p-8 flex flex-col gap-6",
            file 
                ? "bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/10 shadow-sm" 
                : "bg-white dark:bg-[#0F1115] border-dashed border-slate-300 dark:border-white/10 hover:border-slate-400 dark:hover:border-white/20"
        )}>
            <div className="flex items-start justify-between">
                <div className="flex gap-4">
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105", colors[color])}>
                        {icon}
                    </div>
                    <div>
                        <h3 className="text-[17px] font-bold text-slate-900 dark:text-white leading-tight">{title}</h3>
                        <p className="text-[12px] text-slate-500 font-medium mt-1">{subtitle}</p>
                    </div>
                </div>
                {file && (
                    <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 flex items-center gap-1">
                            <Check size={12} strokeWidth={3} /> Pronto
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                    </div>
                )}
            </div>

            <div className="flex-1 flex flex-col gap-4">
                <div className="text-[13px] text-slate-500 leading-relaxed">
                    {description}
                </div>

                <div className="relative">
                    <input type="file" accept={accept} onChange={onFileChange} className="hidden" id={`file-${color}`} />
                    <label 
                        htmlFor={`file-${color}`}
                        className={cn(
                            "flex items-center justify-center gap-3 w-full py-4 rounded-2xl border-2 border-dashed transition-all cursor-pointer font-bold text-[13px]",
                            file 
                                ? "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200" 
                                : "bg-transparent border-slate-200 dark:border-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-white/20"
                        )}
                    >
                        {file ? (
                            <>
                                <FileText size={18} />
                                <span className="truncate max-w-[200px]">{file.name}</span>
                            </>
                        ) : (
                            <>
                                <UploadCloud size={18} />
                                Scegli un file...
                            </>
                        )}
                    </label>
                    {file && (
                        <button 
                            onClick={onClear}
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
        <div className="bg-white dark:bg-white/[0.02] rounded-3xl border border-slate-200 dark:border-white/10 p-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-2xl bg-violet-500/10 text-violet-500 flex items-center justify-center">
                        <Users size={24} />
                    </div>
                    <div>
                        <h3 className="text-[17px] font-bold text-slate-900 dark:text-white leading-tight">Anagrafica Utenti</h3>
                        <p className="text-[12px] text-slate-500 font-medium mt-1">Sincronizzazione massiva profili clienti</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
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
                            "h-11 px-6 rounded-xl font-bold text-[13px] transition-all active:scale-95",
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
    if (loading && logs.length === 0) {
        return (
            <div className="mt-12 p-12 text-center flex flex-col items-center gap-3">
                <Loader2 className="animate-spin text-slate-300" size={24} />
                <span className="text-[13px] font-medium text-slate-400">Caricamento storico...</span>
            </div>
        )
    }

    return (
        <div className="mt-12 space-y-6 pb-20">
            <div className="flex items-center gap-3 px-2">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-600 dark:text-slate-400">
                    <History size={20} />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Storico Caricamenti</h2>
                    <p className="text-[11px] text-slate-500 font-medium">Ultime 20 importazioni eseguite</p>
                </div>
            </div>

            <div className="grid gap-4">
                {logs.map((log: any) => (
                    <div key={log.id} className="group bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 p-5 rounded-[2rem] flex items-center justify-between transition-all hover:border-slate-300 dark:hover:border-white/20">
                        <div className="flex items-center gap-5">
                            <div className={cn(
                                "w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm",
                                log.status === 'completed' ? "bg-emerald-500/10 text-emerald-500" : 
                                log.status === 'error' ? "bg-rose-500/10 text-rose-500" : "bg-sky-500/10 text-sky-500"
                            )}>
                                {log.status === 'completed' ? <Check size={20} strokeWidth={3} /> : 
                                 log.status === 'error' ? <AlertCircle size={20} /> : <Loader2 size={20} className="animate-spin" />}
                            </div>
                            <div>
                                <div className="flex items-center gap-3">
                                    <h4 className="font-bold text-slate-900 dark:text-white text-[15px]">{log.archive_name || 'Importazione Manuale'}</h4>
                                    <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-[9px] font-bold text-slate-500 font-mono tracking-tighter">
                                        {new Date(log.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 mt-1.5">
                                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                                        <Database size={12} className="text-slate-400" /> 
                                        <span className="text-slate-700 dark:text-slate-300 font-bold">{log.processed_files}</span>
                                        <span className="text-[10px] text-slate-400 uppercase tracking-tight">record</span>
                                    </div>
                                    {log.status === 'error' && (
                                        <span className="text-[11px] text-rose-500 font-bold bg-rose-500/5 px-2 py-0.5 rounded-lg border border-rose-500/10">{log.current_file}</span>
                                    )}
                                    {log.status === 'processing' && (
                                        <span className="text-[11px] text-sky-500 font-bold animate-pulse">{log.current_file}...</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                             <button 
                                onClick={() => onDelete(log.id)}
                                className="p-2.5 rounded-2xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                                title="Elimina questo import"
                             >
                                <Trash2 size={18} />
                             </button>
                        </div>
                    </div>
                ))}

                {logs.length === 0 && (
                    <div className="p-12 text-center rounded-[2rem] border border-dashed border-slate-200 dark:border-white/10">
                        <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-300 dark:text-slate-700 mx-auto mb-4">
                            <History size={24} />
                        </div>
                        <p className="text-slate-400 text-[13px] font-medium">Nessun caricamento registrato nel database.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
