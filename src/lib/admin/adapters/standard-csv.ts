import { ImportAdapter, ParseResult, ParsedBill } from './types'
import { parse } from 'csv-parse/sync'

interface StandardCSVRow {
    CIF: string
    CFPI: string
    NomePdf: string
    TipoServizio: string
    DataEmissione: string
    Scadenza: string
    Importo: string
    Consumo: string
}

export class StandardCsvAdapter implements ImportAdapter {
    async parse(
        text: string,
        cifMap: Map<string, string>,
        cfpiMap: Map<string, string>
    ): Promise<ParseResult> {
        const bills: ParsedBill[] = []
        const errors: string[] = []

        // 1. RAW CSV Parsing
        let records: StandardCSVRow[] = []
        try {
            records = parse(text, {
                columns: ['CIF', 'CFPI', 'NomePdf', 'TipoServizio', 'DataEmissione', 'Scadenza', 'Importo', 'Consumo'],
                skip_empty_lines: true,
                trim: true,
                relax_quotes: true,
                delimiter: ';',
                from_line: 1
            })
        } catch (e: any) {
            return { bills: [], errors: [`CSV Parse Error: ${e.message}`] }
        }

        // 2. Logic Mapping
        let rowIndex = 0
        for (const row of records) {
            rowIndex++
            try {
                const rowCif = row.CIF ? row.CIF.trim() : null
                const rowCfpi = row.CFPI ? row.CFPI.trim() : null
                const pdfName = row.NomePdf ? row.NomePdf.trim() : null

                if (!pdfName) continue

                // A. Identify User (Priority: CIF)
                let userId: string | null = null

                if (rowCif && cifMap.has(rowCif)) {
                    userId = cifMap.get(rowCif)!
                } else if (rowCfpi && cfpiMap.has(rowCfpi)) {
                    userId = cfpiMap.get(rowCfpi)!
                }

                // B. Extract ID from PDF Name
                // "123.pdf" -> 123
                const idString = pdfName.replace(/\.[^/.]+$/, "")
                const billId = parseInt(idString)

                if (isNaN(billId)) {
                    throw new Error(`Invalid PDF name format for ID: ${pdfName}`)
                }

                // C. Parse Dates
                const parseDate = (d: string) => {
                    if (!d || d.toLowerCase() === 'nessuna' || d.trim() === '') return null
                    const parts = d.split('/')
                    if (parts.length !== 3) return null
                    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
                }

                const parseNumber = (n: string) => {
                    if (!n) return 0
                    const clean = n.replace(/\./g, '').replace(',', '.')
                    return parseFloat(clean) || 0
                }

                bills.push({
                    id: billId,
                    user_id: userId,
                    cfpi: rowCfpi,
                    codice_cliente: '',
                    nome_pdf: pdfName,
                    tipo_servizio: row.TipoServizio,
                    data_emissione: parseDate(row.DataEmissione),
                    scadenza: parseDate(row.Scadenza),
                    importo: parseNumber(row.Importo),
                    consumo: parseNumber(row.Consumo),
                    cif: rowCif,
                    original_row_index: rowIndex
                })

            } catch (err) {
                errors.push(`Row ${rowIndex} (${row.CFPI || '?'}): ${err}`)
            }
        }

        return { bills, errors }
    }
}
