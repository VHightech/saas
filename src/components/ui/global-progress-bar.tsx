'use client'

import { useAdminUpload } from '@/components/providers/admin-upload-provider'
import { Loader2, CheckCircle2, AlertCircle, X, Maximize2, Minimize2 } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export function GlobalProgressBar() {
    const { isUploading, progress, status, result, error, dismissResult } = useAdminUpload()
    const [isMinimized, setIsMinimized] = useState(false)

    // Only show if active or has result
    if (!isUploading && !result && !error) return null

    return (
        <AnimatePresence>
            <motion.div
                layout
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-6 right-6 z-50 w-full max-w-md"
            >
                <div className="bg-white/80 dark:bg-[#1e1e1e]/80 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/50 dark:border-[#333333] overflow-hidden">

                    {/* Header */}
                    <div className="bg-slate-900 dark:bg-black/40 px-5 py-3.5 flex items-center justify-between border-b border-white/10">
                        <div className="flex items-center gap-2.5">
                            {isUploading && <Loader2 size={16} className="animate-spin text-sky-400" />}
                            {result && <CheckCircle2 size={18} className="text-emerald-400" />}
                            {error && <AlertCircle size={18} className="text-red-400" />}

                            <span className="font-black text-xs uppercase tracking-widest text-white/90">
                                {isUploading ? 'Importazione in corso' : (result ? 'Completato' : 'Errore')}
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            {isUploading && (
                                <button
                                    onClick={() => setIsMinimized(!isMinimized)}
                                    className="p-1.5 hover:bg-white/10 rounded-lg transition-all"
                                >
                                    {isMinimized ? <Maximize2 size={16} className="text-white/60" /> : <Minimize2 size={16} className="text-white/60" />}
                                </button>
                            )}
                            {!isUploading && !isMinimized && (
                                <button onClick={dismissResult} className="p-1.5 hover:bg-white/10 rounded-lg transition-all hover:rotate-90">
                                    <X size={16} className="text-white/60" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Content */}
                    {!isMinimized && (
                        <div className="p-5">
                            {isUploading ? (
                                <div className="space-y-4">
                                    <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                        <span>{status}</span>
                                        <span className="text-sky-500">{Math.round(progress)}%</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden p-0.5 border border-slate-200/50 dark:border-white/5">
                                        <motion.div
                                            className="h-full bg-gradient-to-r from-sky-500 via-indigo-500 to-sky-500 bg-[length:200%_100%] rounded-full shadow-lg shadow-sky-500/20"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${progress}%`, backgroundPosition: ['0% 0%', '200% 0%'] }}
                                            transition={{ width: { duration: 0.5 }, backgroundPosition: { duration: 3, repeat: Infinity, ease: "linear" } }}
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 text-center font-medium">
                                        Puoi navigare liberamente. Ti avviseremo al termine.
                                    </p>
                                </div>
                            ) : result ? (
                                <div className="space-y-5">
                                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                                        I dati sono stati elaborati correttamente.
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="btn-glass btn-glass-emerald !p-3 rounded-xl border-none shadow-none flex flex-col items-center">
                                            <div className="text-2xl font-black">{result.processed}</div>
                                            <div className="text-[9px] uppercase font-black opacity-60 tracking-wider">Fatture</div>
                                        </div>
                                        <div className="btn-glass btn-glass-sky !p-3 rounded-xl border-none shadow-none flex flex-col items-center">
                                            <div className="text-2xl font-black">{result.newUsers}</div>
                                            <div className="text-[9px] uppercase font-black opacity-60 tracking-wider">Nuovi Utenti</div>
                                        </div>
                                    </div>

                                    {result.errors && result.errors.length > 0 && (
                                        <div className="text-[10px] btn-glass btn-glass-amber !p-2 rounded-lg border-none shadow-none flex items-center justify-center gap-2 font-black uppercase tracking-widest">
                                            <AlertCircle size={14} strokeWidth={3} />
                                            {result.errors.length} Segnalazioni da Verificare
                                        </div>
                                    )}

                                    <button
                                        onClick={dismissResult}
                                        className="w-full py-2.5 font-black text-[10px] uppercase tracking-[0.2em] rounded-xl btn-glass btn-glass-neutral transition-all"
                                    >
                                        Chiudi Notifica
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 text-red-500">
                                        <AlertCircle size={20} />
                                        <p className="text-sm font-black uppercase tracking-wider">
                                            Caricamento Fallito
                                        </p>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 bg-red-500/5 p-3 rounded-xl border border-red-500/10 break-words font-medium">
                                        {error}
                                    </p>
                                    <button
                                        onClick={dismissResult}
                                        className="w-full py-2.5 font-black text-[10px] uppercase tracking-[0.2em] rounded-xl btn-glass btn-glass-neutral transition-all"
                                    >
                                        Riprova
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    )
}
