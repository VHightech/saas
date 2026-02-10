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

            {/* HERDER */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-100/50 dark:border-slate-700/50">
                <div>
                    <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500 dark:text-indigo-400 mb-2">Workspace Amministratore</h2>
                    <h1 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight">Centro Importazione</h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-2 text-lg max-w-2xl leading-relaxed">
                        Sincronizza il database caricando i flussi dati XML e l'archivio 7z delle fatture.
                        Il sistema gestirà automaticamente l'estrazione e l'associazione.
                    </p>
                </div>
            </div>



            {/* MAIN UPLOAD GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* LEFT CARD: CSV */}
                <div className={`relative group overflow-hidden rounded-3xl transition-all duration-300 border ${csvFile ? 'border-sky-500 ring-4 ring-sky-500/10 bg-white dark:bg-[#1e1e1e]' : 'border-slate-200 dark:border-[#333333] bg-white/70 dark:bg-[#1e1e1e]/50 backdrop-blur-xl hover:border-sky-400 dark:hover:border-sky-700 hover:shadow-xl hover:shadow-sky-500/5'}`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="p-10 flex flex-col h-full relative z-10">
                        <div className="flex items-start justify-between mb-8">
                            <div className={`p-4 rounded-2xl transition-all duration-300 ${csvFile ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/30 rotate-3' : 'bg-slate-100 dark:bg-[#2a2a2a] text-slate-400 group-hover:bg-sky-100 group-hover:text-sky-600 dark:group-hover:bg-sky-900/30 dark:group-hover:text-sky-400 group-hover:-rotate-3'}`}>
                                <Database size={32} strokeWidth={1.5} />
                            </div>
                            {csvFile && (
                                <span className="btn-glass btn-glass-sky !p-1 !px-3 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm">
                                    Pronto
                                </span>
                            )}
                        </div>

                        <div className="flex-1">
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2 tracking-tight">Flusso Dati</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed mb-6">
                                Carica il file <code className="bg-slate-200/50 dark:bg-[#2a2a2a] px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-200 font-bold">.csv</code> estratto dal gestionale.
                                <br />Include clienti, importi e scadenze.
                            </p>
                        </div>

                        <div className="flex items-center gap-2 relative">
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleCsvChange}
                                className="hidden"
                                id="csv-upload"
                            />
                            <label
                                htmlFor="csv-upload"
                                className={`w-full py-4 rounded-xl border-2 border-dashed flex items-center justify-center gap-3 cursor-pointer transition-all font-bold text-sm ${csvFile ? 'border-sky-200 bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:border-sky-800 dark:text-sky-400' : 'border-slate-200 dark:border-[#333333] text-slate-400 dark:text-slate-500 hover:border-sky-400 hover:bg-slate-200/50 hover:text-sky-600 dark:hover:text-sky-400 hover:shadow-sm'}`}
                            >
                                {csvFile ? (
                                    <>
                                        <FileText size={18} />
                                        {csvFile.name}
                                    </>
                                ) : (
                                    <>
                                        <UploadCloud size={18} />
                                        Seleziona CSV
                                    </>
                                )}
                            </label>
                            {csvFile && (
                                <button
                                    onClick={(e) => {
                                        e.preventDefault()
                                        setCsvFile(null)
                                    }}
                                    className="p-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 dark:bg-red-900/20 dark:border-red-500/30 dark:text-red-400 transition-colors shadow-sm flex-shrink-0"
                                    title="Rimuovi file"
                                >
                                    <X size={18} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT CARD: ARCHIVE */}
                <div className={`relative group overflow-hidden rounded-3xl transition-all duration-300 border ${archiveFile ? 'border-indigo-500 ring-4 ring-indigo-500/10 bg-white dark:bg-[#1e1e1e]' : 'border-slate-200 dark:border-[#333333] bg-white/70 dark:bg-[#1e1e1e]/50 backdrop-blur-xl hover:border-indigo-400 dark:hover:border-indigo-700 hover:shadow-xl hover:shadow-indigo-500/5'}`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="p-10 flex flex-col h-full relative z-10">
                        <div className="flex items-start justify-between mb-8">
                            <div className={`p-4 rounded-2xl transition-all duration-300 ${archiveFile ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 rotate-3' : 'bg-slate-100 dark:bg-[#2a2a2a] text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 dark:group-hover:bg-indigo-900/30 dark:group-hover:text-indigo-400 group-hover:-rotate-3'}`}>
                                <FileArchive size={32} strokeWidth={1.5} />
                            </div>
                            {archiveFile && (
                                <span className="btn-glass btn-glass-sky !p-1 !px-3 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm">
                                    Pronto
                                </span>
                            )}
                        </div>

                        <div className="flex-1">
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2 tracking-tight">Archivio Fatture</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed mb-6">
                                Trascina qui il file <code className="bg-slate-200/50 dark:bg-[#2a2a2a] px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-200 font-bold">.7z</code> contenente i PDF.
                                <br />Verrà estratto automaticamente.
                            </p>
                        </div>

                        <div className="flex items-center gap-2 relative">
                            <input
                                type="file"
                                accept=".7z"
                                onChange={handleArchiveChange}
                                className="hidden"
                                id="archive-upload"
                            />
                            <label
                                htmlFor="archive-upload"
                                className={`w-full py-4 rounded-xl border-2 border-dashed flex items-center justify-center gap-3 cursor-pointer transition-all font-bold text-sm ${archiveFile ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-400' : 'border-slate-200 dark:border-[#333333] text-slate-400 dark:text-slate-500 hover:border-indigo-400 hover:bg-slate-200/50 hover:text-indigo-600 dark:hover:text-indigo-400 hover:shadow-sm'}`}
                            >
                                {archiveFile ? (
                                    <>
                                        <FileArchive size={18} />
                                        {archiveFile.name}
                                    </>
                                ) : (
                                    <>
                                        <UploadCloud size={18} />
                                        Seleziona Archivio .7z
                                    </>
                                )}
                            </label>
                            {archiveFile && (
                                <button
                                    onClick={(e) => {
                                        e.preventDefault()
                                        setArchiveFile(null)
                                    }}
                                    className="p-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 dark:bg-red-900/20 dark:border-red-500/30 dark:text-red-400 transition-colors shadow-sm flex-shrink-0"
                                    title="Rimuovi file"
                                >
                                    <X size={18} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* USER UPLOAD CARD (FULL WIDTH OR NEW ROW) */}
                <UserUploadCard />

            </div>

            {/* ACTION SECTION */}
            <div className="flex justify-end pt-4">
                {(csvFile && archiveFile) && !isUploading && (
                    <button
                        onClick={handleAnalyze}
                        disabled={analyzing}
                        className={`group relative px-8 py-4 rounded-xl font-bold text-lg overflow-hidden transition-all ${analyzing ? 'bg-slate-100 text-slate-400 cursor-wait shadow-inner dark:bg-slate-800 dark:text-slate-500' : 'btn-glass btn-glass-emerald'}`}
                    >
                        <span className="relative z-10 flex items-center gap-3">
                            {analyzing ? (
                                <>
                                    <Loader2 size={24} className="animate-spin text-emerald-600 dark:text-emerald-500" />
                                    Analisi in corso...
                                </>
                            ) : (
                                <>
                                    Analizza Flusso
                                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </span>
                    </button>
                )}


            </div>

            {/* PREVIEW MODAL */}
            {showPreviewModal && previewStats && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1e1e1e] rounded-[2rem] shadow-2xl w-full max-w-2xl p-8 animate-in zoom-in-95 duration-300 border border-slate-100 dark:border-[#333333]">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-1">Riepilogo Importazione</h2>
                                <p className="text-slate-500 dark:text-slate-400 font-medium text-base">Controlla i dati analizzati prima di confermare.</p>
                            </div>
                            <button onClick={() => setShowPreviewModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-all hover:rotate-90">
                                <X size={24} className="text-slate-400" />
                            </button>
                        </div>

                        <div className="space-y-6 mb-8">
                            {previewStats.duplicateArchive && (
                                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30 flex gap-4">
                                    <AlertCircle className="shrink-0 text-amber-600 dark:text-amber-500" />
                                    <div>
                                        <h3 className="font-bold text-amber-800 dark:text-amber-400">Archivio già caricato</h3>
                                        <div className="text-sm text-amber-700 dark:text-amber-500 mt-1">
                                            Questo archivio Zip (<strong>{archiveFile?.name}</strong>) risulta già elaborato in precedenza ({previewStats.existingArchiveTotal} files).
                                            <br />
                                            Procedendo, <strong>verranno sovrascritti</strong> i file con lo stesso nome.
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TOP STATS ROW */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-slate-50 dark:bg-white/5 p-5 rounded-2xl border border-slate-100 dark:border-white/5 flex flex-col justify-center items-center text-center gap-1">
                                    <span className="font-bold text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-wider">Fatture nel CSV</span>
                                    <span className="text-3xl font-black text-slate-900 dark:text-white">{previewStats.processed}</span>
                                </div>

                                <div className="btn-glass btn-glass-emerald !p-5 rounded-2xl border-none shadow-none flex flex-col justify-center items-center text-center gap-1">
                                    <div className="text-[10px] uppercase font-black opacity-60">Utenti Identificati</div>
                                    <div className="text-3xl font-black">
                                        {previewStats.uniqueMatchedUsers || ((previewStats.matchedByCif || 0) + (previewStats.matchedByCfpi || 0))}
                                    </div>
                                    <div className="text-[9px] font-bold opacity-50">
                                        {previewStats.matchedByCif} CIF • {previewStats.matchedByCfpi} CFPI
                                    </div>
                                </div>
                            </div>

                            {/* ARCHIVE SECTION */}
                            <div className="p-6 rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 shadow-sm">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-indigo-50 text-indigo-500 rounded-lg">
                                            <FileArchive size={16} />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Analisi Archivio</div>
                                            <div className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 max-w-[200px] truncate" title={archiveFile?.name}>
                                                {archiveFile?.name}
                                            </div>
                                        </div>
                                    </div>

                                    {previewStats.previewPdfCount !== undefined && (
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300`}>
                                            {previewStats.previewPdfCount} PDF Totali
                                        </span>
                                    )}
                                </div>

                                {previewStats.previewPdfCount !== undefined && (
                                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-white/5">

                                        {/* COL 1: TO IMPORT */}
                                        <div className="text-center p-3 rounded-xl bg-sky-50 dark:bg-sky-900/10 border border-sky-100 dark:border-sky-800/30">
                                            <span className="block text-sky-600 dark:text-sky-400 font-bold uppercase text-[9px] mb-1">Documenti da Elaborare</span>
                                            <span className="block text-3xl font-black text-sky-600 dark:text-sky-400">
                                                {(previewStats.previewPdfMatches || 0) - (previewStats.previewAlreadyLinked || 0)}
                                            </span>

                                        </div>

                                        {/* COL 2: IGNORED */}
                                        <div className="text-center p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                                            <span className="block text-slate-400 dark:text-slate-500 font-bold uppercase text-[9px] mb-1">Ignorati (Già Presenti)</span>
                                            <span className="block text-3xl font-black text-slate-600 dark:text-slate-400">
                                                {previewStats.previewAlreadyLinked || 0}
                                            </span>

                                        </div>

                                        {/* COL 3: UNMATCHED */}
                                        <div className={`text-center p-3 rounded-xl border ${(previewStats.previewPdfCount - (previewStats.previewPdfMatches || 0)) > 0 ? 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800/30' : 'bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/5'}`}>
                                            <span className={`block font-bold uppercase text-[9px] mb-1 ${(previewStats.previewPdfCount - (previewStats.previewPdfMatches || 0)) > 0 ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'}`}>
                                                Non Riconosciuti
                                            </span>
                                            <span className={`block text-3xl font-black ${(previewStats.previewPdfCount - (previewStats.previewPdfMatches || 0)) > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
                                                {previewStats.previewPdfCount - (previewStats.previewPdfMatches || 0)}
                                            </span>

                                        </div>

                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => setShowPreviewModal(false)}
                                className="px-8 py-4 font-bold rounded-xl btn-glass btn-glass-neutral"
                            >
                                Annulla
                            </button>
                            <button
                                onClick={handleConfirmUpload}
                                className={`flex-1 py-4 font-bold rounded-xl shadow-xl ${previewStats.duplicateArchive ? 'btn-glass btn-glass-amber' : 'btn-glass btn-glass-emerald'}`}
                            >
                                {previewStats.duplicateArchive ? 'Conferma e Sovrascrivi' : 'Conferma e Avvia Importazione'}
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
        <div className="col-span-1 lg:col-span-2 mt-8">
            <div className={`relative group overflow-hidden rounded-3xl transition-all duration-300 border ${file ? 'border-violet-500 ring-4 ring-violet-500/10 bg-white dark:bg-[#1e1e1e]' : 'border-slate-200 dark:border-[#333333] bg-white/70 dark:bg-[#1e1e1e]/50 backdrop-blur-xl hover:border-violet-400 dark:hover:border-violet-700 hover:shadow-xl hover:shadow-violet-500/5'}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="p-8 flex flex-col md:flex-row items-center gap-8 relative z-10">
                    <div className="flex-1">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-xl">
                                <Users size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Anagrafica Utenti</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Carica massivamente i profili utenti (CSV).</p>
                            </div>
                        </div>


                    </div>

                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="flex items-center gap-2 flex-1 md:flex-none min-w-0">
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleFileChange}
                                className="hidden"
                                id="users-upload"
                            />
                            <label
                                htmlFor="users-upload"
                                className={`flex-1 cursor-pointer px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap overflow-hidden text-ellipsis
                                    ${file ? 'bg-violet-50/30 dark:bg-violet-500/10 border-2 border-dashed border-violet-400 dark:border-violet-500/40 text-violet-700 dark:text-violet-300' : 'btn-glass btn-glass-neutral'}`}
                            >
                                {file ? (
                                    <span className="truncate max-w-[200px]">{file.name}</span>
                                ) : (
                                    <>
                                        <UploadCloud size={16} />
                                        Scegli CSV
                                    </>
                                )}
                            </label>
                            {file && (
                                <button
                                    onClick={(e) => {
                                        e.preventDefault()
                                        setFile(null)
                                    }}
                                    className="p-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 dark:bg-red-900/20 dark:border-red-500/30 dark:text-red-400 transition-colors shadow-sm"
                                    title="Rimuovi file"
                                >
                                    <X size={18} />
                                </button>
                            )}
                        </div>

                        {file && !uploading && (
                            <button
                                onClick={handleUpload}
                                className="px-6 py-3 rounded-xl font-bold text-sm transition-colors shadow-lg btn-glass btn-glass-violet"
                            >
                                Carica
                            </button>
                        )}

                        {uploading && (
                            <div className="px-6 py-3 rounded-xl bg-slate-100 text-slate-400 font-bold text-sm flex items-center gap-2">
                                <Loader2 size={16} className="animate-spin" />
                                ...
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
