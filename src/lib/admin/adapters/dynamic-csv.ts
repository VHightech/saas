import { ImportAdapter, ParseResult, ParsedBill } from './types'
import { parse } from 'csv-parse/sync'

export interface ColumnMapping {
    amount?: string
    expiry_date?: string
    issue_date?: string
    cif?: string
    cfpi?: string
    service_id?: string
    consumption?: string
    pdf_name?: string
}

export class DynamicCsvAdapter implements ImportAdapter {
    private mapping: ColumnMapping

    constructor(mapping: ColumnMapping) {
        this.mapping = mapping
    }

    async parse(
        text: string,
        cifMap: Map<string, string>,
        cfpiMap: Map<string, string>
    ): Promise<ParseResult> {
        const bills: ParsedBill[] = []
        const errors: string[] = []

        // 1. RAW Parsing Strategy
        let records: any[] = []
        try {
            const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
            const firstLine = lines[0] || ''

            // Count delimiters to detect strategy
            const delimiters = [';', ',', '\t']
            let bestDelimiter = delimiters[0]
            let maxCount = 0
            delimiters.forEach(d => {
                const count = (firstLine.match(new RegExp(`\\${d}`, 'g')) || []).length
                if (count > maxCount) {
                    maxCount = count
                    bestDelimiter = d
                }
            })

            if (maxCount === 0 && lines.length > 0) {
                // Fallback: Fixed Width Logic (Same as Client)
                const maxLen = Math.max(...lines.map(l => l.length))
                const spaceCounts = new Array(maxLen).fill(0)

                const sampleSize = Math.min(lines.length, 50)
                const analysisLines = lines.slice(0, sampleSize)

                analysisLines.forEach(line => {
                    for (let i = 0; i < maxLen; i++) {
                        if (i >= line.length || line[i] === ' ') {
                            spaceCounts[i]++
                        }
                    }
                })

                const threshold = sampleSize * 0.95
                const isGap = (i: number) => spaceCounts[i] >= threshold

                const columnRanges: { start: number, end: number }[] = []
                let inGap = true
                let colStart = -1

                for (let i = 0; i < maxLen; i++) {
                    if (!isGap(i)) {
                        if (inGap) {
                            colStart = i
                            inGap = false
                        }
                    } else {
                        if (!inGap) {
                            columnRanges.push({ start: colStart, end: i })
                            inGap = true
                        }
                    }
                }
                if (!inGap) {
                    columnRanges.push({ start: colStart, end: maxLen })
                }

                // Extract Data
                records = lines.map(line => {
                    const row: any = {}
                    columnRanges.forEach((range, idx) => {
                        const val = line.substring(range.start, range.end).trim()
                        row[`Col_${idx + 1}`] = val
                    })
                    return row
                })

            } else {
                // Standard CSV
                records = parse(text, {
                    columns: true, // Use first line as headers
                    skip_empty_lines: true,
                    trim: true,
                    relax_quotes: true,
                    delimiter: bestDelimiter,
                    from_line: 1
                })
            }
        } catch (e: any) {
            return { bills: [], errors: [`Parse Error: ${e.message}`] }
        }

        // 2. Logic Mapping
        let rowIndex = 0
        for (const row of records) {
            rowIndex++
            try {
                // Get values using mapping or fallback to standard names
                const getValue = (key: keyof ColumnMapping) => {
                    const mappedTemplate = this.mapping[key]
                    if (!mappedTemplate) return row[key] // Fallback

                    // Check for template syntax {{Column}}
                    if (mappedTemplate.includes('{{')) {
                        return mappedTemplate.replace(/\{\{(.*?)\}\}/g, (_, colName) => {
                            return row[colName.trim()] || ''
                        })
                    }

                    // Direct mapping
                    return row[mappedTemplate]
                }

                const rowCif = getValue('cif')?.trim() || null
                const rowCfpi = getValue('cfpi')?.trim() || null
                const rowAmount = getValue('amount')
                const rowExpiry = getValue('expiry_date')
                const rowConsumption = getValue('consumption')
                const pdfNameField = getValue('pdf_name') || row['NomePdf'] || row['File']

                const pdfName = pdfNameField ? pdfNameField.trim() : null
                if (!pdfName) continue

                // A. Identify User
                let userId: string | null = null
                if (rowCif && cifMap.has(rowCif)) {
                    userId = cifMap.get(rowCif)!
                } else if (rowCfpi && cfpiMap.has(rowCfpi)) {
                    userId = cfpiMap.get(rowCfpi)!
                }

                // B. Extract ID from PDF Name
                const idString = pdfName.replace(/\.[^/.]+$/, "")
                const billId = parseInt(idString)

                if (isNaN(billId)) {
                    // Fallback: If PDF name is not a number, we might need another strategy
                    // For now, skip if we can't get an ID
                    throw new Error(`Invalid PDF name format for ID: ${pdfName}`)
                }

                // C. Parsers
                const parseDate = (d: any) => {
                    if (!d || d.toString().toLowerCase() === 'nessuna' || d.toString().trim() === '') return null
                    const dateStr = d.toString().trim()

                    // Try DD/MM/YYYY
                    if (dateStr.includes('/')) {
                        const parts = dateStr.split('/')
                        if (parts.length === 3) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
                    }

                    // Try YYYY-MM-DD
                    const isoDate = new Date(dateStr)
                    return isNaN(isoDate.getTime()) ? null : isoDate
                }

                const parseNumber = (n: any) => {
                    if (n === undefined || n === null) return 0
                    const str = n.toString().trim()
                    // Handle Italian format (1.234,56) vs US (1,234.56)
                    const clean = str.replace(/\./g, '').replace(',', '.')
                    return parseFloat(clean) || 0
                }

                bills.push({
                    idboll: billId,
                    user_id: userId,
                    cfpi: rowCfpi,
                    codice_cliente: rowCif || '',
                    nome_pdf: pdfName,
                    tipo_servizio: row['TipoServizio'] || row['Service'] || '',
                    data_emissione: parseDate(getValue('issue_date')),
                    scadenza: parseDate(rowExpiry),
                    importo: parseNumber(rowAmount),
                    consumo: parseNumber(rowConsumption),
                    cif: rowCif,
                    original_row_index: rowIndex
                })

            } catch (err) {
                errors.push(`Row ${rowIndex}: ${err}`)
            }
        }

        return { bills, errors }
    }
}
