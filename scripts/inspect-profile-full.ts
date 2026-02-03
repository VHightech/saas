
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function inspect() {
    console.log('--- Inspecting DB ---')

    // Check Profile
    const { data: profiles } = await supabase.from('profiles').select('*').limit(5)
    if (profiles && profiles.length > 0) {
        console.log('Found', profiles.length, 'profiles')
        profiles.forEach((p, i) => {
            console.log(`Profile ${i}:`, JSON.stringify(p, null, 2))
        })

    } else {
        console.log('No profiles found')
    }
}

inspect()
