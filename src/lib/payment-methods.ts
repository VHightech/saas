// Codici metodo di pagamento (standard Agenzia delle Entrate / SDI) usati nelle
// bollette importate da Acquambiente. Il campo `expected_method` arriva dal CSV
// come codice grezzo (es. 'MP01'); qui lo mappiamo all'etichetta leggibile per
// mostrarla in chiaro accanto al codice nell'area admin.

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
    MP01: 'Contanti',
    MP03: 'Assegno circolare',
    MP05: 'Bonifico',
    MP18: 'Bollettino di c/c postale',
    MP20: 'SEPA Direct Debit Core',
    MP23: 'PagoPA',
}

/** Etichetta leggibile per un codice metodo di pagamento. Stringa vuota se ignoto. */
export function paymentMethodLabel(code: string | null | undefined): string {
    if (!code) return ''
    return PAYMENT_METHOD_LABELS[code.trim().toUpperCase()] ?? ''
}

/**
 * Forma compatta "CODICE — Etichetta" (es. "MP01 — Contanti").
 * Se il codice è ignoto restituisce solo il codice; se assente restituisce "—".
 */
export function formatPaymentMethod(code: string | null | undefined): string {
    if (!code) return '—'
    const normalized = code.trim().toUpperCase()
    const label = paymentMethodLabel(normalized)
    return label ? `${normalized} — ${label}` : normalized
}
