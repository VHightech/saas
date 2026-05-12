'use client'

import { useAdminUpload } from '@/components/providers/admin-upload-provider'
import { Loader2, CheckCircle2, AlertCircle, X, Users, Database } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

export function GlobalProgressBar() {
    const { isUploading, progress, status, kind, result, error, dismissResult } = useAdminUpload()

    if (!isUploading && !result && !error) return null

    const Icon = kind === 'users' ? Users : Database
    const labelKind = kind === 'users' ? 'Anagrafica' : 'Bollette'

    return (
        <AnimatePresence>
            <motion.div
                key="global-progress"
                initial={{ y: 24, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 24, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2"
            >
                {/* Close button (only when finished) */}
                {!isUploading && (
                    <button
                        onClick={dismissResult}
                        className="w-10 h-10 flex items-center justify-center bg-[#1A1F2A] dark:bg-white dark:text-[#1A1F2A] hover:bg-red-500/20 dark:hover:bg-red-500 hover:text-red-400 dark:hover:text-white text-white rounded-xl border border-white/10 dark:border-transparent transition-all group"
                        title="Chiudi notifica"
                    >
                        <X size={18} className="transition-transform group-hover:rotate-90" />
                    </button>
                )}

                {/* Main pill */}
                <div className="bg-[#1A1F2A] dark:bg-white text-white dark:text-[#1A1F2A] rounded-xl border border-white/10 dark:border-transparent flex items-stretch overflow-hidden divide-x divide-white/10 dark:divide-slate-200 h-10 min-w-[420px] max-w-[640px]">

                    {/* Left badge: kind + state */}
                    <div className="px-4 flex items-center gap-2 text-[12px] whitespace-nowrap">
                        {isUploading && <Loader2 size={14} className="animate-spin text-sky-400" />}
                        {result && !isUploading && <CheckCircle2 size={14} className="text-emerald-400" />}
                        {error && !isUploading && <AlertCircle size={14} className="text-red-400" />}
                        <Icon size={13} className="text-white/60 dark:text-[#1A1F2A]/50" />
                        <span className="text-white/60 dark:text-[#1A1F2A]/50 font-medium uppercase tracking-wider text-[9px]">
                            {labelKind}
                        </span>
                        <span className="text-white dark:text-[#1A1F2A] font-bold ml-1 bg-white/10 dark:bg-[#1A1F2A]/10 px-1.5 py-0.5 rounded text-[11px] min-w-[44px] text-center tabular-nums">
                            {isUploading ? `${Math.round(progress)}%` : (result ? 'OK' : 'ERR')}
                        </span>
                    </div>

                    {/* Center: progress bar / status / result */}
                    <div className="flex-1 px-4 flex items-center gap-3 min-w-0">
                        {isUploading ? (
                            <>
                                <div className="flex-1 h-1.5 bg-white/10 dark:bg-[#1A1F2A]/10 rounded-full overflow-hidden min-w-[140px]">
                                    <motion.div
                                        className="h-full bg-gradient-to-r from-sky-400 via-indigo-400 to-sky-400 bg-[length:200%_100%] rounded-full"
                                        initial={{ width: 0 }}
                                        animate={{
                                            width: `${progress}%`,
                                            backgroundPosition: ['0% 0%', '200% 0%']
                                        }}
                                        transition={{
                                            width: { duration: 0.4 },
                                            backgroundPosition: { duration: 3, repeat: Infinity, ease: 'linear' }
                                        }}
                                    />
                                </div>
                                <span className="text-[10px] font-medium text-white/70 dark:text-[#1A1F2A]/60 truncate max-w-[260px]">
                                    {status}
                                </span>
                            </>
                        ) : result ? (
                            <ResultSummary result={result} kind={kind} />
                        ) : (
                            <span className="text-[11px] font-medium text-red-300 dark:text-red-500 truncate">
                                {error}
                            </span>
                        )}
                    </div>

                    {/* Right: dismiss when error */}
                    {error && !isUploading && (
                        <button
                            onClick={dismissResult}
                            className="px-3 flex items-center text-[10px] uppercase font-bold tracking-wider hover:bg-white/5 dark:hover:bg-[#1A1F2A]/10 transition-colors text-white/70 dark:text-[#1A1F2A]/70"
                        >
                            Riprova
                        </button>
                    )}
                </div>
            </motion.div>
        </AnimatePresence>
    )
}

function ResultSummary({ result, kind }: { result: any; kind: 'users' | 'bills' | null }) {
    if (kind === 'users') {
        const linked = result?.link
            ? (result.link.linked_bills_by_cif ?? 0) + (result.link.linked_bills_by_codice ?? 0)
            : 0
        return (
            <div className="flex items-center gap-3 text-[11px] font-medium tabular-nums">
                <Stat label="Profili" value={result.profiles ?? result.imported ?? 0} />
                <Stat label="Forniture" value={result.supplies?.upserted ?? 0} />
                <Stat label="Bollette agganciate" value={linked} />
                {result.errors?.length > 0 && (
                    <Stat label="Errori" value={result.errors.length} tone="warn" />
                )}
            </div>
        )
    }
    // bills upload
    return (
        <div className="flex items-center gap-3 text-[11px] font-medium tabular-nums">
            <Stat label="Record" value={result.processed ?? 0} />
            <Stat label="Nuovi utenti" value={result.newUsers ?? 0} />
            <Stat label="PDF" value={result.pdfsLinked ?? result.pdfsUploaded ?? 0} />
            {result.errors?.length > 0 && <Stat label="Errori" value={result.errors.length} tone="warn" />}
        </div>
    )
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: 'warn' }) {
    return (
        <div className="flex items-center gap-1.5">
            <span className="text-white/50 dark:text-[#1A1F2A]/50 uppercase text-[9px] font-bold tracking-wider">{label}</span>
            <span className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-bold",
                tone === 'warn'
                    ? "bg-amber-500/20 text-amber-300 dark:text-amber-600"
                    : "bg-white/10 dark:bg-[#1A1F2A]/10"
            )}>
                {value}
            </span>
        </div>
    )
}
