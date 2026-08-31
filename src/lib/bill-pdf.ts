/**
 * Convenzione di naming dei PDF delle bollette, in un unico posto.
 *
 * Il gestionale esporta ogni PDF come `<idboll>.pdf` e non è negoziabile lato
 * nostro (confermato dal committente, 2026-08-31; verificato su tutte le 298.231
 * righe: 0 eccezioni). Per questo `bills.nome_pdf` è stata rimossa: il nome è
 * derivabile da `idboll`, che è UNIQUE e quindi già indicizzato.
 *
 * Modulo puro, senza dipendenze Node: importabile sia dai componenti client sia
 * dagli script di import.
 */

/** `<idboll>.pdf` — il nome con cui l'utente scarica la bolletta. */
export function pdfNameForIdboll(idboll: number | string): string {
    return `${idboll}.pdf`
}

/**
 * idboll a partire dal nome di un file PDF. STRETTO di proposito: solo la forma
 * canonica `<cifre>.pdf` restituisce un numero.
 *
 * Un `parseInt` permissivo farebbe agganciare `0123.pdf` o `123abc.pdf` alla
 * bolletta 123, cioè attaccherebbe il file sbagliato a una bolletta vera — e
 * `pdf_url` è la chiave reale su R2, quindi il download mostrerebbe il PDF di un
 * altro cliente. Meglio non agganciare e segnalarlo.
 */
export function idbollFromPdfName(filename: string): number | null {
    const m = /^(\d+)\.pdf$/i.exec(filename.trim())
    if (!m) return null
    const n = Number.parseInt(m[1], 10)
    // String(n) === m[1] scarta anche gli zeri iniziali: `0123.pdf` non è il file
    // della bolletta 123, quindi non deve agganciarla.
    return Number.isSafeInteger(n) && n > 0 && String(n) === m[1] ? n : null
}
