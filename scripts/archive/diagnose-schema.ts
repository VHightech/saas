import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function diagnose() {
    console.log('--- Checking Profiles Columns & Constraints ---')
    // Try to query information_schema (works if service role has permissions)
    // Note: Supabase JS client defaults to "public" schema. 
    // We can try to switch schema or just use raw query if we had a function.
    // Let's try listing columns via `data` inspection of an empty insert? No.

    // Attempt 1: Fetch 1 row
    const { data: rows, error } = await supabase.from('profiles').select('*').limit(1)
    if (error) console.error('Error selecting:', error)
    else console.log('Existing row sample:', rows[0])

    const { data: cols, error: err } = await supabase.from('profiles').select('*').limit(0)
    // This doesn't give types.

    console.log('--- Checking if we can insert without legacy_id or email ---')
    // Try a dry-run insert (rollback or delete after)
    const testCif = 'TEST_' + Date.now()
    const { data: insData, error: insError } = await supabase.from('profiles').insert({
        cif: testCif,
        name: 'Test Name',
        // legacy_id: omit
        // email: omit
    }).select().single()

    if (insError) {
        console.error('Insert failed (Constraints check):', insError.message)
    } else {
        console.log('Insert SUCCESS without legacy_id/email. Created ID:', insData.id)
        // clean up
        await supabase.from('profiles').delete().eq('id', insData.id)
        console.log('Cleaned up test record.')
    }
}

diagnose()
