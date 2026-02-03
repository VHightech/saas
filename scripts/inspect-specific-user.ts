
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function inspect() {
    console.log('--- INSPECT SPECIFIC USER ---')

    // Try multiple columns for fiscal code match
    const { data: profiles } = await supabase.from('profiles').select('*').or('cif.eq.ewefwedfwedf,cfpi.eq.ewefwedfwedf,fiscal_code.eq.ewefwedfwedf').limit(1)

    if (profiles && profiles.length > 0) {
        const p = profiles[0]
        console.log(`FOUND ID: ${p.id}`)

        // Print all non-null text keys
        Object.entries(p).forEach(([k, v]) => {
            if (v && typeof v === 'string') {
                console.log(`${k}: ${v}`)
            }
        })
    } else {
        console.log('User not found by fiscal code')
    }
}

inspect()
