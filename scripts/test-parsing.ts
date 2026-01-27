
import { parse } from 'csv-parse/sync';

const dummyCsv = `cif;nominativo;Codice Fiscale;Partita Iva;indirizzo utenza;Comune
CIF001;Mario Rossi;CF12345;;Via Roma 1;Milano
CIF002;Azienda SRL;;PI12345;Via Verdi 2;Torino
CIF003;Luigi Bianchi;CF67890;PI67890;;
`;

console.log('--- Testing CSV Parsing ---');

const records = parse(dummyCsv, {
    columns: true,
    delimiter: ';',
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true
});

console.log(`Parsed ${records.length} records.`);

records.forEach((row: any, index: number) => {
    console.log(`\nRow ${index + 1}:`);
    console.log(`Raw:`, row);

    // Logic from ingest-fresh-v2.ts
    const cif = row['cif'];
    const nominativo = row['nominativo'];
    const cf = row['Codice Fiscale'];
    const piva = row['Partita Iva'];
    const address = row['indirizzo utenza'];
    const city = row['Comune'];

    const cfpi = cf || piva;

    const mapped = {
        cif,
        name: nominativo,
        cfpi,
        address,
        city
    };
    console.log('Mapped:', mapped);
});
