import type { SupabaseClient } from '@supabase/supabase-js'

export type ImportStatus = 'processing' | 'completed' | 'error'

export interface ImportProgress {
    /** Create/refresh the import_logs row at the start of a run. */
    init(totalFiles: number, currentFile: string): Promise<void>
    /** Report progress. Throttled to at most once per `throttleMs` unless status !== 'processing'. */
    update(currentFile: string, processed: number, total: number, status?: ImportStatus): Promise<void>
    /** Terminal failure update (not throttled). */
    fail(currentFile: string): Promise<void>
}

interface ImportProgressOptions {
    /** Stored in import_logs.archive_name. */
    archiveName?: string | null
    /** Stored in import_logs.kind (e.g. 'users'). */
    kind?: string
    /** Minimum ms between throttled updates (default 1000). Pass 0 to disable. */
    throttleMs?: number
}

/**
 * Owns the import_logs progress row (schema + throttle) for the bulk-import
 * routes. Previously each route hand-rolled the upsert + throttle inline with
 * divergent policies; this concentrates that locality in one module.
 *
 * All writes upsert on `r2_path` (the import id), so init and ticks are idempotent.
 * A null importId makes every method a no-op.
 */
export function createImportProgress(
    supabase: SupabaseClient,
    importId: string | null,
    opts: ImportProgressOptions = {},
): ImportProgress {
    const throttleMs = opts.throttleMs ?? 1000
    let lastUpdate = 0

    const write = async (row: Record<string, unknown>) => {
        if (!importId) return
        const { error } = await supabase
            .from('import_logs')
            .upsert({ r2_path: importId, archive_name: opts.archiveName ?? null, ...(opts.kind ? { kind: opts.kind } : {}), ...row }, { onConflict: 'r2_path' })
        if (error) console.error(`[import-progress] write failed for ${importId}:`, error.code)
    }

    return {
        async init(totalFiles, currentFile) {
            await write({ status: 'processing', total_files: totalFiles, processed_files: 0, current_file: currentFile })
        },
        async update(currentFile, processed, total, status = 'processing') {
            const now = Date.now()
            if (status === 'processing' && throttleMs > 0 && now - lastUpdate < throttleMs) return
            lastUpdate = now
            await write({ status, current_file: currentFile, processed_files: processed, total_files: total })
        },
        async fail(currentFile) {
            await write({ status: 'error', current_file: currentFile })
        },
    }
}
