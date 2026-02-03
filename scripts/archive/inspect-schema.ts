
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function inspectSchema() {
    console.log('--- Inspecting Schema ---')

    // Check Profile Columns. Note: RPC or just raw select from empty row if possible, 
    // but without direct SQL access, we can infer from a select.
    // Let's try to get a single row and print keys, ensuring no truncation.

    const { data: profiles, error } = await supabase.from('profiles').select('*').limit(1)

    if (error) {
        console.error('Error:', error)
        return
    }

    if (profiles && profiles.length > 0) {
        console.log('--- PROFILE KEYS ---')
        console.log(JSON.stringify(Object.keys(profiles[0]), null, 2))
        console.log('--- PROFILE DATA SAMPLE ---')
        console.log(JSON.stringify(profiles[0], null, 2))
    } else {
        console.log('No profiles found to inspect schema.')
    }
}

inspectSchema()
