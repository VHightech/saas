
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function clean() {
    console.log('Cleaning database...')

    // 0. Clean Logs
    const { error: logsError } = await supabase.from('import_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (logsError) console.error('logs error', logsError)

    // 1. Delete all bills first (foreign key constraint)
    const { error: billsError, count: billsCount } = await supabase.from('bills').delete().neq('id', -1) // use -1 for bigint? or just neq 0
    if (billsError) console.error('Bills Error:', billsError)
    else console.log('Bills deleted')

    // 2. Delete all profiles
    // Use a loop to be safe against timeouts? Or just try neq null
    const { error: profilesError, count: profilesCount } = await supabase
        .from('profiles')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

    if (profilesError) console.error('Profiles Error:', profilesError)
    else console.log('Profiles deleted')

    // 3. Add Unique Constraint to CIF
    // Note: This might fail via API if RPC not setup, but we try.
    // Ideally this is run in SQL Editor.
    console.log('To enforce uniqueness, run this SQL in Supabase Dashboard:')
    console.log(`
        ALTER TABLE public.profiles ADD CONSTRAINT unique_cif UNIQUE (cif);
        ALTER TABLE public.profiles ADD CONSTRAINT unique_cfpi UNIQUE (cfpi); -- Optional but recommended
    `)
}

clean()
