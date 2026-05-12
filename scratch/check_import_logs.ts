import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkLogs() {
    const { data, error } = await supabase
        .from('import_logs')
        .select('*')
        .order('created_at', { ascending: false })
    
    if (error) {
        console.error('Error:', error)
    } else {
        console.log('Logs:', JSON.stringify(data, null, 2))
    }
}

checkLogs()
