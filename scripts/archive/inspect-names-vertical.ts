
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function inspect() {
    console.log('--- VERTICAL INSPECT ---')

    // Check Profile
    const { data: profiles } = await supabase.from('profiles').select('*').limit(3)
    if (profiles && profiles.length > 0) {
        profiles.forEach((p, i) => {
            console.log(`--- PROFILE ${i} ---`)
            console.log(`ID: ${p.id}`)
            console.log(`NAME: ${p.name}`)
            console.log(`SURNAME: ${p.surname}`)
            console.log(`DENOMINAZIONE: ${p.denominazione}`)
            console.log(`FULL_NAME: ${p.full_name}`)
        })
    } else {
        console.log('No profiles found')
    }
}

inspect()
