import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Error: Missing Supabase Environment Variables')
    process.exit(1)
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ADMIN_USER = {
    email: 'matteo@acquambiente.it',
    password: '123456789',
    name: 'Matteo'
}

async function createAdmin() {
    console.log(`Creating Admin User: ${ADMIN_USER.name} (${ADMIN_USER.email})...`)

    // 1. Create Auth User with admin role in app_metadata
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: ADMIN_USER.email,
        password: ADMIN_USER.password,
        email_confirm: true,
        user_metadata: {
            full_name: ADMIN_USER.name,
            username: 'matteo_admin'
        },
        app_metadata: {
            role: 'admin'
        }
    })

    if (authError) {
        if (authError.message.includes('already registered')) {
            console.log('User already exists. Updating metadata to admin...')

            // Get user by email
            const { data: listData, error: listError } = await supabase.auth.admin.listUsers()
            if (listError) {
                console.error('Error listing users:', listError.message)
                return
            }

            const existingUser = listData.users.find(u => u.email === ADMIN_USER.email)

            if (existingUser) {
                const { error: updateError } = await supabase.auth.admin.updateUserById(
                    existingUser.id,
                    { app_metadata: { role: 'admin' } }
                )
                if (updateError) {
                    console.error('Error updating metadata:', updateError.message)
                } else {
                    console.log('SUCCESS: Existing user promoted to Admin via app_metadata.')
                }
                return
            }
        }
        console.error('Error creating auth user:', authError.message)
        return
    }

    if (!authData.user) {
        console.error('Unexpected error: No user returned.')
        return
    }

    console.log('Auth User created with ID:', authData.user.id)
    console.log('SUCCESS: Admin user created and promoted via app_metadata.')
}

createAdmin()
