
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

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

// Default to searching for 'utenti.csv' or look for specific new files if named differently
// User said "il cliente mi ha fionrito un file..."
const PROFILES_CSV = process.env.PROFILES_CSV || path.resolve(__dirname, '../../utenti.csv');

async function ingestProfilesV2() {
    console.log(`Parsing Profiles (V2 format): ${PROFILES_CSV}`);

    if (!fs.existsSync(PROFILES_CSV)) {
        console.error(`File not found: ${PROFILES_CSV}`);
        // Try to find any .csv in the parent dir that might be it
        const parentDir = path.resolve(__dirname, '../../');
        const files = fs.readdirSync(parentDir).filter(f => f.endsWith('.csv') && f.toLowerCase().includes('utenti'));
        if (files.length > 0) {
            console.log(`Did you mean: ${files[0]}? Please rename or specify.`);
        }
        process.exit(1);
    }

    const fileContent = fs.readFileSync(PROFILES_CSV, 'utf-8');

    // Header format: cif;nominativo;Codice Fiscale;Partita Iva;indirizzo utenza;Comune
    const records = parse(fileContent, {
        columns: true, // Use headers
        delimiter: ';',
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true
    });

    console.log(`Found ${records.length} profile records.`);
    let successCount = 0;
    let errorCount = 0;

    for (const row of records as any[]) {
        try {
            // Map columns
            const cif = row['cif'];
            const nominativo = row['nominativo'];
            const cf = row['Codice Fiscale'];
            const piva = row['Partita Iva'];
            const address = row['indirizzo utenza'];
            const city = row['Comune'];

            // logic for cfpi: prefer CF, then PI
            const cfpi = cf || piva;

            if (!cif) {
                console.warn('Skipping row missing CIF:', row);
                continue;
            }

            const payload = {
                cif: cif,
                name: nominativo, // Map 'nominativo' to 'name'
                surname: '', // Leave surname empty as requested
                cfpi: cfpi,
                address: address,
                city: city,
                // legacy_id: undefined (let it be null or handle if needed, but not in this file)
                // email: undefined (let it be null)
            };

            // UPSERT by CIF
            const { error } = await supabase
                .from('profiles')
                .upsert(payload, { onConflict: 'cif' });

            if (error) {
                console.error(`Error inserting profile ${cif}:`, error.message);
                errorCount++;
            } else {
                successCount++;
            }
            if (successCount % 100 === 0) process.stdout.write('.');

        } catch (err) {
            console.error('Error processing row:', err);
            errorCount++;
        }
    }
    console.log(`\nImported ${successCount} profiles.`);
    console.log(`Errors: ${errorCount}`);
}

ingestProfilesV2().catch(console.error);
