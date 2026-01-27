
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const BASE_PATH = path.resolve(__dirname, '../../');
const UTENTI_PATH = path.join(BASE_PATH, 'utenti.csv');
const BOLLETTA_PATH = path.join(BASE_PATH, 'bolletta.csv');

function diagnose() {
    console.log('Diagnosing missing bills...');

    // 1. Load Users to build lookup maps
    console.log('Loading users...');
    if (!fs.existsSync(UTENTI_PATH)) {
        console.error('Utenti file not found!');
        return;
    }
    const usersRaw = fs.readFileSync(UTENTI_PATH, 'utf-8').replace(/^\uFEFF/, '');
    const usersData = parse(usersRaw, {
        columns: true,
        skip_empty_lines: true,
        delimiter: ';',
        trim: true,
        relax_quotes: true
    });

    const cifToUserId = new Map<string, boolean>();
    const cfpiToUserId = new Map<string, boolean>();

    usersData.forEach((row: any) => {
        if (row.CIF && row.CIF.trim() !== '000000000000') cifToUserId.set(row.CIF.trim(), true);
        if (row.CFPI) cfpiToUserId.set(row.CFPI.trim(), true);
    });
    console.log(`Loaded ${usersData.length} users.`);

    // 2. Analyze Bills
    console.log('Loading bills...');
    if (!fs.existsSync(BOLLETTA_PATH)) {
        console.error('Bolletta file not found at:', BOLLETTA_PATH);
        return;
    }
    const billsRaw = fs.readFileSync(BOLLETTA_PATH, 'utf-8').replace(/^\uFEFF/, '');
    const billsData = parse(billsRaw, {
        columns: true,
        skip_empty_lines: true,
        delimiter: ',',
        trim: true,
        relax_quotes: true
    });

    console.log(`Total Bills in CSV: ${billsData.length}`);

    let matched = 0;
    let unmatched = 0;
    let unmatchedSamples: any[] = [];

    billsData.forEach((row: any) => {
        let isLinked = false;

        // Try CIF
        if (row.CIF) {
            const cif = row.CIF.trim();
            if (cif !== '000000000000' && cifToUserId.has(cif)) {
                isLinked = true;
            }
        }

        // Try CFPI fallback
        if (!isLinked && row.CFPI) {
            const cfpi = row.CFPI.trim();
            if (cfpiToUserId.has(cfpi)) {
                isLinked = true;
            }
        }

        if (isLinked) {
            matched++;
        } else {
            unmatched++;
            if (unmatchedSamples.length < 10) {
                unmatchedSamples.push({
                    id: row.Id,
                    cif: row.CIF,
                    cfpi: row.CFPI
                });
            }
        }
    });

    console.log('------------------------------------------------');
    console.log(`Matched Bills (linkable to user): ${matched}`);
    console.log(`Unmatched Bills (orphaned):       ${unmatched}`);
    console.log('------------------------------------------------');
    console.log('Sample Unmatched Bills (first 10):');
    console.log(JSON.stringify(unmatchedSamples, null, 2));
}

diagnose();
