export interface ParsedBill {
    idboll: number | null // Numero bolletta (from PDF filename)
    user_id: string | null // Resolved from CIF/CFPI lookup
    cfpi: string | null
    codice_cliente: string
    nome_pdf: string
    tipo_servizio: string
    data_emissione: Date | null
    scadenza: Date | null
    importo: number
    consumo: number
    cif: string | null
    billing_type?: string | null   // 'S' (saldo) | 'A' (acconto) — from CSV
    expected_method?: string | null // 'MP01', 'MP23', ... — from CSV
    original_row_index?: number
}

export interface ParseResult {
    bills: ParsedBill[]
    errors: string[]
}

export interface ImportAdapter {
    /**
     * Parses a buffer (CSV/XML/Excel) into normalized Bill objects.
     * @param buffer File content
     * @param options Dictionary of lookup maps (e.g. CIF -> UserID) to help resolution
     */
    parse(
        fileContent: string,
        cifMap: Map<string, string>,
        cfpiMap: Map<string, string>
    ): Promise<ParseResult>
}
