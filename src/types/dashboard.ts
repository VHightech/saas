export interface Bill {
    id: number
    data_emissione: string
    scadenza: string
    importo: number
    consumo: number
    cif: string
    codice_cliente: string
    nome_pdf: string
    pdf_url?: string
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
}

export interface UploadLog {
    id: string
    status: string
    processed_files: number
    total_files: number
    created_at: string
}
