'use client'

/**
 * Upload zone — drag-and-drop PDF/ZIP with progress.
 * Drop into src/components/admin/UploadZone.tsx
 * Wire to /api/upload or existing BulkUploader.tsx.
 */

import * as React from 'react'
import { Upload, FileCheck2, AlertCircle, Loader2 } from 'lucide-react'

export interface UploadZoneProps {
    accept?: string
    onUpload: (file: File) => Promise<void>
}

export function UploadZone({ accept = '.pdf,.zip,.7z', onUpload }: UploadZoneProps) {
    const [drag, setDrag] = React.useState(false)
    const [state, setState] = React.useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
    const [error, setError] = React.useState<string | null>(null)

    const handle = async (file: File) => {
        setState('uploading')
        setError(null)
        try {
            await onUpload(file)
            setState('done')
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Upload fallito')
            setState('error')
        }
    }

    return (
        <label
            onDragOver={e => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => {
                e.preventDefault(); setDrag(false)
                const f = e.dataTransfer.files?.[0]
                if (f) handle(f)
            }}
            className={`block rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition ${drag
                ? 'border-[var(--acq-blue)] bg-[var(--acq-blue)]/5'
                : 'border-[var(--acq-ink-soft)] bg-[var(--acq-surface)] hover:border-[var(--acq-ink-sub)]'}`}>
            <input type="file" accept={accept} className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handle(f) }} />

            {state === 'idle' && (
                <>
                    <div className="w-12 h-12 rounded-xl bg-[var(--acq-ink-soft)] grid place-items-center mx-auto mb-3">
                        <Upload className="w-5 h-5 text-[var(--acq-ink-sub)]" />
                    </div>
                    <div className="text-sm font-semibold text-[var(--acq-ink)]">Trascina PDF / ZIP qui</div>
                    <div className="text-xs text-[var(--acq-ink-sub)] mt-1">oppure clicca per selezionare</div>
                </>
            )}
            {state === 'uploading' && (
                <>
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--acq-blue)] mx-auto mb-3" />
                    <div className="text-sm font-semibold text-[var(--acq-ink)]">Caricamento in corso…</div>
                </>
            )}
            {state === 'done' && (
                <>
                    <div className="w-12 h-12 rounded-xl bg-[var(--acq-teal)]/10 grid place-items-center mx-auto mb-3">
                        <FileCheck2 className="w-5 h-5 text-[var(--acq-teal)]" />
                    </div>
                    <div className="text-sm font-semibold text-[var(--acq-teal)]">Caricato con successo</div>
                </>
            )}
            {state === 'error' && (
                <>
                    <div className="w-12 h-12 rounded-xl bg-[var(--acq-red)]/10 grid place-items-center mx-auto mb-3">
                        <AlertCircle className="w-5 h-5 text-[var(--acq-red)]" />
                    </div>
                    <div className="text-sm font-semibold text-[var(--acq-red)]">{error}</div>
                </>
            )}
        </label>
    )
}
