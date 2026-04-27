'use client'

import React, { createContext, useContext, useState, useRef } from 'react'

import { createClient } from '@/lib/supabase/client'

// ...
const supabase = createClient()

interface UploadResult {
    processed: number
    newUsers: number
    matchedByCif?: number
    matchedByCfpi?: number
    pdfsUploaded: number
    pdfsSkipped: number
    pdfsLinked: number
    errors: string[]
}

interface AdminUploadContextType {
    isUploading: boolean
    progress: number
    status: string
    result: UploadResult | null
    error: string | null
    uploadFiles: (csv: File, archive: File, force?: boolean) => Promise<void>
    resetUpload: () => void
    dismissResult: () => void
}

const AdminUploadContext = createContext<AdminUploadContextType | undefined>(undefined)

export function AdminUploadProvider({ children }: { children: React.ReactNode }) {
    const [isUploading, setIsUploading] = useState(false)
    const [progress, setProgress] = useState(0)
    const [status, setStatus] = useState('')
    const [result, setResult] = useState<UploadResult | null>(null)
    const [error, setError] = useState<string | null>(null)

    // Simulate progress timer ref
    const progressTimer = useRef<NodeJS.Timeout | null>(null)

    const resetUpload = () => {
        setIsUploading(false)
        setProgress(0)
        setStatus('')
        setResult(null)
        setError(null)
        if (progressTimer.current) clearInterval(progressTimer.current)
    }

    const dismissResult = () => {
        setResult(null)
        setError(null)
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

    const uploadFiles = async (csvFile: File, archiveFile: File, force: boolean = false) => {
        console.log('[UploadProvider] Starting upload...', { csv: csvFile.name, archive: archiveFile.name })
        resetUpload()
        setIsUploading(true)
        setStatus('Preparazione file...')
        setProgress(0)

        // Fresh UUID per upload — becomes the import_logs.id and the R2 object prefix.
        const importId = generateUuidV4()
        console.log('[UploadProvider] Batch ID:', importId)

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
                // Calculate %?
                // If total_files is 0, just show spinner or something.
                if (data.total_files > 0) {
                    const pct = Math.floor((data.processed_files / data.total_files) * 100)
                    setProgress(pct > 100 ? 100 : pct)
                }
                setStatus(`${data.current_file || 'Esecuzione...'} (${data.processed_files}/${data.total_files})`)
                console.log('[UploadProvider] Polling status:', data.status, data.processed_files)

                if (data.status === 'completed' || data.status === 'error') {
                    // Stop polling if done (though the fetch below handles the final result)
                    // clearInterval(poller)
                }
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
            const data = await res.json()
            console.log('[UploadProvider] Data parsed:', data)

            // Stop Polling
            clearInterval(poller)

            if (!res.ok) throw new Error(data.error || 'Upload fallito')

            // Success logic
            setProgress(100)
            setStatus('Completato!')
            setResult(data)
            console.log('[UploadProvider] Result set.')

        } catch (err: any) {
            console.error('[UploadProvider] Error:', err)
            if (progressTimer.current) clearInterval(progressTimer.current)
            setError(err.message)
            setStatus('Errore')
            setProgress(0)
        } finally {
            setIsUploading(false)
            console.log('[UploadProvider] Upload process finished.')
        }
    }

    return (
        <AdminUploadContext.Provider value={{
            isUploading,
            progress,
            status,
            result,
            error,
            uploadFiles,
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
