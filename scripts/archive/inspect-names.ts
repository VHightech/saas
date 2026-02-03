
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function inspect() {
    console.log('--- Inspecting Name Fields ---')

    const { data: profiles } = await supabase.from('profiles').select('id, name, surname, full_name, denominazione, email').limit(5)

    if (profiles && profiles.length > 0) {
        console.table(profiles)
    } else {
        console.log('No profiles found')
    }
}

inspect()
