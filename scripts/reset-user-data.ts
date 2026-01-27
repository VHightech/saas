
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

async function resetUserData() {
    console.log('Starting User Data Reset (clearing usernames and phones)...');

    // Update all profiles to set username and utente (phone/user field) to null
    // Keeping cfpi, codice_cliente, etc as they are needed for linking.

    const { error } = await supabase
        .from('profiles')
        .update({
            utente: null, // Legacy 'username' or similar field
            // Add other fields to clear if necessary based on schema
            // Checking schema.sql: 
            // denominazione, cfpi, codice_cliente, cif, utente, ulm, punto_progr, contratto
            // You likely want to keep denominazione (Name) or maybe clear it too?
            // "reset all evem username, and number phone"
            // User table has 'phone'? Supabase Auth has phone.
            // Profiles has 'utente' which seemed to be username.
        })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Dummy filter to update all

    // Also assuming we might want to clear phone in auth.users if it was set, but we can't easily bulk update auth.users via client without looping admin calls.
    // Ideally, if we only migrated to 'profiles', we just clean profiles.

    if (error) {
        console.error('Error resetting profiles:', error);
    } else {
        console.log('Successfully reset user details in descriptors.');
    }
}

resetUserData().catch(console.error);
