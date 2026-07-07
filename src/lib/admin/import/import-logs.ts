import type { SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

export type ImportKind = 'bills' | 'users'

/** Client-generated UUID used as import_logs.r2_path AND (for bills) the R2 prefix. */
export function newImportId(): string {
    return randomUUID()
}

export async function initImportLog(
    sb: SupabaseClient,
    importId: string,
    kind: ImportKind,
    archiveName: string | null,
    current = 'Avvio…',
): Promise<void> {
    const { error } = await sb.from('import_logs').upsert(
        {
            r2_path: importId,
            kind,
            archive_name: archiveName,
            status: 'processing',
            total_files: 0,
            processed_files: 0,
            current_file: current,
        },
        { onConflict: 'r2_path' },
    )
    if (error) console.error('[import_logs] init failed:', error.message)
}

export async function updateImportLog(
    sb: SupabaseClient,
    importId: string,
    current: string,
    processed: number,
    total: number,
): Promise<void> {
    const { error } = await sb
        .from('import_logs')
        .update({ current_file: current, processed_files: processed, total_files: total })
        .eq('r2_path', importId)
    if (error) console.error('[import_logs] update failed:', error.message)
}

export async function completeImportLog(
    sb: SupabaseClient,
    importId: string,
    processed: number,
    total: number,
    errors?: unknown,
): Promise<void> {
    const { error } = await sb
        .from('import_logs')
        .update({
            status: 'completed',
            current_file: 'Completato',
            processed_files: processed,
            total_files: total,
            ...(errors ? { errors: errors as object } : {}),
        })
        .eq('r2_path', importId)
    if (error) console.error('[import_logs] complete failed:', error.message)
}

export async function failImportLog(
    sb: SupabaseClient,
    importId: string,
    message: string,
): Promise<void> {
    const { error } = await sb
        .from('import_logs')
        .update({ status: 'error', current_file: message.slice(0, 200) })
        .eq('r2_path', importId)
    if (error) console.error('[import_logs] fail update failed:', error.message)
}
