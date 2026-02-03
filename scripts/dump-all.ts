
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function inspect() {
    console.log('--- DUMP ALL ---')

    const { data: profiles } = await supabase.from('profiles').select('*').limit(20)

    if (profiles && profiles.length > 0) {
        fs.writeFileSync('all_profiles_dump.json', JSON.stringify(profiles, null, 2))
        console.log('Dumped', profiles.length, 'profiles to all_profiles_dump.json')
    } else {
        console.log('No profiles found')
    }
}

inspect()
