import { NextRequest, NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/auth-checks'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteBatchFromR2 } from '@/lib/r2'

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireSuperadmin()
        if (auth.error) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        const { id } = await params
        if (!id) {
            return NextResponse.json({ error: 'Id mancante.' }, { status: 400 })
        }

        const supabase = createAdminClient()

        // 1. Fetch the log to know the R2 prefix.
        const { data: log, error: fetchError } = await supabase
            .from('import_logs')
            .select('id, r2_path')
            .eq('id', id)
            .maybeSingle()

        if (fetchError || !log) {
            return NextResponse.json({ error: 'Import non trovato.' }, { status: 404 })
        }

        const batchPath = log.r2_path || id

        // 2. Purge R2 (independent of Postgres cascade).
        const deletedCount = await deleteBatchFromR2(batchPath)
        console.log(`Deleted ${deletedCount} files from R2 for prefix ${batchPath}`)

        // 3. Delete the import_log — FK ON DELETE CASCADE removes all bills linked to it.
        const { error: dbError } = await supabase
            .from('import_logs')
            .delete()
            .eq('id', id)

        if (dbError) {
            return NextResponse.json({ error: 'Failed to delete record from database' }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            deletedR2: deletedCount,
            message: 'Import, bollette associate e PDF su R2 eliminati.',
        })
    } catch (err: any) {
        console.error('DELETE /api/upload/[id]', err?.message || err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
