
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load env from root (try .env and .env.local)
dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Error: Missing Env Variables.')
    console.error('Ensure .env or .env.local contains NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function createAdmin() {
    const email = process.argv[2]
    const password = process.argv[3] || 'Password123!'
    const name = process.argv[4] || 'Admin User'

    if (!email) {
        console.log('Usage: npx tsx scripts/create-admin-user.ts <email> [password] [name]')
        process.exit(1)
    }

    console.log(`Creating Admin User: ${email}...`)

    // 1. Create Identity in Auth
    // We use admin.createUser to auto-confirm email
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
            full_name: name,
            username: email.split('@')[0]
        }
    })

    if (authError) {
        console.error('Auth Create Error:', authError.message)
        // If user already exists, we might want to just promote them
        if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
            console.log('User already exists in Auth. Looking up ID...')

            // Create admin client for searching
            const { data: listData, error: listError } = await supabase.auth.admin.listUsers()

            if (listError) {
                console.error('Error listing users:', listError)
                process.exit(1)
            }

            const existingUser = listData.users.find(u => u.email?.toLowerCase() === email.toLowerCase())

            if (existingUser) {
                console.log(`Found user ID: ${existingUser.id}. Promoting...`)
                await promoteToAdmin(existingUser.id, name, email)
                return
            } else {
                console.error('Could not find user in list despite "already registered" error.')
                process.exit(1)
            }
        }
        process.exit(1)
    }

    if (authData.user) {
        await promoteToAdmin(authData.user.id, name, email)
    }
}

async function promoteToAdmin(userId: string, name: string, email: string) {
    // 2. Upsert Profile with 'super_admin' role
    const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        email: email,
        name: name,
        role: 'super_admin', // Force super_admin
        is_shadow: false
    })

    if (profileError) {
        console.error('Profile Upsert Error:', profileError)
    } else {
        console.log(`SUCCESS! User ${email} is now a SUPER ADMIN.`)
        console.log(`Login with password: ${process.argv[3] || 'Password123!'}`)
    }
}

createAdmin()
