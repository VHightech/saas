
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function inspect() {
    console.log('--- FLAT INSPECT ---')

    // Check Profile
    const { data: profiles } = await supabase.from('profiles').select('*').limit(5)
    if (profiles && profiles.length > 0) {
        profiles.forEach((p, i) => {
            console.log(`[${i}] ID: ${p.id}`)
            console.log(`    Keys: ${Object.keys(p).join(', ')}`)
            console.log(`    Values: name="${p.name}", surname="${p.surname}", denominazione="${p.denominazione}", full_name="${p.full_name}", first_name="${p.first_name}"`)
        })
    } else {
        console.log('No profiles found')
    }
}

inspect()
