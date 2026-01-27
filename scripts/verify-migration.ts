
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function verify() {
    console.log('Verifying migration...');

    const { count: profilesCount, error: profilesError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

    if (profilesError) console.error('Error counting profiles:', profilesError);
    else console.log(`Total Profiles: ${profilesCount}`);

    const { count: billsCount, error: billsError } = await supabase
        .from('bills')
        .select('*', { count: 'exact', head: true });

    if (billsError) console.error('Error counting bills:', billsError);
    else console.log(`Total Bills: ${billsCount}`);

    // Check a sample relationship
    const { data: billsSample, error: sampleError } = await supabase
        .from('bills')
        .select('id, user_id, profiles(id, denominazione)')
        .limit(1);

    if (sampleError) console.error('Error fetching sample:', sampleError);
    else {
        console.log('Sample Bill:', JSON.stringify(billsSample, null, 2));
    }
}

verify();
