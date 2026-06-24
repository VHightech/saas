'use client'

import React, { createContext, useContext, useState, useRef } from 'react'

import { createClient } from '@/lib/supabase/client'

// ...
const supabase = createClient()

type UploadKind = 'bills' | 'users'

interface UploadResult {
    // Bills upload
    processed?: number
    newUsers?: number
    matchedByCif?: number
    matchedByCfpi?: number
    pdfsUploaded?: number
    pdfsSkipped?: number
    pdfsLinked?: number
    // Users upload
    imported?: number
    profiles?: number
    supplies?: { upserted: number; failed: number; total: number }
    skipped?: { contrattoAnnullato: number; noCif: number; shortCif: number }
    link?: Record<string, number> | null
    // Common
    errors?: string[]
}

interface AdminUploadContextType {
    isUploading: boolean
    progress: number
    status: string
    kind: UploadKind | null
    result: UploadResult | null
    error: string | null
    canRetry: boolean
    batchIndex: number
    batchTotal: number
    uploadFiles: (csv: File, archive: File, force?: boolean) => Promise<void>
    uploadBatch: (pairs: { csv: File; archive: File }[]) => Promise<void>
    uploadUsers: (file: File) => Promise<void>
    retryUpload: () => Promise<void>
    resetUpload: () => void
    dismissResult: () => void
}

/**
 * Raised when the upload request fails in a way that resuming will recover from
 * (connection dropped, proxy/timeout returning an HTML error page, etc.). The
 * server processes uploads idempotently, so re-sending with the same importId
 * picks up from the last checkpoint.
 */
class ResumableUploadError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'ResumableUploadError'
    }
}

const AdminUploadContext = createContext<AdminUploadContextType | undefined>(undefined)

export function AdminUploadProvider({ children }: { children: React.ReactNode }) {
    const [isUploading, setIsUploading] = useState(false)
    const [progress, setProgress] = useState(0)
    const [status, setStatus] = useState('')
    const [kind, setKind] = useState<UploadKind | null>(null)
    const [result, setResult] = useState<UploadResult | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [canRetry, setCanRetry] = useState(false)
    const [batchIndex, setBatchIndex] = useState(0)
    const [batchTotal, setBatchTotal] = useState(0)

    // Simulate progress timer ref
    const progressTimer = useRef<NodeJS.Timeout | null>(null)

    // Retained between attempts so "Riprova" can resume the SAME batch.
    const lastBillsUpload = useRef<{ csv: File; archive: File; force: boolean; importId: string } | null>(null)

    const resetUpload = () => {
        setIsUploading(false)
        setProgress(0)
        setStatus('')
        setResult(null)
        setError(null)
        setCanRetry(false)
        if (progressTimer.current) clearInterval(progressTimer.current)
    }

    const dismissResult = () => {
        setResult(null)
        setError(null)
        setCanRetry(false)
        lastBillsUpload.current = null
    }


    const generateUuidV4 = (): string => {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID()
        }
        if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
            const bytes = new Uint8Array(16)
            crypto.getRandomValues(bytes)
            bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
            bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 10
            const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
            return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
        }
        // Last-resort non-crypto fallback (good enough for batch ids, not for security).
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = (Math.random() * 16) | 0
            const v = c === 'x' ? r : (r & 0x3) | 0x8
            return v.toString(16)
        })
    }

    // Core bills-upload runner. `importId` is passed in (not generated here) so a
    // retry can reuse the SAME batch id and resume from the last checkpoint — the
    // server skips PDFs already on R2 and bills already linked.
    const runBillsUpload = async (csvFile: File, archiveFile: File, force: boolean, importId: string) => {
        console.log('[UploadProvider] Starting upload...', { csv: csvFile.name, archive: archiveFile.name, importId })
        resetUpload()
        setIsUploading(true)
        setKind('bills')
        setStatus('Preparazione file...')
        setProgress(0)

        // Remember this attempt so "Riprova" can resume the same batch.
        lastBillsUpload.current = { csv: csvFile, archive: archiveFile, force, importId }

        const formData = new FormData()
        formData.append('csv', csvFile)
        formData.append('archive', archiveFile)
        formData.append('importId', importId)

        // Start Polling
        const poller = setInterval(async () => {
            const { data, error } = await supabase
                .from('import_logs')
                .select('*')
                .eq('r2_path', importId)
                .maybeSingle()

            if (data && !error) {
                if (data.total_files > 0) {
                    const pct = Math.floor((data.processed_files / data.total_files) * 100)
                    setProgress(pct > 100 ? 100 : pct)
                }
                setStatus(`${data.current_file || 'Esecuzione...'} (${data.processed_files}/${data.total_files})`)
                console.log('[UploadProvider] Polling status:', data.status, data.processed_files)
            }
        }, 1000)

        progressTimer.current = poller

        try {
            console.log('[UploadProvider] Sending fetch request...')
            const res = await fetch(`/api/upload?force=${force}`, {
                method: 'POST',
                body: formData
            })

            console.log('[UploadProvider] Fetch response received:', res.status)

            // Stop Polling
            clearInterval(poller)

            // Robust parsing: on a dropped connection / proxy timeout the server
            // (or the tunnel) returns an HTML error page, not JSON. Reading text
            // first avoids the cryptic "Unexpected token '<'" and lets us show a
            // resume-friendly message instead.
            const rawBody = await res.text()
            let data: any = null
            try {
                data = rawBody ? JSON.parse(rawBody) : null
            } catch {
                data = null
            }

            if (!data) {
                throw new ResumableUploadError(
                    `Connessione interrotta durante l'upload (HTTP ${res.status}). I file già caricati sono al sicuro — clicca Riprova per riprendere da dove si era fermato.`
                )
            }

            if (!res.ok) throw new Error(data.error || 'Upload fallito')

            // Success
            setProgress(100)
            setStatus('Completato!')
            setResult(data)
            setCanRetry(false)
            lastBillsUpload.current = null
            console.log('[UploadProvider] Result set.')

        } catch (err: any) {
            console.error('[UploadProvider] Error:', err)
            if (progressTimer.current) clearInterval(progressTimer.current)
            // A bills upload is idempotent server-side, so any failure is safe to
            // resume — keep the batch around and offer "Riprova".
            setError(err?.message || 'Errore durante l\'upload')
            setStatus('Errore')
            setProgress(0)
            setCanRetry(true)
        } finally {
            setIsUploading(false)
            console.log('[UploadProvider] Upload process finished.')
        }
    }

    const uploadFiles = async (csvFile: File, archiveFile: File, force: boolean = false) => {
        // Fresh UUID per NEW upload — becomes the import_logs.id and R2 prefix.
        const importId = generateUuidV4()
        console.log('[UploadProvider] Batch ID:', importId)
        await runBillsUpload(csvFile, archiveFile, force, importId)
    }

    const retryUpload = async () => {
        const last = lastBillsUpload.current
        if (!last) {
            console.warn('[UploadProvider] retryUpload called with no previous batch to resume.')
            return
        }
        console.log('[UploadProvider] Resuming batch:', last.importId)
        await runBillsUpload(last.csv, last.archive, last.force, last.importId)
    }

    // Bulk: run several (csv, archive) pairs one after another. Each is its own
    // import (own importId / own R2 prefix) and uses the normal single-pair
    // pipeline; running sequentially keeps memory/timeouts safe.
    const uploadBatch = async (pairs: { csv: File; archive: File }[]) => {
        if (pairs.length === 0) return
        setBatchTotal(pairs.length)
        try {
            for (let i = 0; i < pairs.length; i++) {
                setBatchIndex(i + 1)
                const importId = generateUuidV4()
                await runBillsUpload(pairs[i].csv, pairs[i].archive, false, importId)
            }
        } finally {
            setBatchTotal(0)
            setBatchIndex(0)
        }
    }

    const uploadUsers = async (file: File) => {
        console.log('[UploadProvider] Starting users upload...', { file: file.name })
        resetUpload()
        setIsUploading(true)
        setKind('users')
        setStatus('Preparazione anagrafica...')
        setProgress(0)

        const importId = generateUuidV4()
        const formData = new FormData()
        formData.append('file', file)
        formData.append('importId', importId)

        const poller = setInterval(async () => {
            const { data, error } = await supabase
                .from('import_logs')
                .select('status, total_files, processed_files, current_file')
                .eq('r2_path', importId)
                .maybeSingle()
            if (data && !error) {
                if (data.total_files && data.total_files > 0) {
                    const pct = Math.min(100, Math.floor((data.processed_files / data.total_files) * 100))
                    setProgress(pct)
                }
                setStatus(`${data.current_file || 'Esecuzione...'} (${data.processed_files ?? 0}/${data.total_files ?? 0})`)
            }
        }, 1000)
        progressTimer.current = poller

        try {
            const res = await fetch('/api/upload-users', { method: 'POST', body: formData })
            clearInterval(poller)
            const rawBody = await res.text()
            let data: any = null
            try {
                data = rawBody ? JSON.parse(rawBody) : null
            } catch {
                data = null
            }
            if (!data) {
                throw new Error(`Connessione interrotta durante l'importazione (HTTP ${res.status}). Riprova.`)
            }
            if (!res.ok) throw new Error(data.error || 'Importazione anagrafica fallita')
            setProgress(100)
            setStatus('Completato!')
            setResult(data)
        } catch (err: any) {
            console.error('[UploadProvider] Users upload error:', err)
            clearInterval(poller)
            setError(err.message)
            setStatus('Errore')
            setProgress(0)
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <AdminUploadContext.Provider value={{
            isUploading,
            progress,
            status,
            kind,
            uploadUsers,
            result,
            error,
            canRetry,
            batchIndex,
            batchTotal,
            uploadFiles,
            uploadBatch,
            retryUpload,
            resetUpload,
            dismissResult
        }}>
            {children}
        </AdminUploadContext.Provider>
    )
}

export const useAdminUpload = () => {
    const context = useContext(AdminUploadContext)
    if (context === undefined) {
        throw new Error('useAdminUpload must be used within an AdminUploadProvider')
    }
    return context
}
