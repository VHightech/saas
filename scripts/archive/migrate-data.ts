
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load env vars
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// Paths to CSVs
const BASE_PATH = path.resolve(__dirname, '../../');
const UTENTI_PATH = path.join(BASE_PATH, 'utenti.csv');
const FLUSSO_PATH = path.join(BASE_PATH, 'flusso.csv');
const BOLLETTA_PATH = path.join(BASE_PATH, 'bolletta.csv');

async function migrate() {
    console.log('Starting migration...');
    console.log(`Reading CSVs from: ${BASE_PATH}`);

    // CLEANUP: Delete existing data
    console.log('Cleaning up existing data...');
    const { error: deleteBillsError } = await supabase.from('bills').delete().neq('id', 0);
    if (deleteBillsError) console.error('Error cleaning bills:', deleteBillsError);

    const { error: deleteProfilesError } = await supabase.from('profiles').delete().neq('legacy_id', 0);
    if (deleteProfilesError) console.error('Error cleaning profiles:', deleteProfilesError);




    // 2. Migrate USERS
    if (fs.existsSync(UTENTI_PATH)) {
        console.log('Migrating Users...');
        const usersRaw = fs.readFileSync(UTENTI_PATH, 'utf-8').replace(/^\uFEFF/, '');
        const usersData = parse(usersRaw, {
            columns: true,
            skip_empty_lines: true,
            delimiter: ';',
            trim: true,
            relax_quotes: true
        });

        // Pre-fetch all text users to handle existing auth accounts
        console.log('Fetching existing users from Auth...');
        const emailToId = new Map<string, string>();
        let page = 1;
        let hasMore = true;
        while (hasMore) {
            const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
            if (listError || !listData?.users || listData.users.length === 0) {
                hasMore = false;
            } else {
                listData.users.forEach(u => {
                    if (u.email) emailToId.set(u.email.toLowerCase(), u.id);
                });
                page++;
                // Safety break if too many pages? Allow up to 50k users (50 pages)
                if (page > 50) hasMore = false;
            }
        }
        console.log(`Found ${emailToId.size} existing users.`);

        const userIdMap = new Map<number, string>();
        const cifToUserId = new Map<string, string>();
        const cfpiToUserId = new Map<string, string>();

        for (const row of usersData as any[]) {
            const legacyId = parseInt(row.Id);
            // ... (rest of loop)

            if (isNaN(legacyId)) continue;

            if (!row.Email) {
                console.warn(`User ${legacyId} has no email, skipping auth.`);
                continue;
            }

            const email = row.Email.trim();
            const fakePassword = Math.random().toString(36).slice(-12) + "Aa1!";

            const { data: userData, error: userError } = await supabase.auth.admin.createUser({
                email: email,
                password: fakePassword,
                email_confirm: true
            });

            let userId = userData.user?.id;

            if (userError) {
                // If user already exists, try to find them in our pre-fetched map
                const existingId = emailToId.get(email.toLowerCase());
                if (existingId) {
                    userId = existingId;
                    console.log(`User ${email} already exists, linking ID: ${userId}`);
                }
            }

            if (!userId) continue;

            userIdMap.set(legacyId, userId);

            // Map CIF if valid and not placeholder
            if (row.CIF) {
                const cleanCif = row.CIF.trim();
                if (cleanCif !== '000000000000') {
                    cifToUserId.set(cleanCif, userId);
                }
            }

            // Map CFPI
            if (row.CFPI) {
                cfpiToUserId.set(row.CFPI.trim(), userId);
            }

            const profile = {
                id: userId,
                denominazione: row.Denominazione, // Mapped to column 'denominazione'
                cfpi: row.CFPI,
                codice_cliente: row.CodiceCliente,
                cif: row.CIF,
                // Legacy columns dropped: utente, ulm, punto_progr, contratto
                legacy_id: legacyId
            };

            const { error: profileError } = await supabase.from('profiles').upsert(profile);
            if (profileError) console.error(`Error creating profile for ${email}:`, profileError);
        }
        console.log(`Processed ${usersData.length} users.`);

        console.log(`Processed ${usersData.length} users.`);

        // 3. Shadow Profiles & Bills
        if (fs.existsSync(BOLLETTA_PATH)) {
            console.log('Scanning Bills for Shadow Profiles...');
            const billsRaw = fs.readFileSync(BOLLETTA_PATH, 'utf-8').replace(/^\uFEFF/, '');
            const billsData = parse(billsRaw, {
                columns: true,
                skip_empty_lines: true,
                delimiter: ',',
                trim: true,
                relax_quotes: true
            });

            // Identify Orphans
            const shadowProfiles = new Map<string, any>();
            let nextShadowId = -1;

            for (const row of billsData as any[]) {
                // Determine Key
                let key = null;
                let isCif = false;

                if (row.CIF && row.CIF.trim() !== '000000000000') {
                    key = row.CIF.trim();
                    isCif = true;
                } else if (row.CFPI) {
                    key = row.CFPI.trim();
                }

                if (!key) continue;

                // Check if user exists
                let exists = false;
                if (isCif) exists = cifToUserId.has(key);
                else exists = cfpiToUserId.has(key);

                // If not, queue for creation
                if (!exists && !shadowProfiles.has(key)) {
                    shadowProfiles.set(key, {
                        legacy_id: nextShadowId--,
                        denominazione: `Utente da Bolletta ${key}`,
                        cif: isCif ? key : null,
                        cfpi: !isCif ? key : null, // Use as CFPI if that was the key
                        codice_cliente: row.CodiceCliente
                    });
                }
            }

            console.log(`Found ${shadowProfiles.size} orphan users. Creating Shadow Profiles...`);

            // Create Shadow Users in Auth & Profile
            const shadowList = Array.from(shadowProfiles.values());
            for (const shadow of shadowList) {
                // Create dummy auth user
                const fakeEmail = `shadow.${Math.abs(shadow.legacy_id)}.${Math.random().toString(36).slice(-5)}@placeholder.com`;
                const fakePassword = Math.random().toString(36).slice(-12) + "Aa1!";

                const { data: userData, error: userError } = await supabase.auth.admin.createUser({
                    email: fakeEmail,
                    password: fakePassword,
                    email_confirm: true,
                    user_metadata: { is_shadow: true }
                });

                if (userError || !userData.user) {
                    console.error(`Failed to create shadow auth for ${fakeEmail}`, userError);
                    continue;
                }

                const userId = userData.user.id;

                // Insert Profile
                const profile = {
                    id: userId,
                    legacy_id: shadow.legacy_id,
                    denominazione: shadow.denominazione,
                    cif: shadow.cif,
                    cfpi: shadow.cfpi,
                    codice_cliente: shadow.codice_cliente
                };

                const { error: profileError } = await supabase.from('profiles').insert(profile);
                if (profileError) {
                    console.error(`Failed to create shadow profile ${shadow.legacy_id}`, profileError);
                } else {
                    // Update Maps
                    if (shadow.cif) cifToUserId.set(shadow.cif, userId);
                    if (shadow.cfpi) cfpiToUserId.set(shadow.cfpi, userId);
                }
            }
            console.log('Shadow Profiles created.');

            console.log('Migrating Bills...');

            const billRecords = [];
            let matches = 0;
            for (const row of billsData as any[]) {
                // Link via CIF first, then CFPI
                let userId = null;
                const cif = row.CIF ? row.CIF.trim() : null;

                if (cif && cif !== '000000000000') {
                    userId = cifToUserId.get(cif);
                }

                if (!userId && row.CFPI) {
                    const cfpi = row.CFPI.trim();
                    userId = cfpiToUserId.get(cfpi);
                    if (userId && matches <= 5) console.log(`Fallback match via CFPI: ${cfpi} -> ${userId}`);
                }

                if (userId) {
                    matches++;
                    if (matches <= 5) console.log(`Matched bill: CIF=${cif} -> User=${userId}`);
                    const id = parseInt(row.Id);
                    // const idFlusso = parseInt(row.IdFlusso); // Removed column

                    if (isNaN(id)) continue;

                    billRecords.push({
                        id: id,
                        user_id: userId,
                        // id_flusso: idFlusso, // Removed
                        cfpi: row.CFPI,
                        codice_cliente: row.CodiceCliente,
                        nome_pdf: row.NomePdf,
                        tipo_servizio: row.TipoServizio,
                        data_emissione: row.DataEmissione ? new Date(row.DataEmissione.split('T')[0]) : null,
                        scadenza: row.Scadenza ? new Date(row.Scadenza.split('T')[0]) : null,
                        importo: parseFloat(row.Importo.replace(',', '.')),
                        consumo: parseFloat(row.Consumo.replace(',', '.')),
                        codice_cliente_old: row.CodiceClienteOld,
                        cif: row.CIF
                    });
                }
            }

            console.log(`Total matched bills: ${matches}. Queueing for insert...`);
            const chunkSize = 100;
            for (let i = 0; i < billRecords.length; i += chunkSize) {
                const chunk = billRecords.slice(i, i + chunkSize);
                const { error: billError } = await supabase.from('bills').upsert(chunk);
                if (billError) console.error('Error migrating bills chunk:', billError);
            }
            console.log(`Migrated ${billRecords.length} bills.`);
        }
    }

    console.log('Migration complete.');
}

migrate().catch(console.error);
