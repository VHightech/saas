import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkSchema() {
    // Note: This might not work if permissions are restricted even for service role,
    // but usually service role can do most things.
    // However, rpc is better if there's a function.
    // Let's just try to select from information_schema.columns
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .limit(1)

    if (error) {
        console.error('Error:', error)
        return
    }

    console.log('Sample row keys:', Object.keys(data[0] || {}))

    // Let's try to see if 'role' exists by selecting it explicitly
    const { data: roleData, error: roleError } = await supabase
        .from('profiles')
        .select('role')
        .limit(1)

    if (roleError) {
        console.log("Column 'role' does NOT exist.")
    } else {
        console.log("Column 'role' exists.")
    }
}

checkSchema()
