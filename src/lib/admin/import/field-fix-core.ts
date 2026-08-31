/**
 * Correzione di UN SOLO campo delle bollette già importate, a partire dai CSV
 * rigenerati dal gestionale.
 *
 * Nasce dal caso `consumo` (2026-08-31: campo sbagliato in tutti e tre gli anni
 * di export) e serve a non dover più cancellare/reimportare un batch — operazione
 * che scollegherebbe i PDF già su R2 — quando è solo un campo a essere sbagliato.
 *
 * Invarianti di sicurezza:
 *   - match esclusivamente su bills.idboll (UNIQUE, derivato dal nome PDF)
 *   - si scrive UNA sola colonna, scelta da FIXABLE_FIELDS: mai le chiavi e mai
 *     i campi che tengono insieme storage e collegamenti (vedi BLOCKED_FIELDS)
 *   - solo UPDATE ... WHERE idboll IN (...): nessun INSERT, nessun DELETE
 *   - guardia su nome_pdf: se CSV e DB non concordano per lo stesso idboll la
 *     riga viene scartata (protegge da CSV con layout colonne diverso)
 *   - valore CSV vuoto → riga saltata, a meno di allowEmpty: un export incompleto
 *     non può azzerare dati buoni
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse/sync'
import { CSV_INDEX, normalizeBillingType, resolveTypeAndMethod } from '@/lib/admin/adapters/standard-csv'
import { chunked, readCsvText } from './helpers'

export const FIX_CHUNK = 500

export type DbValue = string | number | null
export type FieldKind = 'number' | 'date' | 'text'

export interface FieldSpec {
    /** Nome della colonna su public.bills — l'unica che verrà scritta. */
    key: string
    label: string
    kind: FieldKind
    /** Colonna CSV di origine; 'cols 8/9' per i campi risolti dalla coppia. */
    source: 'column' | 'method' | 'type'
    column?: number
    hint: string
}

/** I soli campi correggibili. Ogni altra colonna di bills è fuori portata. */
export const FIXABLE_FIELDS: readonly FieldSpec[] = [
    { key: 'consumo', label: 'consumo (mc)', kind: 'number', source: 'column', column: CSV_INDEX.CONS, hint: `colonna CSV [${CSV_INDEX.CONS}]` },
    { key: 'importo', label: 'importo (euro)', kind: 'number', source: 'column', column: CSV_INDEX.IMP, hint: `colonna CSV [${CSV_INDEX.IMP}]` },
    { key: 'data_emissione', label: 'data emissione', kind: 'date', source: 'column', column: CSV_INDEX.EMISS, hint: `colonna CSV [${CSV_INDEX.EMISS}]` },
    { key: 'scadenza', label: 'scadenza', kind: 'date', source: 'column', column: CSV_INDEX.SCAD, hint: `colonna CSV [${CSV_INDEX.SCAD}]` },
    { key: 'tipo_servizio', label: 'tipo servizio', kind: 'text', source: 'column', column: CSV_INDEX.TIPO, hint: `colonna CSV [${CSV_INDEX.TIPO}]` },
    { key: 'billing_type', label: 'tipo documento (S/A/…)', kind: 'text', source: 'type', hint: 'colonne CSV [9] o [8]' },
    { key: 'expected_method', label: 'metodo previsto (MPxx)', kind: 'text', source: 'method', hint: 'colonna CSV [8]' },
] as const

/** Colonne volutamente non correggibili, con il motivo mostrato all'utente. */
export const BLOCKED_FIELDS: Readonly<Record<string, string>> = {
    id: 'chiave primaria',
    idboll: 'chiave di match: se cambia, si perde la bolletta',
    nome_pdf: 'nome del file su R2: fa da guardia al match',
    pdf_url: 'percorso oggetto su R2: cambiarlo scollega il PDF',
    import_log_id: 'FK sul batch di import (ON DELETE CASCADE)',
    user_id: 'collegamento al cliente: si rifà con il mass-link, non da CSV',
    cif: 'da cui deriva la colonna generata ulm',
    ulm: 'colonna generata da Postgres',
    codice_cliente: 'usato per agganciare la bolletta al profilo',
    status: 'stato di pagamento: lo governa il trigger dei payments',
    created_at: 'metadato di sistema',
}

export function getFieldSpec(key: string): FieldSpec | undefined {
    return FIXABLE_FIELDS.find((f) => f.key === key.trim().toLowerCase())
}

export function fieldChoiceLabels(): string[] {
    return FIXABLE_FIELDS.map((f) => `${f.key} — ${f.label}  (${f.hint})`)
}

export function parseRawCsv(text: string): string[][] {
    return parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text, {
        columns: false,
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true,
        relax_column_count: true,
        delimiter: ';',
    }) as string[][]
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** '1.234,56' → 1234.56. Restituisce null su valore vuoto o non numerico. */
function toNumber(raw: string): number | null {
    const clean = raw.replace(/\./g, '').replace(',', '.')
    const n = Number.parseFloat(clean)
    return Number.isFinite(n) ? round2(n) : null
}

/** 'gg/mm/aaaa' → 'aaaa-mm-gg'. Null su vuoto / 'nessuna' / formato ignoto. */
function toIsoDate(raw: string): string | null {
    if (raw.toLowerCase() === 'nessuna') return null
    const parts = raw.split('/')
    if (parts.length !== 3) return null
    const [d, m, y] = parts.map((p) => p.trim())
    if (!/^\d{1,2}$/.test(d) || !/^\d{1,2}$/.test(m) || !/^\d{4}$/.test(y)) return null
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

/** Valore CSV da scrivere sulla colonna, già normalizzato. Null = vuoto. */
export function csvValueFor(spec: FieldSpec, row: string[]): DbValue {
    if (spec.source === 'method') return resolveTypeAndMethod(row).expected_method
    if (spec.source === 'type') return resolveTypeAndMethod(row).billing_type

    const raw = (row[spec.column!] ?? '').trim()
    if (!raw) return null
    if (spec.kind === 'number') return toNumber(raw)
    if (spec.kind === 'date') return toIsoDate(raw)
    return spec.key === 'billing_type' ? normalizeBillingType(raw) : raw
}

/** Valore a DB normalizzato nella stessa forma, per un confronto sensato. */
export function dbValueFor(spec: FieldSpec, raw: unknown): DbValue {
    if (raw === null || raw === undefined || raw === '') return null
    if (spec.kind === 'number') {
        const n = Number(raw)
        return Number.isFinite(n) ? round2(n) : null
    }
    if (spec.kind === 'date') return String(raw).slice(0, 10)
    return String(raw).trim() || null
}

export function sameValue(a: DbValue, b: DbValue): boolean {
    if (a === null || b === null) return a === b
    return a === b
}

export interface FieldChange {
    idboll: number
    from: DbValue
    to: DbValue
}

interface Want {
    value: DbValue
    nome_pdf: string
    file: string
}

export interface FieldFixOptions {
    /** true = scrive NULL dove il CSV è vuoto. Default false (riga saltata). */
    allowEmpty?: boolean
    /** true = a parità di idboll vince l'ultimo file letto. Default: si esclude. */
    lastWins?: boolean
    onFile?: (file: string, rows: number) => void
    onProgress?: (done: number, total: number, changes: number) => void
}

export interface FieldFixAnalysis {
    spec: FieldSpec
    rowsRead: number
    skippedNoPdf: number
    skippedEmptyCsv: number
    uniqueIds: number
    conflictCount: number
    conflictSamples: string[]
    dbTotal: number
    matched: number
    missingInDb: number[]
    pdfMismatchCount: number
    pdfMismatchSamples: string[]
    unchanged: number
    changes: FieldChange[]
}

/** Legge i CSV e costruisce idboll → valore desiderato per il campo scelto. */
function collectWants(files: string[], spec: FieldSpec, opts: FieldFixOptions) {
    const wants = new Map<number, Want>()
    const conflictIds = new Set<number>()
    const conflictSamples: string[] = []
    let rowsRead = 0
    let skippedNoPdf = 0
    let skippedEmptyCsv = 0

    for (const file of files) {
        const rows = parseRawCsv(readCsvText(file))
        const label = file.split(/[\\/]/).pop() ?? file
        let kept = 0

        for (const row of rows) {
            rowsRead++
            const pdfName = (row[CSV_INDEX.PDF] ?? '').trim()
            if (!pdfName || !pdfName.toLowerCase().endsWith('.pdf')) { skippedNoPdf++; continue }
            const idboll = Number.parseInt(pdfName.replace(/\.[^/.]+$/, ''), 10)
            if (!Number.isFinite(idboll) || idboll <= 0) { skippedNoPdf++; continue }

            const value = csvValueFor(spec, row)
            if (value === null && !opts.allowEmpty) { skippedEmptyCsv++; continue }

            const prev = wants.get(idboll)
            if (prev && !sameValue(prev.value, value)) {
                conflictIds.add(idboll)
                if (conflictSamples.length < 20) {
                    conflictSamples.push(`idboll ${idboll}: ${String(prev.value)} (${prev.file}) vs ${String(value)} (${label})`)
                }
                if (!opts.lastWins) continue
            }
            wants.set(idboll, { value, nome_pdf: pdfName, file: label })
            kept++
        }
        opts.onFile?.(label, kept)
    }

    if (!opts.lastWins) for (const id of conflictIds) wants.delete(id)
    return { wants, conflictIds, conflictSamples, rowsRead, skippedNoPdf, skippedEmptyCsv }
}

export async function analyzeFieldFix(
    sb: SupabaseClient,
    files: string[],
    spec: FieldSpec,
    opts: FieldFixOptions = {},
): Promise<FieldFixAnalysis> {
    if (!getFieldSpec(spec.key)) throw new Error(`Campo non correggibile: ${spec.key}`)

    const c = collectWants(files, spec, opts)
    const ids = [...c.wants.keys()]

    const { count: dbTotal } = await sb.from('bills').select('*', { count: 'exact', head: true })

    const changes: FieldChange[] = []
    const found = new Set<number>()
    const pdfMismatchSamples: string[] = []
    let pdfMismatchCount = 0
    let unchanged = 0
    let done = 0

    await chunked(ids, FIX_CHUNK, async (chunk) => {
        const { data, error } = await sb
            .from('bills')
            .select(`idboll, nome_pdf, ${spec.key}`)
            .in('idboll', chunk)
        if (error) throw new Error(`Lettura bills: ${error.message}`)

        // Il campo è dinamico, quindi PostgREST non può tipizzare la select.
        for (const row of (data ?? []) as unknown as Array<Record<string, unknown>>) {
            const idboll = Number(row.idboll)
            const want = c.wants.get(idboll)
            if (!want) continue
            found.add(idboll)

            const dbPdf = row.nome_pdf ? String(row.nome_pdf) : ''
            if (want.nome_pdf && dbPdf && want.nome_pdf !== dbPdf) {
                pdfMismatchCount++
                if (pdfMismatchSamples.length < 20) {
                    pdfMismatchSamples.push(`idboll ${idboll}: CSV "${want.nome_pdf}" vs DB "${dbPdf}"`)
                }
                continue
            }

            const from = dbValueFor(spec, row[spec.key])
            if (sameValue(from, want.value)) { unchanged++; continue }
            changes.push({ idboll, from, to: want.value })
        }
        done += chunk.length
        opts.onProgress?.(Math.min(done, ids.length), ids.length, changes.length)
    })

    return {
        spec,
        rowsRead: c.rowsRead,
        skippedNoPdf: c.skippedNoPdf,
        skippedEmptyCsv: c.skippedEmptyCsv,
        uniqueIds: c.wants.size,
        conflictCount: c.conflictIds.size,
        conflictSamples: c.conflictSamples,
        dbTotal: dbTotal ?? 0,
        matched: found.size,
        missingInDb: ids.filter((id) => !found.has(id)),
        pdfMismatchCount,
        pdfMismatchSamples,
        unchanged,
        changes,
    }
}

/**
 * Scrive le modifiche raggruppando per valore: un UPDATE per (valore, blocco di
 * 500 idboll). Nessun INSERT, quindi nessun rischio di creare righe vuote, e
 * nessuna colonna toccata oltre spec.key.
 */
export async function applyFieldFix(
    sb: SupabaseClient,
    spec: FieldSpec,
    changes: readonly FieldChange[],
    onProgress?: (group: number, groups: number, updated: number) => void,
): Promise<{ updated: number; errors: string[] }> {
    if (!getFieldSpec(spec.key)) throw new Error(`Campo non correggibile: ${spec.key}`)

    const byValue = new Map<string, { value: DbValue; ids: number[] }>()
    for (const ch of changes) {
        const k = JSON.stringify(ch.to)
        const entry = byValue.get(k) ?? { value: ch.to, ids: [] }
        entry.ids.push(ch.idboll)
        byValue.set(k, entry)
    }

    const errors: string[] = []
    let updated = 0
    let group = 0

    for (const { value, ids } of byValue.values()) {
        group++
        await chunked(ids, FIX_CHUNK, async (chunk) => {
            const { error } = await sb
                .from('bills')
                .update({ [spec.key]: value })
                .in('idboll', chunk)
            if (error) errors.push(`${spec.key}=${String(value)} (${chunk.length} id): ${error.message}`)
            else updated += chunk.length
        })
        onProgress?.(group, byValue.size, updated)
    }

    return { updated, errors }
}
