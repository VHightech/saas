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
     * Parse raw file content (CSV) into normalized bills. Bills are returned with
     * `user_id: null`; ownership resolution (CIF/codice_cliente → profile) happens
     * downstream in the import route, not in the adapter.
     */
    parse(fileContent: string): Promise<ParseResult>
}
