import type { SupabaseClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { readCsvText, runWithConcurrency } from './helpers'
import { analyzeBills, insertBills, type BillsAnalysis, type ProgressFn } from './bills-core'
import { analyzeArchive, processArchive, type ArchiveAnalysis } from './pdf-archive'
import { newImportId, initImportLog, updateImportLog, completeImportLog } from './import-logs'

export interface BatchPair {
    label: string
    csvPath: string
    /** A .7z archive file OR a plain folder containing the PDFs directly. */
    archivePath: string
}

export interface BatchDiscovery {
    pairs: BatchPair[]
    unmatchedCsv: string[]
    unmatchedArchives: string[]
}

/**
 * Pairs every CSV directly inside `folderPath` with a same-named archive —
 * either a `.7z` file or a folder containing the PDFs directly (both match
 * the CSV's basename, case-insensitive). Meant for a "one file/folder per
 * month" layout so a whole year can be queued in a single run.
 */
export function discoverBatchPairs(folderPath: string): BatchDiscovery {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true })
    const csvFiles = new Map<string, string>()
    const archiveFiles = new Map<string, string>()
    const dirEntries = new Map<string, string>()

    for (const e of entries) {
        const full = path.join(folderPath, e.name)
        if (e.isDirectory()) {
            dirEntries.set(e.name.toLowerCase(), full)
        } else if (e.isFile()) {
            const ext = path.extname(e.name).toLowerCase()
            const key = path.basename(e.name, ext).toLowerCase()
            if (ext === '.csv') csvFiles.set(key, full)
            else if (ext === '.7z') archiveFiles.set(key, full)
        }
    }

    const pairs: BatchPair[] = []
    const unmatchedCsv: string[] = []
    const usedKeys = new Set<string>()

    for (const [key, csvPath] of csvFiles) {
        const archivePath = archiveFiles.get(key) ?? dirEntries.get(key)
        if (!archivePath) { unmatchedCsv.push(csvPath); continue }
        usedKeys.add(key)
        pairs.push({ label: path.basename(csvPath, path.extname(csvPath)), csvPath, archivePath })
    }

    const unmatchedArchives = [
        ...[...archiveFiles.entries()].filter(([k]) => !usedKeys.has(k)).map(([, v]) => v),
        ...[...dirEntries.entries()].filter(([k]) => !usedKeys.has(k)).map(([, v]) => v),
    ]

    pairs.sort((a, b) => a.label.localeCompare(b.label))
    return { pairs, unmatchedCsv, unmatchedArchives }
}

export interface StagedBatchItem extends BatchPair {
    billsAnalysis: BillsAnalysis
    archAnalysis: ArchiveAnalysis
}

/**
 * Analyzes every pair sequentially — parsing + read-only DB lookups, no
 * writes yet. idboll dedup is shared across the whole batch so a bill
 * re-listed in a later month's file isn't staged twice even though nothing
 * has actually been committed to the DB by the time it's analyzed.
 */
export async function analyzeBatch(
    sb: SupabaseClient,
    pairs: BatchPair[],
    onItem?: (item: StagedBatchItem) => void,
): Promise<StagedBatchItem[]> {
    const staged: StagedBatchItem[] = []
    const batchSeenIdbolls = new Set<number>()

    for (const pair of pairs) {
        const csvText = readCsvText(pair.csvPath)
        const billsAnalysis = await analyzeBills(sb, csvText, batchSeenIdbolls)
        for (const b of billsAnalysis.billsToInsert) {
            if (typeof b.idboll === 'number' && b.idboll > 0) batchSeenIdbolls.add(b.idboll)
        }
        const archAnalysis = await analyzeArchive(sb, pair.archivePath, billsAnalysis.billsToInsert.map((b) => b.nome_pdf))
        const item: StagedBatchItem = { ...pair, billsAnalysis, archAnalysis }
        staged.push(item)
        onItem?.(item)
    }
    return staged
}

export interface BatchItemResult {
    label: string
    inserted: number
    uploaded: number
    linked: number
    skipped: number
    errors: string[]
}

/** Commits every staged pair, at most `concurrency` running at once. */
export async function processBatch(
    sb: SupabaseClient,
    staged: StagedBatchItem[],
    concurrency: number,
    onLog: (label: string, message: string) => void,
): Promise<BatchItemResult[]> {
    const results: BatchItemResult[] = []

    await runWithConcurrency(staged, concurrency, async (item) => {
        const importId = newImportId()
        await initImportLog(sb, importId, 'bills', path.basename(item.archivePath), `Import ${item.label}…`)

        const onProgress: ProgressFn = async (c, done, total) => {
            onLog(item.label, c)
            await updateImportLog(sb, importId, c, done, total)
        }

        const ins = await insertBills(sb, item.billsAnalysis.billsToInsert, importId, onProgress)
        const pr = await processArchive(sb, item.archivePath, importId, onProgress)
        const errors = [...item.billsAnalysis.parseErrors, ...ins.errors, ...pr.errors]

        await completeImportLog(sb, importId, pr.uploaded + pr.skipped, item.archAnalysis.pdfTotal, { errors })
        results.push({ label: item.label, inserted: ins.inserted, uploaded: pr.uploaded, linked: pr.linked, skipped: pr.skipped, errors })
    })

    results.sort((a, b) => a.label.localeCompare(b.label))
    return results
}
