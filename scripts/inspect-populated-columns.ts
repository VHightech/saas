
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function inspect() {
    console.log('--- POPULATED COLS ---')

    const { data: profiles } = await supabase.from('profiles').select('*').limit(5)
    if (profiles && profiles.length > 0) {
        profiles.forEach((p, i) => {
            console.log(`--- PROFILE ${i} ---`)
            const populated = Object.entries(p)
                .filter(([_, v]) => v !== null && v !== '' && v !== undefined)
                .map(([k, v]) => `${k}=${String(v).substring(0, 20)}`)
            console.log(populated.join(' | '))
        })
    } else {
        console.log('No profiles found')
    }
}

inspect()
