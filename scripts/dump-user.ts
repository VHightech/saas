
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
    console.log('--- DUMP USER ---')

    // Try multiple columns for fiscal code match
    const { data: profiles } = await supabase.from('profiles').select('*').or('cif.eq.ewefwedfwedf,cfpi.eq.ewefwedfwedf,fiscal_code.eq.ewefwedfwedf').limit(1)

    if (profiles && profiles.length > 0) {
        fs.writeFileSync('profile_dump.json', JSON.stringify(profiles[0], null, 2))
        console.log('Dumped to profile_dump.json')
    } else {
        console.log('User not found')
        fs.writeFileSync('profile_dump.json', JSON.stringify({ error: 'User not found' }))
    }
}

inspect()
