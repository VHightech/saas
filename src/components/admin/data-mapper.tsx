'use client'

import React, { useState, useCallback } from 'react'
import { Upload, FileText, ArrowRight, Settings2, Plus, X, Table, Trash2, Edit2, ChevronDown } from 'lucide-react'
import { parse } from 'csv-parse/sync'
import { toast } from 'sonner'
import { clsx } from 'clsx'

export interface FieldMapping {
    targetField: string
    label: string
    sourceColumn: string
    type: 'text' | 'number' | 'date' | 'currency'
    isTemplate: boolean
    template?: string
    isCustom?: boolean
}

export interface DataMapperProps {
    initialMapping?: Record<string, any>
    onChange: (mapping: Record<string, any>) => void
    requiredFields: Array<{ key: string, label: string, type?: string }>
    onDataPreview?: (data: any[]) => void
    hideMappingUI?: boolean
}

export function DataMapper({ initialMapping, onChange, requiredFields, onDataPreview, hideMappingUI = false }: DataMapperProps) {
    const [headers, setHeaders] = useState<string[]>([])
    const [sampleData, setSampleData] = useState<any[]>([])
    const [fileName, setFileName] = useState<string | null>(null)
    const [isFixedWidth, setIsFixedWidth] = useState(false)

    // Internal state for mappings
    const [mappings, setMappings] = useState<FieldMapping[]>(
        requiredFields.map(field => ({
            targetField: field.key,
            label: field.label,
            sourceColumn: '',
            type: (field.type as any) || 'text',
            isTemplate: false,
            template: '',
            isCustom: false
        }))
    )

    const detectFixedWidthColumns = (lines: string[]): { headers: string[], data: any[] } => {
        if (lines.length < 2) return { headers: [], data: [] }

        // Algorithm: Calculate "Structure Profile"
        // 1. For each char index up to max line length, count how many lines have a SPACE at that index.
        // 2. If space_count[i] == lines.length, it's a potential column separator.
        // 3. Consecutive separators form a GAP.

        const maxLen = lines.reduce((max, line) => Math.max(max, line.length), 0)
        const spaceCounts = new Array(maxLen).fill(0)

        // Analyze first 50 lines for speed
        const sampleSize = Math.min(lines.length, 50)
        const analysisLines = lines.slice(0, sampleSize)

        analysisLines.forEach(line => {
            for (let i = 0; i < maxLen; i++) {
                if (i >= line.length || line[i] === ' ') {
                    spaceCounts[i]++
                }
            }
        })

        // Define a column cut if > 95% of lines have a space there (allows for minor noise)
        const threshold = sampleSize * 0.95
        const isGap = (i: number) => spaceCounts[i] >= threshold

        // Find Start/End indices of data columns
        const columnRanges: { start: number, end: number }[] = []
        let inGap = true // Start assuming we are in a gap (margin)
        let colStart = -1

        for (let i = 0; i < maxLen; i++) {
            if (!isGap(i)) {
                // We are in data
                if (inGap) {
                    colStart = i
                    inGap = false
                }
            } else {
                // We are in gap
                if (!inGap) {
                    // Ended a column
                    columnRanges.push({ start: colStart, end: i })
                    inGap = true
                }
            }
        }
        // Close last column if line ends with data
        if (!inGap) {
            columnRanges.push({ start: colStart, end: maxLen })
        }

        // Extract Data
        const parsedData = lines.slice(0, 10).map(line => { // Preview 10 rows
            const row: any = {}
            columnRanges.forEach((range, idx) => {
                const val = line.substring(range.start, range.end).trim()
                row[`Col_${idx + 1}`] = val
            })
            return row
        })

        const generatedHeaders = columnRanges.map((_, i) => `Col_${i + 1}`)
        return { headers: generatedHeaders, data: parsedData }
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setFileName(file.name)
        const reader = new FileReader()
        reader.onload = (event) => {
            try {
                let text = event.target?.result as string

                // For .du files, skip the first line (garbage/metadata)
                if (file.name.toLowerCase().endsWith('.du')) {
                    const newlineIndex = text.indexOf('\n')
                    if (newlineIndex !== -1) {
                        text = text.substring(newlineIndex + 1)
                    }
                }

                const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)

                if (lines.length === 0) {
                    toast.error("File is empty or contains only whitespace")
                    return
                }

                // 1. Attempt CSV Detection
                const firstLine = lines[0]
                const delimiters = [',', ';', '\t', '|']
                const delimiter = delimiters.sort((a, b) =>
                    (firstLine.match(new RegExp(`\\${b}`, 'g')) || []).length -
                    (firstLine.match(new RegExp(`\\${a}`, 'g')) || []).length
                )[0]

                // Heuristic: If best delimiter has 0 occurrences, it's likely Fixed Width or Text
                const delimiterCount = (firstLine.match(new RegExp(`\\${delimiter}`, 'g')) || []).length

                if (delimiterCount === 0 || file.name.endsWith('.txt')) {
                    // FIXED WIDTH MODE
                    setIsFixedWidth(true)
                    const { headers, data } = detectFixedWidthColumns(lines)
                    setHeaders(headers)
                    setSampleData(data)
                    if (onDataPreview) onDataPreview(data)
                    toast.success(`Detected Fixed Width Format (${headers.length} columns)`)
                } else {
                    // CSV MODE
                    setIsFixedWidth(false)
                    const records = parse(text, {
                        columns: false,
                        skip_empty_lines: true,
                        delimiter: delimiter,
                        to: 6,
                        relax_column_count: true
                    })

                    if (records.length > 0) {
                        let detectedHeaders: string[] = []
                        let dataRows = records

                        // Special handling for .du files: They are "headless" (no header row)
                        // So we generate headers and keep the first row as data.
                        if (file.name.toLowerCase().endsWith('.du')) {
                            const colCount = records[0].length
                            detectedHeaders = Array.from({ length: colCount }, (_, i) => `Column ${i + 1}`)
                        } else {
                            // Standard CSV: First row is header
                            detectedHeaders = records[0] as string[]
                            dataRows = records.slice(1)
                        }

                        // Check if any data row has more columns than the header
                        // Check if any data row has more columns than the header
                        const maxCols = records.reduce((max: number, row: any[]) => Math.max(max, row.length), 0)
                        if (maxCols > detectedHeaders.length) {
                            for (let i = detectedHeaders.length; i < maxCols; i++) {
                                detectedHeaders.push(`Col_${i + 1}`)
                            }
                        }

                        // Sanitize Headers: unique & non-empty
                        const uniqueHeaders: string[] = []
                        const headerCounts: Record<string, number> = {}

                        detectedHeaders.forEach((h, index) => {
                            let headerName = h?.trim() || `Col_${index + 1}`

                            if (headerCounts[headerName]) {
                                headerCounts[headerName]++
                                headerName = `${headerName}_${headerCounts[headerName]}`
                            } else {
                                headerCounts[headerName] = 1
                            }
                            uniqueHeaders.push(headerName)
                        })

                        setHeaders(uniqueHeaders)

                        setSampleData(dataRows)
                        if (onDataPreview) onDataPreview(dataRows)
                        toast.success(`Detected CSV Format (${uniqueHeaders.length} columns)`)
                    }
                }
            } catch (err) {
                console.error(err)
                toast.error('Failed to parse file.')
            }
        }
        reader.readAsText(file)
    }

    const addCustomField = () => {
        const newFieldId = `custom_field_${mappings.length + 1}`
        setMappings([...mappings, {
            targetField: newFieldId,
            label: 'New Field',
            sourceColumn: '',
            type: 'text',
            isTemplate: false,
            template: '',
            isCustom: true
        }])
    }

    const removeField = (index: number) => {
        const newMappings = mappings.filter((_, i) => i !== index)
        setMappings(newMappings)
        updateParent(newMappings)
    }

    const updateMapping = (index: number, updates: Partial<FieldMapping>) => {
        const newMappings = [...mappings]
        newMappings[index] = { ...newMappings[index], ...updates }
        setMappings(newMappings)
        updateParent(newMappings)
    }

    const updateParent = (currentMappings: FieldMapping[]) => {
        const parentFormat: Record<string, any> = {}
        currentMappings.forEach(m => {
            parentFormat[m.targetField] = {
                source: m.isTemplate ? m.template : `{{${m.sourceColumn}}}`,
                type: m.type,
                label: m.label
            }
        })
        onChange(parentFormat)
    }

    const insertToken = (index: number, token: string) => {
        const currentTemplate = mappings[index].template || ''
        updateMapping(index, { template: currentTemplate + ` {{${token}}} ` })
    }

    return (
        <div className="space-y-4">
            {/* 1. File Upload Area - Compact & Rounded */}
            <div className={`
                border-2 border-dashed rounded-xl p-4 text-center transition-all bg-white dark:bg-black/20
                ${fileName ? 'border-indigo-500 dark:border-indigo-400' : 'border-slate-300 dark:border-white/10 hover:border-indigo-400'}
            `}>
                <input
                    type="file"
                    accept=".csv,.txt,.du"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="mapper-upload"
                />

                {!fileName ? (
                    <label htmlFor="mapper-upload" className="cursor-pointer flex flex-col items-center gap-2">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-500/20 rounded-full text-indigo-600">
                            <Upload size={20} />
                        </div>
                        <div>
                            <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">Upload Data File</p>
                            <p className="text-[10px] text-slate-500">Supports CSV, TXT, DU</p>
                        </div>
                    </label>
                ) : (
                    <div className="flex items-center justify-between max-w-sm mx-auto bg-slate-50 dark:bg-white/5 p-2 px-3 rounded-lg border border-slate-300 dark:border-white/10">
                        <div className="flex items-center gap-2">
                            <FileText className="text-indigo-600" size={16} />
                            <div className="text-left">
                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[180px]">{fileName}</p>
                                <p className="text-[10px] text-slate-500 font-mono tracking-tight">{isFixedWidth ? 'FIXED' : 'CSV'} • {headers.length} COLS</p>
                            </div>
                        </div>
                        <button
                            onClick={() => { setFileName(null); setHeaders([]); setSampleData([]); }}
                            className="p-1 hover:bg-red-50 hover:text-red-600 rounded-md transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}
            </div>

            {/* 2. Data Preview (Horizontal Scroll - Fixed) */}
            {sampleData.length > 0 && (
                <div className="border border-slate-300 dark:border-white/10 rounded-xl overflow-hidden bg-white dark:bg-black/20">
                    <div className="px-3 py-1.5 border-b border-slate-300 dark:border-white/10 flex items-center gap-2 bg-slate-50 dark:bg-white/5">
                        <Table size={12} className="text-slate-500" />
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Preview Source Data</span>
                    </div>
                    {/* Key Fix: w-full and overflow-x-auto on the direct parent of table */}
                    <div className="w-full overflow-x-auto">
                        <table className="w-full text-left text-[10px] whitespace-nowrap">
                            <thead className="bg-slate-100 dark:bg-white/5 border-b border-slate-300 dark:border-white/10">
                                <tr>
                                    {headers.map((h, i) => (
                                        <th key={i} className="px-2 py-1.5 font-mono text-slate-600 font-bold border-r border-slate-300 dark:border-white/5 last:border-0">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-white/5 bg-white dark:bg-transparent">
                                {sampleData.slice(0, 5).map((row, i) => (
                                    <tr key={i} className="hover:bg-indigo-50/50 dark:hover:bg-white/5 transition-colors">
                                        {headers.map((h, j) => (
                                            <td key={j} className="px-2 py-1 text-slate-700 dark:text-slate-400 font-mono border-r border-slate-200 dark:border-white/5 last:border-0">
                                                {isFixedWidth ? row[h] : Array.isArray(row) ? row[j] : row[h]}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 3. Mapping Configuration - Ultra Compact */}
            {!hideMappingUI && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {mappings.map((field, index) => (
                        <div key={field.targetField} className="group p-3 bg-white dark:bg-white/5 rounded-xl border border-slate-300 dark:border-white/10 shadow-sm hover:border-indigo-400 dark:hover:border-indigo-500/50 transition-all">

                            {/* Header: Field Name (Editable), Type (Editable), Actions */}
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 flex-1">
                                    <div className="relative">
                                        <div className={`w-5 h-5 rounded-lg flex items-center justify-center font-bold text-[9px] cursor-pointer
                                            ${field.type === 'currency' ? 'bg-emerald-100 text-emerald-700' :
                                                field.type === 'date' ? 'bg-amber-100 text-amber-700' :
                                                    field.type === 'number' ? 'bg-blue-100 text-blue-700' :
                                                        'bg-slate-100 text-slate-600'}
                                        `} title="Click to change type">
                                            {field.type === 'currency' ? '$' : field.type === 'date' ? 'D' : field.type === 'number' ? '#' : 'T'}
                                        </div>
                                        <select
                                            value={field.type}
                                            onChange={(e) => updateMapping(index, { type: e.target.value as any })}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                        >
                                            <option value="text">Text</option>
                                            <option value="number">Number</option>
                                            <option value="date">Date</option>
                                            <option value="currency">Currency</option>
                                        </select>
                                    </div>

                                    <input
                                        type="text"
                                        value={field.label}
                                        onChange={(e) => updateMapping(index, { label: e.target.value })}
                                        className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none w-full max-w-[120px]"
                                    />
                                </div>

                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => updateMapping(index, { isTemplate: !field.isTemplate })}
                                        className="text-[9px] px-1.5 py-0.5 rounded-md border border-slate-300 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors"
                                    >
                                        {field.isTemplate ? 'Template' : 'Direct'}
                                    </button>
                                    {field.isCustom && (
                                        <button
                                            onClick={() => removeField(index)}
                                            className="text-red-400 hover:text-red-600 p-0.5"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Input Area */}
                            <div>
                                {!field.isTemplate ? (
                                    <div className="relative group/select">
                                        <select
                                            value={field.sourceColumn}
                                            onChange={(e) => updateMapping(index, { sourceColumn: e.target.value })}
                                            className="w-full h-8 pl-2 pr-6 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-xs focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer appearance-none"
                                            disabled={headers.length === 0}
                                        >
                                            <option value="">Select Column...</option>
                                            {headers.map(h => (
                                                <option key={h} value={h}>
                                                    {h} ➜ {sampleData.length > 0 ? String(isFixedWidth ? sampleData[0][h] : sampleData[0][h] || '').substring(0, 15) : ''}
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover/select:text-indigo-500" />
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        <input
                                            type="text"
                                            value={field.template || ''}
                                            onChange={(e) => updateMapping(index, { template: e.target.value })}
                                            placeholder="{{Col_1}} {{Col_2}}"
                                            className="w-full h-8 px-2 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-xs font-mono focus:ring-1 focus:ring-indigo-500 outline-none"
                                        />
                                        {headers.length > 0 && (
                                            <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto no-scrollbar">
                                                {headers.map(h => (
                                                    <button
                                                        key={h}
                                                        type="button"
                                                        onClick={() => insertToken(index, h)}
                                                        className="px-1.5 py-0.5 text-[9px] bg-slate-100 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 rounded-md border border-slate-200"
                                                    >
                                                        {h}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Add Field Button - Rounded */}
                    <button
                        onClick={addCustomField}
                        className="flex flex-col items-center justify-center p-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-400 text-slate-400 hover:text-indigo-500 transition-all gap-1 h-[86px]"
                    >
                        <Plus size={18} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Add Field</span>
                    </button>
                </div>
            )}
        </div>
    )
}
