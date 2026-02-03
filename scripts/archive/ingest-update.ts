
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

const CSV_PATH = path.resolve(__dirname, '../../Xml20260113.csv');
const ARCHIVE_PATH = path.resolve(__dirname, '../../Clienti_Singoli.7z');
const TEMP_DIR = path.resolve(__dirname, '../temp_pdfs');

async function main() {
    console.log('Starting ingestion process...');

    // 1. Extract Archive
    if (!fs.existsSync(ARCHIVE_PATH)) {
        console.error(`Archive not found at ${ARCHIVE_PATH}`);
        process.exit(1);
    }

    // Ensure temp dir exists
    if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
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

    // 1.5 Ensure Storage Bucket Exists
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    if (!bucketError) {
        const bucketExists = buckets.find(b => b.name === 'bills');
        if (!bucketExists) {
            console.log('Creating "bills" storage bucket...');
            await supabase.storage.createBucket('bills', { public: true });
        }
    }

    // 2. Parse CSV
    console.log(`Parsing CSV: ${CSV_PATH}`);
    const fileContent = fs.readFileSync(CSV_PATH, 'utf-8');
    // Handle different delimiters if needed, mostly semicolon based on previous files
    const records = parse(fileContent, {
        columns: false, // No header in the provided sample
        delimiter: ';',
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true
    });

    console.log(`Found ${records.length} records.`);

    // 3. Process Rows
    let successCount = 0;
    let errorCount = 0;
    let missingUserCount = 0;

    for (const row of records) {
        try {
            // Map CSV columns based on implementation plan
            // Col 0: Bill Ref (ID)
            // Col 1: User ID (CF/PIVA) -> map to profiles.cfpi
            // Col 2: PDF Name
            // Col 3: Type
            // Col 4: Issue Date (DD/MM/YYYY)
            // Col 5: Expiry Date (DD/MM/YYYY)
            // Col 6: Amount (comma decimal)
            // Col 7: Consumption

            const billId = row[0];
            const cfpi = row[1];
            const pdfName = row[2];
            const type = row[3];
            const issueDateRaw = row[4];
            const expiryDateRaw = row[5];
            const amountRaw = row[6];
            const consumptionRaw = row[7];

            // Format dates (DD/MM/YYYY -> YYYY-MM-DD)
            const parseDate = (d: string) => {
                if (!d || d === 'nessuna') return null;
                const parts = d.split('/');
                if (parts.length !== 3) return null;
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
            };

            const issueDate = parseDate(issueDateRaw);
            const expiryDate = parseDate(expiryDateRaw);
            const amount = parseFloat(amountRaw.replace(',', '.'));
            const consumption = parseFloat(consumptionRaw.replace(',', '.'));

            // Find user
            const { data: userData, error: userError } = await supabase
                .from('profiles')
                .select('id')
                .eq('cfpi', cfpi)
                .single();

            if (userError || !userData) {
                console.warn(`User not found for CFPI: ${cfpi} (Bill ID: ${billId})`);
                missingUserCount++;
                continue;
            }

            const userId = userData.id;

            // Upload PDF
            const pdfPath = path.join(TEMP_DIR, pdfName);
            let pdfUrl = null;

            if (fs.existsSync(pdfPath)) {
                const fileBuffer = fs.readFileSync(pdfPath);
                const storagePath = `${userId}/${new Date().getFullYear()}/${pdfName}`;

                const { error: uploadError } = await supabase.storage
                    .from('bills')
                    .upload(storagePath, fileBuffer, {
                        contentType: 'application/pdf',
                        upsert: true
                    });

                if (uploadError) {
                    console.error(`Error uploading PDF ${pdfName}:`, uploadError);
                } else {
                    // Construct public URL manually or use getPublicUrl
                    const { data: publicUrlData } = supabase.storage
                        .from('bills')
                        .getPublicUrl(storagePath);
                    pdfUrl = publicUrlData.publicUrl;
                }
            } else {
                console.warn(`PDF file not found: ${pdfName} at ${pdfPath}`);
            }

            // Upsert Bill
            const { error: upsertError } = await supabase
                .from('bills')
                .upsert({
                    id: billId,
                    user_id: userId,
                    cfpi: cfpi,
                    nome_pdf: pdfName,
                    tipo_servizio: type,
                    data_emissione: issueDate,
                    scadenza: expiryDate,
                    importo: amount,
                    consumo: consumption,
                    pdf_url: pdfUrl
                }, { onConflict: 'id' });

            if (upsertError) {
                console.error(`Error inserting bill ${billId}:`, upsertError);
                errorCount++;
            } else {
                successCount++;
                if (successCount % 50 === 0) process.stdout.write('.');
            }

        } catch (err) {
            console.error('Error processing row:', err);
            errorCount++;
        }
    }

    console.log('\nMigration Complete.');
    console.log(`Success: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Missing Users: ${missingUserCount}`);

    // Cleanup temp dir
    // fs.rmSync(TEMP_DIR, { recursive: true, force: true });
}

main().catch(console.error);
