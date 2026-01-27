
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

async function testRegister() {
    const email = 'matteo.volterrani@valdelsahightech.com'
    console.log(`Testing Admin Registration for: ${email}`)

    const { data, error } = await supabase.auth.admin.createUser({
        email: email,
        password: 'Password123!',
        email_confirm: true, // Auto confirm
        user_metadata: {
            username: 'test_matteo'
        }
    })

    if (error) {
        console.error('ERROR:', error)
        console.error('Status:', error.status)
        console.error('Name:', error.name)
        console.error('Message:', error.message)
    } else {
        console.log('SUCCESS! User created:', data.user.id)

        // Clean up
        console.log('Deleting test user...')
        await supabase.auth.admin.deleteUser(data.user.id)
    }
}

testRegister()
