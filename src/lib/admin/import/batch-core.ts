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

/** First run of 8 consecutive digits in a name — the export's YYYYMMDD batch date. */
const DATE_KEY_RE = /(\d{8})/
function extractDateKey(name: string): string | null {
    return DATE_KEY_RE.exec(name)?.[1] ?? null
}

interface ArchiveCandidate { key: string; path: string }

/**
 * Pairs every CSV directly inside `folderPath` with an archive — either a
 * `.7z` file or a folder containing the PDFs directly. Two matching
 * strategies, tried in order:
 *   1. Same basename, case-insensitive (e.g. Gennaio2026.csv + Gennaio2026/).
 *   2. Same embedded 8-digit date (e.g. Xml20240108.csv pairs with
 *      Clienti_Singoli_Xml20240108.7z — this is the real Acquambiente export
 *      naming, where the CSV and archive share a date but not a basename).
 * Meant for a "one export per day/month" layout so a whole year can be
 * queued in a single run.
 */
export function discoverBatchPairs(folderPath: string): BatchDiscovery {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true })
    const csvPaths: string[] = []
    const archives: ArchiveCandidate[] = []

    for (const e of entries) {
        const full = path.join(folderPath, e.name)
        if (e.isDirectory()) {
            archives.push({ key: e.name.toLowerCase(), path: full })
        } else if (e.isFile()) {
            const ext = path.extname(e.name).toLowerCase()
            if (ext === '.csv') csvPaths.push(full)
            else if (ext === '.7z') archives.push({ key: path.basename(e.name, ext).toLowerCase(), path: full })
        }
    }

    const pairs: BatchPair[] = []
    const unmatchedCsv: string[] = []
    const usedArchives = new Set<number>()

    for (const csvPath of csvPaths) {
        const csvKey = path.basename(csvPath, path.extname(csvPath)).toLowerCase()
        let archiveIndex = archives.findIndex((a, i) => !usedArchives.has(i) && a.key === csvKey)
        if (archiveIndex === -1) {
            const csvDate = extractDateKey(csvKey)
            if (csvDate) {
                archiveIndex = archives.findIndex((a, i) => !usedArchives.has(i) && extractDateKey(a.key) === csvDate)
            }
        }
        if (archiveIndex === -1) { unmatchedCsv.push(csvPath); continue }
        usedArchives.add(archiveIndex)
        pairs.push({ label: path.basename(csvPath, path.extname(csvPath)), csvPath, archivePath: archives[archiveIndex].path })
    }

    const unmatchedArchives = archives.filter((_, i) => !usedArchives.has(i)).map((a) => a.path)

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
