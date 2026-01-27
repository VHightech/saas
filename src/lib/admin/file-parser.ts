export type ParsedFileInfo = {
    originalName: string
    identifier: string | null // CF or Client Code found
    type: 'CF' | 'CLIENT_CODE' | 'UNKNOWN'
    docType: string // e.g., "Bolletta", "Contratto"
    isValid: boolean
}

export function parseFileName(filename: string): ParsedFileInfo {
    // Logic: expects patterns like "CF_RSSMRA80A01H501U_2023.pdf" or "CC_123456_Bolletta.pdf"
    // Simple Mock Regex

    const cfRegex = /([A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z])/i
    const clientCodeRegex = /(?:ID|CC)_(\d{6})/i

    let identifier: string | null = null
    let type: 'CF' | 'CLIENT_CODE' | 'UNKNOWN' = 'UNKNOWN'

    const cfMatch = filename.match(cfRegex)
    if (cfMatch) {
        identifier = cfMatch[1].toUpperCase()
        type = 'CF'
    } else {
        const ccMatch = filename.match(clientCodeRegex)
        if (ccMatch) {
            identifier = ccMatch[1]
            type = 'CLIENT_CODE'
        }
    }

    // Guess Doc Type
    const nameLower = filename.toLowerCase()
    let docType = 'Documento Generico'
    if (nameLower.includes('bolletta')) docType = 'Bolletta'
    if (nameLower.includes('contratto')) docType = 'Contratto'
    if (nameLower.includes('fattura')) docType = 'Fattura'

    return {
        originalName: filename,
        identifier,
        type,
        docType,
        isValid: !!identifier
    }
}
