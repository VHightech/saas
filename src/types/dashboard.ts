export interface Bill {
    id: number
    data_emissione: string
    scadenza: string
    data_scadenza?: string
    importo: number
    amount?: string
    consumo: number
    cif: string
    codice_cliente: string
    nome_pdf: string
    pdf_url?: string
    ulm?: string
    pdr?: string
    codice_ulm?: string
    tipo_servizio?: string
    original_row_index?: number
    idboll?: number
    billing_type?: string
    status?: 'paid' | 'unpaid' | string
    expected_method?: string
}

export interface Profile {
    id: string
    name?: string

    full_name?: string
    email?: string
    role?: string
    username?: string
    codice_cliente?: string
    address?: string
    city?: string
    phone?: string
}

export interface UploadLog {
    id: string
    status: string
    processed_files: number
    total_files: number
    created_at: string
}

export interface UserSupply {
    codice_cliente?: string
    cif?: string
    address?: string
    city?: string
    ulm?: string
    [key: string]: any
}
