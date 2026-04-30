'use client'

import { useState } from 'react'
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2, FileArchive, ArrowRight, Database, X, Users } from 'lucide-react'
import { useAdminUpload } from '@/components/providers/admin-upload-provider'
import { toast } from 'sonner'

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
    previewPdfCount?: number // New
    previewPdfMatches?: number // New
    previewAlreadyLinked?: number // New
    uniqueMatchedUsers?: number // New
    duplicateArchive?: boolean // New
    existingArchiveTotal?: number // New
    overwriteWarning?: boolean // New
}
export default function AdminDashboardPage() {
    const [csvFile, setCsvFile] = useState<File | null>(null)
    const [archiveFile, setArchiveFile] = useState<File | null>(null)
    const [showPreviewModal, setShowPreviewModal] = useState(false)
    const [previewStats, setPreviewStats] = useState<UploadResult | null>(null)
    const [analyzing, setAnalyzing] = useState(false) // New State

    // Global Context for background upload
    const { uploadFiles, isUploading } = useAdminUpload()

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

        // CSV Validation (Flusso Dati)
        if (!csvFile.name.toLowerCase().startsWith('xml')) {
            return "Il file CSV del flusso dati deve iniziare con 'Xml'."
        }

        // Archive Validation - REMOVED as per request (any name allowed for .7z)

        // Optional: Match dates if both have them
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

        // Check for duplicate archive warning
        const force = previewStats?.duplicateArchive || false

        // Trigger global upload (runs in background via Context)
        uploadFiles(csvFile, archiveFile, force)
    }

    return (
        <div className="h-full flex flex-col space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out max-w-[1600px] mx-auto w-full p-4 md:p-8 relative">

            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/40 dark:bg-black/20 backdrop-blur-3xl p-8 rounded-[2.5rem] border border-white/20 dark:border-white/10 flex-shrink-0 shadow-xl shadow-slate-200/20 dark:shadow-none animate-in fade-in slide-in-from-top-4 duration-1000">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                        <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                            Centro Importazione
                        </h1>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm font-bold ml-5">Sincronizzazione database flussi XML e archivi fatture</p>
                </div>

                <div className="hidden lg:flex items-center gap-4">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20">
                        <Database size={16} className="text-indigo-600 dark:text-indigo-400" />
                        <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">Storage R2 Attivo</span>
                    </div>
                </div>
            </div>



            {/* MAIN UPLOAD GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* LEFT CARD: CSV */}
                <div className={`relative group overflow-hidden rounded-[2.5rem] transition-all duration-500 border-2 ${csvFile ? 'border-sky-500/50 bg-white/60 dark:bg-sky-500/10' : 'border-white/20 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur-3xl hover:border-sky-400/50 hover:shadow-2xl hover:shadow-sky-500/10'}`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    
                    <div className="p-10 flex flex-col h-full relative z-10">
                        <div className="flex items-start justify-between mb-10">
                            <div className={`p-5 rounded-3xl transition-all duration-500 ${csvFile ? 'bg-sky-500 text-white shadow-2xl shadow-sky-500/40 scale-110 rotate-6' : 'bg-white/50 dark:bg-white/5 text-slate-400 group-hover:bg-sky-500 group-hover:text-white group-hover:shadow-xl group-hover:shadow-sky-500/30'}`}>
                                <Database size={32} strokeWidth={1.5} />
                            </div>
                            {csvFile && (
                                <div className="flex flex-col items-end gap-2">
                                    <span className="px-4 py-1.5 rounded-full bg-sky-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-sky-500/20">
                                        File Caricato
                                    </span>
                                    <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 tabular-nums">
                                        {(csvFile.size / 1024).toFixed(1)} KB
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 mb-8">
                            <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-3 tracking-tight">Flusso Dati</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-bold leading-relaxed">
                                Trascina qui il file <code className="bg-sky-100 dark:bg-sky-500/20 px-2 py-0.5 rounded-lg text-sky-700 dark:text-sky-300 font-black">.csv</code> esportato.
                                <br /><span className="opacity-60">Contiene clienti, fatturazioni e scadenze.</span>
                            </p>
                        </div>

                        <div className="flex items-center gap-3 relative">
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleCsvChange}
                                className="hidden"
                                id="csv-upload"
                            />
                            <label
                                htmlFor="csv-upload"
                                className={`flex-1 py-5 rounded-2xl border-2 border-dashed flex items-center justify-center gap-3 cursor-pointer transition-all duration-500 font-black text-sm ${csvFile ? 'border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-400' : 'border-slate-200 dark:border-white/10 text-slate-400 hover:border-sky-500 hover:text-sky-600 dark:hover:text-sky-400'}`}
                            >
                                {csvFile ? (
                                    <>
                                        <FileText size={20} className="animate-bounce" />
                                        <span className="truncate max-w-[180px]">{csvFile.name}</span>
                                    </>
                                ) : (
                                    <>
                                        <UploadCloud size={20} />
                                        Seleziona CSV
                                    </>
                                )}
                            </label>
                            {csvFile && (
                                <button
                                    onClick={(e) => { e.preventDefault(); setCsvFile(null); }}
                                    className="p-5 rounded-2xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 transition-all duration-300 shadow-lg shadow-red-500/5 group/btn"
                                    title="Rimuovi file"
                                >
                                    <X size={20} className="group-hover/btn:rotate-90 transition-transform" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT CARD: ARCHIVE */}
                <div className={`relative group overflow-hidden rounded-[2.5rem] transition-all duration-500 border-2 ${archiveFile ? 'border-indigo-500/50 bg-white/60 dark:bg-indigo-500/10' : 'border-white/20 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur-3xl hover:border-indigo-400/50 hover:shadow-2xl hover:shadow-indigo-500/10'}`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    
                    <div className="p-10 flex flex-col h-full relative z-10">
                        <div className="flex items-start justify-between mb-10">
                            <div className={`p-5 rounded-3xl transition-all duration-500 ${archiveFile ? 'bg-indigo-500 text-white shadow-2xl shadow-indigo-500/40 scale-110 rotate-6' : 'bg-white/50 dark:bg-white/5 text-slate-400 group-hover:bg-indigo-500 group-hover:text-white group-hover:shadow-xl group-hover:shadow-indigo-500/30'}`}>
                                <FileArchive size={32} strokeWidth={1.5} />
                            </div>
                            {archiveFile && (
                                <div className="flex flex-col items-end gap-2">
                                    <span className="px-4 py-1.5 rounded-full bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20">
                                        Archivio Caricato
                                    </span>
                                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                                        {(archiveFile.size / (1024 * 1024)).toFixed(1)} MB
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 mb-8">
                            <h3 className="text-3xl font-black text-slate-800 dark:text-white mb-3 tracking-tight">Archivio Fatture</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-bold leading-relaxed">
                                Seleziona l'archivio <code className="bg-indigo-100 dark:bg-indigo-500/20 px-2 py-0.5 rounded-lg text-indigo-700 dark:text-indigo-300 font-black">.7z</code> con i PDF.
                                <br /><span className="opacity-60">Il sistema estrarrà e collegherà i documenti.</span>
                            </p>
                        </div>

                        <div className="flex items-center gap-3 relative">
                            <input
                                type="file"
                                accept=".7z"
                                onChange={handleArchiveChange}
                                className="hidden"
                                id="archive-upload"
                            />
                            <label
                                htmlFor="archive-upload"
                                className={`flex-1 py-5 rounded-2xl border-2 border-dashed flex items-center justify-center gap-3 cursor-pointer transition-all duration-500 font-black text-sm ${archiveFile ? 'border-indigo-500/30 bg-indigo-500/5 text-indigo-700 dark:text-indigo-400' : 'border-slate-200 dark:border-white/10 text-slate-400 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400'}`}
                            >
                                {archiveFile ? (
                                    <>
                                        <FileArchive size={20} className="animate-bounce" />
                                        <span className="truncate max-w-[180px]">{archiveFile.name}</span>
                                    </>
                                ) : (
                                    <>
                                        <UploadCloud size={20} />
                                        Seleziona Archivio .7z
                                    </>
                                )}
                            </label>
                            {archiveFile && (
                                <button
                                    onClick={(e) => { e.preventDefault(); setArchiveFile(null); }}
                                    className="p-5 rounded-2xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 transition-all duration-300 shadow-lg shadow-red-500/5 group/btn"
                                    title="Rimuovi file"
                                >
                                    <X size={20} className="group-hover/btn:rotate-90 transition-transform" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* USER UPLOAD CARD (FULL WIDTH OR NEW ROW) */}
                <UserUploadCard />

            </div>

            {/* ACTION SECTION */}
            <div className="flex justify-center md:justify-end pt-12">
                {(csvFile && archiveFile) && !isUploading && (
                    <button
                        onClick={handleAnalyze}
                        disabled={analyzing}
                        className={`group relative px-12 py-5 rounded-[2rem] font-black text-xl overflow-hidden transition-all duration-500 shadow-2xl ${analyzing ? 'bg-slate-100 text-slate-400 cursor-wait dark:bg-slate-800' : 'btn-glass btn-glass-emerald scale-105 hover:scale-110 active:scale-95 shadow-emerald-500/20'}`}
                    >
                        <span className="relative z-10 flex items-center gap-4">
                            {analyzing ? (
                                <>
                                    <Loader2 size={24} className="animate-spin text-emerald-600 dark:text-emerald-500" />
                                    Analisi in corso...
                                </>
                            ) : (
                                <>
                                    Avvia Analisi Flusso
                                    <ArrowRight size={24} className="group-hover:translate-x-2 transition-transform duration-500" />
                                </>
                            )}
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    </button>
                )}
            </div>

            {/* PREVIEW MODAL */}
            {showPreviewModal && previewStats && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 overflow-y-auto">
                    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-500" onClick={() => setShowPreviewModal(false)} />
                    
                    <div className="relative bg-white/70 dark:bg-black/40 backdrop-blur-3xl rounded-[3rem] shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-700 border border-white/40 dark:border-white/10">
                        {/* Modal Header */}
                        <div className="p-10 pb-0 flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
                                        <Database size={24} />
                                    </div>
                                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Riepilogo Dati</h2>
                                </div>
                                <p className="text-slate-500 dark:text-slate-400 font-bold ml-1">Verifica i risultati dell'analisi prima di procedere.</p>
                            </div>
                            <button onClick={() => setShowPreviewModal(false)} className="p-3 bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 rounded-2xl transition-all hover:rotate-90 border border-white/20 dark:border-white/10">
                                <X size={24} className="text-slate-400" />
                            </button>
                        </div>

                        <div className="p-10 space-y-8">
                            {previewStats.duplicateArchive && (
                                <div className="p-6 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex gap-5 animate-pulse">
                                    <div className="p-3 bg-amber-500 text-white rounded-2xl h-fit shadow-lg shadow-amber-500/20">
                                        <AlertCircle size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-amber-800 dark:text-amber-400 text-lg">Archivio già presente</h3>
                                        <p className="text-sm text-amber-700 dark:text-amber-500/80 font-bold mt-1 leading-relaxed">
                                            Il file <span className="underline decoration-2">{archiveFile?.name}</span> è già stato elaborato. 
                                            Procedendo ora, i file esistenti verranno <span className="text-amber-600 dark:text-amber-300">sovrascritti</span>.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* TOP STATS ROW */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white/50 dark:bg-white/5 p-8 rounded-[2rem] border border-white/40 dark:border-white/5 flex flex-col items-center text-center gap-2 group transition-all hover:bg-white/80 dark:hover:bg-white/10">
                                    <span className="font-black text-slate-400 dark:text-slate-500 text-[11px] uppercase tracking-[0.2em]">Record nel CSV</span>
                                    <span className="text-5xl font-black text-slate-900 dark:text-white tabular-nums group-hover:scale-110 transition-transform duration-500">
                                        {previewStats.processed}
                                    </span>
                                    <div className="px-3 py-1 rounded-full bg-slate-100 dark:bg-white/5 text-[10px] font-bold text-slate-500">Pronti all'elaborazione</div>
                                </div>

                                <div className="bg-emerald-500/10 dark:bg-emerald-500/20 p-8 rounded-[2rem] border border-emerald-500/20 flex flex-col items-center text-center gap-2 group transition-all">
                                    <span className="font-black text-emerald-600 dark:text-emerald-400 text-[11px] uppercase tracking-[0.2em]">Clienti Rilevati</span>
                                    <span className="text-5xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums group-hover:scale-110 transition-transform duration-500">
                                        {previewStats.uniqueMatchedUsers || ((previewStats.matchedByCif || 0) + (previewStats.matchedByCfpi || 0))}
                                    </span>
                                    <div className="flex gap-2">
                                        <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter">
                                            {previewStats.matchedByCif} CIF
                                        </span>
                                        <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter">
                                            {previewStats.matchedByCfpi} CFPI
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* ARCHIVE SECTION */}
                            <div className="p-8 rounded-[2.5rem] border border-white/40 dark:border-white/10 bg-white/40 dark:bg-white/5 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-150 transition-transform duration-1000">
                                    <FileArchive size={120} />
                                </div>

                                <div className="flex justify-between items-center mb-8 relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-indigo-500 text-white rounded-2xl shadow-lg shadow-indigo-500/20">
                                            <FileArchive size={20} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Analisi Contenuto</div>
                                            <div className="font-black text-sm text-slate-800 dark:text-slate-200 truncate max-w-[250px]">
                                                {archiveFile?.name}
                                            </div>
                                        </div>
                                    </div>

                                    {previewStats.previewPdfCount !== undefined && (
                                        <div className="flex flex-col items-end">
                                            <span className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                                                {previewStats.previewPdfCount}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Documenti PDF</span>
                                        </div>
                                    )}
                                </div>

                                {previewStats.previewPdfCount !== undefined && (
                                    <div className="grid grid-cols-3 gap-6 pt-6 border-t border-white/20 dark:border-white/5 relative z-10">
                                        <div className="text-center group/item">
                                            <span className="block text-[10px] font-black text-sky-500 dark:text-sky-400 uppercase tracking-widest mb-2">Da Importare</span>
                                            <span className="text-3xl font-black text-sky-600 dark:text-sky-400 tabular-nums group-hover/item:scale-110 transition-transform">
                                                {(previewStats.previewPdfMatches || 0) - (previewStats.previewAlreadyLinked || 0)}
                                            </span>
                                        </div>

                                        <div className="text-center group/item border-x border-white/20 dark:border-white/5">
                                            <span className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Già Presenti</span>
                                            <span className="text-3xl font-black text-slate-600 dark:text-slate-400 tabular-nums group-hover/item:scale-110 transition-transform">
                                                {previewStats.previewAlreadyLinked || 0}
                                            </span>
                                        </div>

                                        <div className="text-center group/item">
                                            <span className={`block text-[10px] font-black uppercase tracking-widest mb-2 ${(previewStats.previewPdfCount - (previewStats.previewPdfMatches || 0)) > 0 ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'}`}>
                                                Non Trovati
                                            </span>
                                            <span className={`text-3xl font-black tabular-nums group-hover/item:scale-110 transition-transform ${(previewStats.previewPdfCount - (previewStats.previewPdfMatches || 0)) > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
                                                {previewStats.previewPdfCount - (previewStats.previewPdfMatches || 0)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer Actions */}
                        <div className="p-10 pt-0 flex flex-col sm:flex-row gap-4">
                            <button
                                onClick={() => setShowPreviewModal(false)}
                                className="flex-1 px-8 py-5 font-black rounded-2xl btn-glass btn-glass-neutral text-base"
                            >
                                Annulla
                            </button>
                            <button
                                onClick={handleConfirmUpload}
                                className={`flex-[2] py-5 font-black rounded-2xl shadow-2xl transition-all duration-500 text-base scale-100 hover:scale-[1.02] active:scale-95 ${previewStats.duplicateArchive ? 'btn-glass btn-glass-amber shadow-amber-500/20' : 'btn-glass btn-glass-emerald shadow-emerald-500/20'}`}
                            >
                                {previewStats.duplicateArchive ? 'Sovrascrivi e Continua' : 'Conferma e Avvia Importazione'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SUCCESS MODAL REMOVED - Handled Globally */}



        </div>
    )
}

function UserUploadCard() {
    const [file, setFile] = useState<File | null>(null)
    const [uploading, setUploading] = useState(false)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0]
            // Validation: Must start with 'contratti'
            if (!selectedFile.name.toLowerCase().startsWith('contratti')) {
                toast.error("Il file anagrafica deve iniziare con 'contratti'.")
                setFile(null)
                // - [x] Perform Security Audit <!-- id: 21 -->
                // - [x] Review Middleware and Auth Checks <!-- id: 22 -->
                // - [x] Verify RLS (Row Level Security) on DB <!-- id: 23 -->
                // - [x] Identify areas for improvement (CSP, Rate limiting) <!-- id: 24 -->
                return
            }

            setFile(selectedFile)
        }
    }

    const handleUpload = async () => {
        if (!file) return
        setUploading(true)

        const formData = new FormData()
        formData.append('file', file)

        try {
            const res = await fetch('/api/upload-users', {
                method: 'POST',
                body: formData
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Errore caricamento utenti')

            toast.success(`Importazione completata: ${data.imported} importati, ${data.errorCount} errori`)
            setFile(null)
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="col-span-1 lg:col-span-2 mt-12">
            <div className={`relative group overflow-hidden rounded-[2.5rem] transition-all duration-500 border-2 ${file ? 'border-violet-500/50 bg-white/60 dark:bg-violet-500/10' : 'border-white/20 dark:border-white/10 bg-white/40 dark:bg-black/20 backdrop-blur-3xl hover:border-violet-400/50 hover:shadow-2xl hover:shadow-violet-500/10'}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="p-10 flex flex-col md:flex-row items-center gap-10 relative z-10">
                    <div className="flex-1 text-center md:text-left">
                        <div className="flex flex-col md:flex-row items-center gap-5 mb-2">
                            <div className="p-4 bg-violet-500 text-white rounded-2xl shadow-xl shadow-violet-500/20 rotate-3 group-hover:rotate-6 transition-transform duration-500">
                                <Users size={28} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Anagrafica Utenti</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm font-bold opacity-80 mt-1">Sincronizzazione massiva profili clienti</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleFileChange}
                                className="hidden"
                                id="users-upload"
                            />
                            <label
                                htmlFor="users-upload"
                                className={`flex-1 sm:flex-none px-8 py-4 rounded-2xl font-black text-sm transition-all duration-500 flex items-center justify-center gap-3 whitespace-nowrap min-w-[200px]
                                    ${file ? 'bg-violet-500/10 border-2 border-dashed border-violet-500/30 text-violet-700 dark:text-violet-300' : 'btn-glass btn-glass-neutral'}`}
                            >
                                {file ? (
                                    <span className="truncate max-w-[150px]">{file.name}</span>
                                ) : (
                                    <>
                                        <UploadCloud size={18} />
                                        Scegli CSV Clienti
                                    </>
                                )}
                            </label>
                            {file && (
                                <button
                                    onClick={(e) => { e.preventDefault(); setFile(null); }}
                                    className="p-4 rounded-2xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 transition-all duration-300 shadow-lg shadow-red-500/5 group/btn"
                                    title="Rimuovi file"
                                >
                                    <X size={20} className="group-hover/btn:rotate-90 transition-transform" />
                                </button>
                            )}
                        </div>

                        {file && !uploading && (
                            <button
                                onClick={handleUpload}
                                className="w-full sm:w-auto px-10 py-4 rounded-2xl font-black text-sm shadow-2xl btn-glass btn-glass-violet scale-105 hover:scale-110 active:scale-95 shadow-violet-500/20"
                            >
                                Esegui Importazione
                            </button>
                        )}

                        {uploading && (
                            <div className="px-10 py-4 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-400 font-black text-sm flex items-center gap-3 animate-pulse">
                                <Loader2 size={18} className="animate-spin" />
                                Elaborazione...
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
