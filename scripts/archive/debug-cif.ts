
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkCif() {
    const targetCif = '216076216076'
    console.log(`Checking for CIF: ${targetCif}`)

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('cif', targetCif)

    if (error) {
        console.error('Error:', error)
    } else {
        console.log('Result:', data)
        if (data && data.length > 0) {
            console.log('Found user with this CIF!')
        } else {
            console.log('CIF NOT found in DB.')
        }
    }
}

checkCif()
