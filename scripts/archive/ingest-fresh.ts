
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import sevenBin from '7zip-bin';
import { extractFull } from 'node-7z';

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

const PROFILES_CSV = path.resolve(__dirname, '../../utenti.csv');
const BILLS_CSV = path.resolve(__dirname, '../../bolletta.csv');
const ARCHIVE_PATH = path.resolve(__dirname, '../../Clienti_Singoli.7z');
const TEMP_DIR = path.resolve(__dirname, '../temp_pdfs');

async function extractPdfs() {
    if (!fs.existsSync(ARCHIVE_PATH)) {
        console.warn(`Archive not found at ${ARCHIVE_PATH}, skipping extraction (assuming files might be there).`);
        return;
    }
    if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    // Check if empty
    const files = fs.readdirSync(TEMP_DIR);
    if (files.length > 0) {
        console.log(`temp_pdfs directory not empty, skipping extraction.`);
        return;
    }

    console.log(`Extracting 7z archive to ${TEMP_DIR}...`);
    const extractionStream = extractFull(ARCHIVE_PATH, TEMP_DIR, {
        $bin: sevenBin.path7za,
        recursive: true,
    });

    await new Promise<void>((resolve, reject) => {
        extractionStream.on('end', () => resolve());
        extractionStream.on('error', (err: any) => reject(err));
    });
    console.log('Extraction complete.');
}

async function ingestProfiles() {
    console.log(`Parsing Profiles: ${PROFILES_CSV}`);
    const fileContent = fs.readFileSync(PROFILES_CSV, 'utf-8');
    const records = parse(fileContent, {
        columns: true, // Use headers
        delimiter: ';',
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true
    });

    console.log(`Found ${records.length} profile records.`);
    let successCount = 0;

    for (const row of records as any[]) {
        // Map columns based on observed headers
        // Id;Denominazione;Email;Username;Password;CFPI;CodiceCliente;CIF
        const legacyId = parseInt(row['Id'], 10);
        if (isNaN(legacyId)) continue;

        const payload = {
            legacy_id: legacyId,
            denominazione: row['Denominazione'],
            email: row['Email'],
            cfpi: row['CFPI'],
            codice_cliente: row['CodiceCliente'],
            cif: row['CIF']
        };

        const { error } = await supabase
            .from('profiles')
            .upsert(payload, { onConflict: 'legacy_id' });

        if (error) {
            console.error(`Error inserting profile ${legacyId}:`, error.message);
        } else {
            successCount++;
        }
        if (successCount % 100 === 0) process.stdout.write('.');
    }
    console.log(`\nImported ${successCount} profiles.`);
}

async function ingestBills() {
    console.log(`Parsing Bills: ${BILLS_CSV}`);
    const fileContent = fs.readFileSync(BILLS_CSV, 'utf-8');
    const records = parse(fileContent, {
        columns: true, // Use headers
        delimiter: ';',
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true
    });

    console.log(`Found ${records.length} bill records.`);
    let successCount = 0;
    let missingProfileCount = 0;

    // Pre-fetch profiles mapping to speed up LOOKUP
    // Assuming manageable size. If huge, use direct querying in loop or batches.
    // For now, let's fetch map: legacy_id -> uuid
    const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('id, legacy_id');

    if (pError) {
        throw new Error(`Failed to fetch profiles: ${pError.message}`);
    }

    const profileMap = new Map(); // legacy_id (int) -> uuid (string)
    profiles.forEach(p => {
        if (p.legacy_id) profileMap.set(p.legacy_id, p.id);
    });

    for (const row of records as any[]) {
        // "Id";"IdFlusso";"IdUser";"CFPI";"CodiceCliente";"NomePdf";"TipoServizio";"DataEmissione";"Scadenza";"Importo";"Consumo";"CodiceClienteOld";"CIF"
        const billId = parseInt(row['Id'], 10);
        const legacyUserId = parseInt(row['IdUser'], 10);

        if (isNaN(billId)) continue;

        // Find user UUID
        const userId = profileMap.get(legacyUserId);
        if (!userId) {
            // console.warn(`Profile not found for legacy_user_id: ${legacyUserId} (Bill: ${billId})`);
            missingProfileCount++;
            continue;
        }

        // Date Parsing (DD/MM/YYYY)
        const parseDate = (d: string) => {
            if (!d) return null;
            const parts = d.split('-'); // Try dash first based on previous files, or slash
            if (parts.length === 3) return `${parts[0]}-${parts[1]}-${parts[2]}`; // Assuming YYYY-MM-DD from previous logs?
            // Actually previous logs showed "2024-01-08".
            // Let's check format from previous tool output: `"2024-02-09"`

            // If format is YYYY-MM-DD
            if (d.match(/^\d{4}-\d{2}-\d{2}$/)) return d;

            // If DD/MM/YYYY
            const parts2 = d.split('/');
            if (parts2.length === 3) return `${parts2[2]}-${parts2[1]}-${parts2[0]}`;

            return null;
        };

        const issueDate = parseDate(row['DataEmissione']);
        const expiryDate = parseDate(row['Scadenza']);

        // Amount
        const amount = parseFloat(row['Importo'].replace(',', '.'));
        const consumption = parseFloat(row['Consumo'].replace(',', '.'));
        const pdfName = row['NomePdf'];

        // Upload PDF
        let pdfUrl = null;
        if (pdfName) {
            const localPdfPath = path.join(TEMP_DIR, pdfName);
            if (fs.existsSync(localPdfPath)) {
                const storagePath = `${userId}/${new Date().getFullYear()}/${pdfName}`;
                // Upload
                const fileBuffer = fs.readFileSync(localPdfPath);
                const { error: uploadError } = await supabase.storage
                    .from('bills')
                    .upload(storagePath, fileBuffer, {
                        contentType: 'application/pdf',
                        upsert: true
                    });

                if (!uploadError) {
                    const { data: publicUrlData } = supabase.storage
                        .from('bills')
                        .getPublicUrl(storagePath);
                    pdfUrl = publicUrlData.publicUrl;
                }
            }
        }

        const payload = {
            id: billId,
            user_id: userId,
            legacy_user_id: legacyUserId,
            cfpi: row['CFPI'],
            codice_cliente: row['CodiceCliente'],
            nome_pdf: pdfName,
            tipo_servizio: row['TipoServizio'],
            data_emissione: issueDate,
            scadenza: expiryDate,
            importo: isNaN(amount) ? null : amount,
            consumo: isNaN(consumption) ? null : consumption,
            codice_cliente_old: row['CodiceClienteOld'],
            cif: row['CIF'],
            pdf_url: pdfUrl
        };

        const { error: insertError } = await supabase
            .from('bills')
            .upsert(payload, { onConflict: 'id' });

        if (insertError) {
            console.error(`Error inserting bill ${billId}:`, insertError.message);
        } else {
            successCount++;
        }
        if (successCount % 50 === 0) process.stdout.write('.');
    }

    console.log(`\nImported ${successCount} bills.`);
    console.log(`Skipped ${missingProfileCount} bills due to missing profile.`);
}

async function main() {
    console.log('--- STARTING FRESH INGESTION ---');

    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    if (buckets && !buckets.find(b => b.name === 'bills')) {
        console.log('Creating bills bucket...');
        await supabase.storage.createBucket('bills', { public: true });
    }

    await extractPdfs();
    await ingestProfiles();
    await ingestBills();

    console.log('--- DONE ---');
}

main().catch(console.error);
