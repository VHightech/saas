import { ImportAdapter, ParseResult, ParsedBill } from './types'
import { parse } from 'csv-parse/sync'

/**
 * Normalize the CSV document-type label (column 9, or column 8 in the legacy
 * layout) into the value stored in bills.billing_type.
 *
 * Rule (product, 2026-06-25): plain SALDO → 'S', plain ACCONTO → 'A'; every
 * other type is stored VERBATIM (whitespace-collapsed, uppercased) so the full
 * document type is preserved — e.g. 'SALDO E CONGUAGLIO', 'ACCONTO E CONGUAGLIO',
 * 'SALDO FINALE', 'SALDO FINALE E CONGUAGLIO', 'NOTA DI CREDITO'.
 * Returns null for empty/unknown so we never invent a type.
 */
export function normalizeBillingType(raw: string | null): string | null {
    if (!raw) return null
    const v = raw.trim().replace(/\s+/g, ' ').toUpperCase()
    if (!v) return null
    if (v === 'SALDO') return 'S'
    if (v === 'ACCONTO') return 'A'
    return v
}

export class StandardCsvAdapter implements ImportAdapter {
    async parse(
        text: string,
    ): Promise<ParseResult> {
        const bills: ParsedBill[] = []
        const errors: string[] = []

        // 1. RAW CSV Parsing - ARRAY MODE
        let rawRecords: any[][] = []
        try {
            rawRecords = parse(text, {
                columns: false, // Read as arrays [col0, col1, ...]
                skip_empty_lines: true,
                trim: true,
                relax_quotes: true,
                relax_column_count: true,
                delimiter: ';',
            })
        } catch (e: any) {
            return { bills: [], errors: [`CSV Parse Error: ${e.message}`] }
        }

        console.log(`[CSV Adapter] Raw Rows: ${rawRecords.length}`)
        if (rawRecords.length === 0) return { bills: [], errors: [] }

        // 2. Strict Mapping based on User Configuration
        // CIF (0); CFPIVA(1); NOMEPDF(2); SERVIZIO(3); EMISSIONE(4); SCADENZA(5); IMPORTO(6); CONSUMO(7)
        const IDX = {
            CIF: 0,
            CFPI: 1,
            PDF: 2,
            TIPO: 3,
            EMISS: 4,
            SCAD: 5,
            IMP: 6,
            CONS: 7
        }

        console.log(`[CSV Mapping] Using Strict Mapping: CIF=${IDX.CIF}, PDF=${IDX.PDF}`)

        // Debug first row
        if (rawRecords.length > 0) {
            console.log(`[CSV Adapter] First Row Data: ${JSON.stringify(rawRecords[0])}`)
        }

        let rowIndex = 0
        let skippedCount = 0

        for (const row of rawRecords) {
            rowIndex++
            try {
                // Skip if row is too short
                if (row.length < 3) {
                    skippedCount++
                    continue
                }

                // If header row detected (contains "NomePdf" or similar), skip
                if (row[IDX.PDF] && row[IDX.PDF].toLowerCase().includes('nome')) continue

                const normalize = (val: string) => val ? val.trim() : null

                const pdfName = normalize(row[IDX.PDF])

                // CRITICAL SAFETY: Validate PDF column looks like PDF
                if (!pdfName || !pdfName.toLowerCase().endsWith('.pdf')) {
                    // console.warn(`Row ${rowIndex} skipped: Col ${IDX.PDF} ('${pdfName}') is not a PDF.`)
                    skippedCount++
                    continue
                }

                const rowCif = normalize(row[IDX.CIF])
                const rowCfpi = normalize(row[IDX.CFPI])
                const rowTipo = normalize(row[IDX.TIPO])
                const rowDataEm = normalize(row[IDX.EMISS])
                const rowScad = normalize(row[IDX.SCAD])
                const rowImp = normalize(row[IDX.IMP])
                const rowCons = normalize(row[IDX.CONS])

                // Payment Method (MPxx) and document Type label. Layouts seen:
                //   • index 8 = MPxx method, index 9 = type label
                //   • index 8 = empty (e.g. €0,00 bills with no method), index 9 = type label
                //   • legacy: index 8 = type label, no index 9
                const raw8 = row.length > 8 ? normalize(row[8]) : null
                const raw9 = row.length > 9 ? normalize(row[9]) : null

                const paymentMethod = raw8 && raw8.toUpperCase().startsWith('MP')
                    ? raw8.toUpperCase()
                    : null

                // The type label is in index 9 when present; otherwise index 8 holds
                // it (legacy layout where col 8 isn't a method). Crucially this no
                // longer depends on col 8 being a method, so €0,00 bills (empty col 8)
                // keep their col 9 type instead of dropping it.
                const rawTypeLabel = raw9 ?? (paymentMethod ? null : raw8)

                const paymentType = normalizeBillingType(rawTypeLabel)

                // Code Client logic
                let clientCode = ''
                if (rowCif && rowCif.length >= 6) {
                    clientCode = rowCif.substring(0, 6)
                }

                // ulm is a generated column in Postgres (right(cif, 6)); no need to set here.

                // Extract ID from PDF Name
                const idString = pdfName.replace(/\.[^/.]+$/, "")
                const billId = parseInt(idString)

                if (isNaN(billId)) {
                    // throw new Error(`Invalid PDF name format: ${pdfName}`)
                }

                const parseDate = (d: string | null) => {
                    if (!d || d.toLowerCase() === 'nessuna' || d.trim() === '') return null
                    const parts = d.split('/')
                    if (parts.length === 3) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
                    return null
                }

                const parseNumber = (n: string | null) => {
                    if (!n) return 0
                    const clean = n.replace(/\./g, '').replace(',', '.')
                    return parseFloat(clean) || 0
                }

                bills.push({
                    idboll: isNaN(billId) ? null : billId,
                    user_id: null,
                    cfpi: rowCfpi,
                    codice_cliente: clientCode,
                    nome_pdf: pdfName,
                    tipo_servizio: rowTipo || '',
                    data_emissione: parseDate(rowDataEm),
                    scadenza: parseDate(rowScad),
                    importo: parseNumber(rowImp),
                    consumo: parseNumber(rowCons),
                    cif: rowCif,
                    billing_type: paymentType,
                    expected_method: paymentMethod,
                    original_row_index: rowIndex
                } as any) // Cast as any because we'll update types later

            } catch (err) {
                errors.push(`Row ${rowIndex}: ${err}`)
            }
        }

        if (bills.length === 0 && rawRecords.length > 0) {
            errors.push(`WARNING: All ${rawRecords.length} rows were skipped. Check if PDF column (Index 2) is correct.`)
            console.error(`[CSV Parsing] All rows skipped. Sample Ind 2: ${rawRecords[0]?.[2]}`)
        }

        return { bills, errors }
    }
}
