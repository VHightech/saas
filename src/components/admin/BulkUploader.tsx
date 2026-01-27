'use client'

import { useState, useCallback } from 'react'
import { UploadCloud, File, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { parseFileName, ParsedFileInfo } from '@/lib/admin/file-parser'

export function BulkUploader() {
    const [files, setFiles] = useState<(ParsedFileInfo & { status: 'pending' | 'uploading' | 'done' | 'error', progress: number })[]>([])
    const [isDragOver, setIsDragOver] = useState(false)

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(false)

        const droppedFiles = Array.from(e.dataTransfer.files)
        const parsed = droppedFiles.map(file => ({
            ...parseFileName(file.name),
            status: 'pending' as const,
            progress: 0
        }))

        setFiles(prev => [...parsed, ...prev])
    }, [])

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(true)
    }

    const handleDragLeave = () => {
        setIsDragOver(false)
    }

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index))
    }

    const startUpload = () => {
        // Mock Upload Process
        setFiles(prev => prev.map(f => f.isValid ? { ...f, status: 'uploading' } : f))

        const interval = setInterval(() => {
            setFiles(prev => {
                const anyUploading = prev.some(f => f.status === 'uploading')
                if (!anyUploading) {
                    clearInterval(interval)
                    return prev
                }

                return prev.map(f => {
                    if (f.status !== 'uploading') return f

                    const newProgress = Math.min(f.progress + Math.random() * 20, 100)
                    const newStatus = newProgress >= 100 ? 'done' : 'uploading'

                    return {
                        ...f,
                        progress: newProgress,
                        status: newStatus
                    }
                })
            })
        }, 500)
    }

    return (
        <div className="space-y-8">
            {/* Search / Drop Zone */}
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-3 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center transition-all duration-300
          ${isDragOver
                        ? 'border-[#005A9C] bg-blue-50/60 scale-[1.02] shadow-lg backdrop-blur-sm'
                        : 'border-slate-300/60 hover:border-[#005A9C]/60 hover:bg-white/40 bg-white/20 backdrop-blur-sm'}
        `}
            >
                <div className={`p-5 rounded-full mb-5 shadow-sm transition-colors duration-300 ${isDragOver ? 'bg-[#005A9C] text-white' : 'bg-white text-[#005A9C]'}`}>
                    <UploadCloud size={48} />
                </div>
                <h3 className="text-2xl font-bold text-slate-800">Trascina qui i PDF</h3>
                <p className="text-slate-500 mt-2 text-center max-w-md font-medium">
                    Il sistema analizzerà automaticamente i nomi dei file (es. <code>CF_XYZ...pdf</code>) per associarli ai clienti.
                </p>
            </div>

            {/* File List */}
            {files.length > 0 && (
                <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-500">
                    <div className="px-8 py-5 border-b border-white/50 flex justify-between items-center bg-white/40">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-6 bg-[#005A9C] rounded-full" />
                            <h4 className="font-bold text-slate-800 text-lg">File in Coda ({files.length})</h4>
                        </div>
                        <button
                            onClick={startUpload}
                            disabled={files.every(f => f.status === 'done' || !f.isValid)}
                            className="bg-[#005A9C] text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-[#004880] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg active:scale-95"
                        >
                            {files.some(f => f.status === 'uploading') ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 className="animate-spin" size={16} /> Caricamento...
                                </span>
                            ) : 'Avvia Upload'}
                        </button>
                    </div>

                    <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                        {files.map((file, idx) => (
                            <div key={idx} className="px-8 py-5 border-b border-slate-100/50 last:border-0 hover:bg-blue-50/30 transition-colors flex items-center justify-between group">
                                <div className="flex items-center gap-5">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm transition-colors ${file.isValid ? 'bg-blue-50 text-[#005A9C]' : 'bg-red-50 text-red-500'}`}>
                                        <File size={24} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 text-base mb-1">{file.originalName}</p>
                                        <div className="flex items-center gap-2">
                                            {file.isValid ? (
                                                <span className="text-xs font-semibold text-green-700 bg-green-100/80 border border-green-200 px-2.5 py-0.5 rounded-lg flex items-center gap-1.5">
                                                    <CheckCircle size={12} /> {file.identifier} ({file.type})
                                                </span>
                                            ) : (
                                                <span className="text-xs font-semibold text-red-600 bg-red-100/80 border border-red-200 px-2.5 py-0.5 rounded-lg flex items-center gap-1.5">
                                                    <AlertCircle size={12} /> Nessun ID rilevato
                                                </span>
                                            )}
                                            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-lg uppercase tracking-wider">{file.docType}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    {file.status === 'uploading' && (
                                        <div className="w-48 bg-slate-100 rounded-full h-2.5 overflow-hidden shadow-inner">
                                            <div className="bg-[#005A9C] h-full transition-all duration-300 ease-out rounded-full relative overflow-hidden">
                                                <div className="absolute inset-0 bg-white/30 animate-pulse w-full h-full" />
                                            </div>
                                            {/* Style hack since inline style for width was complicated in string replacement */}
                                            <style jsx>{`
                                                .progress-bar-${idx} { width: ${file.progress}% }
                                            `}</style>
                                            <div className={`bg-[#005A9C] h-full transition-all duration-300 ease-out rounded-full`} style={{ width: `${file.progress}%` }} />
                                        </div>
                                    )}
                                    {/* Correcting the double progress bar issue above by simplifying */}

                                    {file.status === 'done' && (
                                        <span className="text-green-600 text-sm font-bold bg-green-50 px-3 py-1 rounded-full border border-green-100 flex items-center gap-1.5">
                                            <CheckCircle size={14} /> Completato
                                        </span>
                                    )}

                                    {file.status === 'pending' && (
                                        <button
                                            onClick={() => removeFile(idx)}
                                            className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
                                            title="Rimuovi file"
                                        >
                                            <X size={20} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
