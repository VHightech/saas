import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function diagnose() {
    // Count total profiles
    const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

    if (error) {
        console.error('Error counting profiles:', error)
        return
    }
    console.log(`Total Profiles: ${count}`)

    // Count Shadow Profiles (legacy_id < 0)
    const { count: shadowCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .lt('legacy_id', 0)

    console.log(`Shadow Profiles: ${shadowCount}`)

    // Count Normal Profiles (legacy_id > 0 or null)
    const { count: normalCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('legacy_id', 0)

    console.log(`Normal Profiles (legacy_id >= 0): ${normalCount}`)

    // Check sample normal profile
    const { data: sample } = await supabase
        .from('profiles')
        .select('*')
        .gte('legacy_id', 0)
        .limit(1)

    console.log('Sample Normal Profile:', sample)
}

diagnose()
