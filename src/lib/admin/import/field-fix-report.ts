/**
 * Report e rollback per la correzione di un singolo campo (field-fix-core).
 *
 * Prima di ogni scrittura viene salvato su tmp/ un CSV con i valori ATTUALI
 * (`idboll,<campo>`): è il rollback, riapplicabile così com'è per tornare
 * indietro. Un secondo CSV elenca il prima/dopo per il controllo a mano.
 */
import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'csv-parse/sync'
import {
    getFieldSpec,
    type DbValue,
    type FieldChange,
    type FieldFixAnalysis,
    type FieldSpec,
} from './field-fix-core'

/** Doppio apice raddoppiato + quoting solo dove serve; null → campo vuoto. */
function csvCell(v: DbValue): string {
    if (v === null) return ''
    const s = String(v)
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function timestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
}

export interface FixReportPaths {
    rollback: string
    diff: string
}

export function writeFixReports(
    outDir: string,
    spec: FieldSpec,
    changes: readonly FieldChange[],
): FixReportPaths {
    fs.mkdirSync(outDir, { recursive: true })
    const ts = timestamp()
    const rollback = path.join(outDir, `${spec.key}-rollback-${ts}.csv`)
    const diff = path.join(outDir, `${spec.key}-changes-${ts}.csv`)

    fs.writeFileSync(
        rollback,
        `idboll,${spec.key}\n` + changes.map((c) => `${c.idboll},${csvCell(c.from)}`).join('\n') + '\n',
        'utf8',
    )
    fs.writeFileSync(
        diff,
        `idboll,${spec.key}_attuale,${spec.key}_nuovo\n` +
            changes.map((c) => `${c.idboll},${csvCell(c.from)},${csvCell(c.to)}`).join('\n') + '\n',
        'utf8',
    )
    return { rollback, diff }
}

/** Anteprima testuale condivisa da `npm run import` (opzione 4) e dalla CLI. */
export function formatFieldFixPreview(a: FieldFixAnalysis): string {
    const changes = a.changes
    const dec = changes.filter((c) => c.to !== null && c.from !== null && c.to < c.from).length
    const emptied = changes.filter((c) => c.to === null).length
    const filled = changes.filter((c) => c.from === null && c.to !== null).length
    const lines: string[] = []

    lines.push(`
— Anteprima correzione "${a.spec.key}" (${a.spec.label}, ${a.spec.hint}) —
  Righe CSV lette:            ${a.rowsRead}
  Scartate (no PDF/idboll):   ${a.skippedNoPdf}
  Valore CSV vuoto (saltate): ${a.skippedEmptyCsv}
  idboll univoci nel CSV:     ${a.uniqueIds}
  Bollette a DB (totale):     ${a.dbTotal}
  Trovate a DB dal CSV:       ${a.matched}
  Non presenti a DB:          ${a.missingInDb.length}   (NON verranno create)
  Non coperte dal CSV:        ${a.dbTotal - a.matched}   (restano col valore attuale)
  nome_pdf discordante:       ${a.pdfMismatchCount}   (scartate per sicurezza)
  Valore già corretto:        ${a.unchanged}
  DA AGGIORNARE:              ${changes.length}${a.spec.kind === 'number' ? `   (in calo ${dec} / in aumento ${changes.length - dec - emptied - filled})` : ''}
    da vuoto a valore:        ${filled}
    a vuoto (NULL):           ${emptied}`)

    if (a.conflictCount > 0) {
        lines.push(`\n[!] idboll con valori discordanti fra i file: ${a.conflictCount}`)
        lines.push(a.conflictSamples.map((s) => '    ' + s).join('\n'))
    }
    if (a.pdfMismatchSamples.length > 0) {
        lines.push('\nEsempi nome_pdf discordante:')
        lines.push(a.pdfMismatchSamples.map((s) => '    ' + s).join('\n'))
    }
    if (a.missingInDb.length > 0) {
        lines.push(`\nEsempi idboll assenti a DB: ${a.missingInDb.slice(0, 15).join(', ')}`)
    }
    if (changes.length > 0) {
        const top = [...changes]
            .sort((x, y) => Math.abs(Number(y.to ?? 0) - Number(y.from ?? 0)) - Math.abs(Number(x.to ?? 0) - Number(x.from ?? 0)))
            .slice(0, 10)
        lines.push('\nEsempi (scostamenti maggiori):')
        for (const c of top) lines.push(`    idboll ${c.idboll}: ${c.from ?? '(vuoto)'} -> ${c.to ?? '(vuoto)'}`)
    }
    return lines.join('\n') + '\n'
}

/**
 * Rilegge un rollback prodotto da writeFixReports. Il campo da ripristinare si
 * ricava dall'intestazione, così non si può applicare un rollback alla colonna
 * sbagliata.
 */
export function readRollback(file: string): { spec: FieldSpec; changes: FieldChange[] } {
    const rows = parse(fs.readFileSync(path.resolve(file), 'utf8'), {
        columns: false,
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true,
        relax_column_count: true,
        delimiter: ',',
    }) as string[][]

    if (rows.length === 0) throw new Error('File di rollback vuoto')
    const [head, key] = rows[0]
    if (head?.trim().toLowerCase() !== 'idboll') {
        throw new Error(`Intestazione inattesa: atteso "idboll,<campo>", trovato "${rows[0].join(',')}"`)
    }
    const spec = getFieldSpec(key ?? '')
    if (!spec) throw new Error(`Campo non correggibile o sconosciuto nell'intestazione: "${key}"`)

    const changes: FieldChange[] = []
    for (const row of rows.slice(1)) {
        const idboll = Number.parseInt(row[0], 10)
        if (!Number.isFinite(idboll)) continue
        const raw = (row[1] ?? '').trim()
        const to: DbValue = raw === '' ? null : spec.kind === 'number' ? Number(raw) : raw
        if (spec.kind === 'number' && to !== null && !Number.isFinite(to as number)) continue
        changes.push({ idboll, from: null, to })
    }
    return { spec, changes }
}
