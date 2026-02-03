
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load env from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function check() {
    console.log('--- DB CHECK ---')

    // Count
    const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

    if (error) {
        console.error('Error counting profiles:', error)
        return
    }

    console.log(`Total Profiles in DB: ${count}`)

    // Sample
    const { data, error: sampleError } = await supabase
        .from('profiles')
        .select('id, cif, cfpi')
        .limit(5)

    if (sampleError) console.error(sampleError)
    else {
        console.log('Sample Profiles:', data)
    }
}

check()
