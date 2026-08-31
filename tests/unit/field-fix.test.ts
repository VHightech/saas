import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
    applyFieldFix,
    BLOCKED_FIELDS,
    csvValueFor,
    dbValueFor,
    FIX_CHUNK,
    getFieldSpec,
    parseRawCsv,
    sameValue,
    type FieldChange,
    type FieldSpec,
} from '../../src/lib/admin/import/field-fix-core'
import { readRollback, writeFixReports } from '../../src/lib/admin/import/field-fix-report'
import { StandardCsvAdapter } from '../../src/lib/admin/adapters/standard-csv'

const spec = (key: string): FieldSpec => {
    const s = getFieldSpec(key)
    assert.ok(s, `spec mancante per ${key}`)
    return s
}

/** CIF;CFPIVA;NOMEPDF;SERVIZIO;EMISSIONE;SCADENZA;IMPORTO;CONSUMO;MPxx;TIPO */
const row = (...cells: string[]) => cells

test('getFieldSpec accetta solo i campi correggibili', () => {
    assert.equal(getFieldSpec('consumo')?.key, 'consumo')
    assert.equal(getFieldSpec('  CONSUMO ')?.key, 'consumo')
    for (const blocked of Object.keys(BLOCKED_FIELDS)) {
        assert.equal(getFieldSpec(blocked), undefined, `${blocked} non deve essere correggibile`)
    }
})

test('csvValueFor numerico: separatori italiani, vuoto = null, zero preservato', () => {
    const s = spec('consumo')
    assert.equal(csvValueFor(s, row('A', 'B', '1.pdf', 'ACQUA', '', '', '', '1.234,56')), 1234.56)
    assert.equal(csvValueFor(s, row('A', 'B', '1.pdf', 'ACQUA', '', '', '', '0')), 0)
    assert.equal(csvValueFor(s, row('A', 'B', '1.pdf', 'ACQUA', '', '', '', '')), null)
    assert.equal(csvValueFor(s, row('A', 'B', '1.pdf', 'ACQUA', '', '', '', 'n/d')), null)
})

test('csvValueFor data: gg/mm/aaaa -> ISO, "nessuna" e formati ignoti = null', () => {
    const s = spec('data_emissione')
    assert.equal(csvValueFor(s, row('A', 'B', '1.pdf', 'ACQUA', '16/03/2026')), '2026-03-16')
    assert.equal(csvValueFor(s, row('A', 'B', '1.pdf', 'ACQUA', '5/3/2026')), '2026-03-05')
    assert.equal(csvValueFor(s, row('A', 'B', '1.pdf', 'ACQUA', 'Nessuna')), null)
    assert.equal(csvValueFor(s, row('A', 'B', '1.pdf', 'ACQUA', '2026-03-16')), null)
})

test('csvValueFor tipo/metodo: legge le colonne 8/9 come l\'import', () => {
    const bt = spec('billing_type')
    const em = spec('expected_method')
    const full = row('A', 'B', '1.pdf', 'ACQUA', '', '', '', '', 'MP23', 'SALDO')
    assert.equal(csvValueFor(bt, full), 'S')
    assert.equal(csvValueFor(em, full), 'MP23')

    // bolletta a 0 euro: colonna 8 vuota, il tipo resta in colonna 9
    const zeroEuro = row('A', 'B', '1.pdf', 'ACQUA', '', '', '0,00', '0', '', 'SALDO E CONGUAGLIO')
    assert.equal(csvValueFor(bt, zeroEuro), 'SALDO E CONGUAGLIO')
    assert.equal(csvValueFor(em, zeroEuro), null)

    // layout legacy: colonna 8 contiene il tipo, colonna 9 assente
    const legacy = row('A', 'B', '1.pdf', 'ACQUA', '', '', '', '', 'ACCONTO')
    assert.equal(csvValueFor(bt, legacy), 'A')
    assert.equal(csvValueFor(em, legacy), null)
})

test('dbValueFor normalizza il valore a DB nella stessa forma del CSV', () => {
    assert.equal(dbValueFor(spec('consumo'), '1234.56'), 1234.56)
    assert.equal(dbValueFor(spec('consumo'), 0), 0)
    assert.equal(dbValueFor(spec('consumo'), null), null)
    assert.equal(dbValueFor(spec('data_emissione'), '2026-03-16T00:00:00+00:00'), '2026-03-16')
    assert.equal(dbValueFor(spec('tipo_servizio'), '  ACQUA '), 'ACQUA')
    assert.equal(dbValueFor(spec('tipo_servizio'), ''), null)
})

test('sameValue distingue vuoto da zero', () => {
    assert.equal(sameValue(0, 0), true)
    assert.equal(sameValue(null, null), true)
    assert.equal(sameValue(null, 0), false)
    assert.equal(sameValue(0, null), false)
    assert.equal(sameValue(12.5, 12.5), true)
    assert.equal(sameValue('S', 'A'), false)
})

test('parseRawCsv legge il punto e virgola e regge righe corte', () => {
    const rows = parseRawCsv('CIF1;CF1;123.pdf;ACQUA;16/03/2026;30/04/2026;12,34;56\nCIF2;CF2;124.pdf')
    assert.equal(rows.length, 2)
    assert.equal(rows[0][7], '56')
    assert.equal(rows[1].length, 3)
})

test('writeFixReports + readRollback: il campo si ricava dall\'intestazione', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acq-fix-'))
    try {
        const s = spec('consumo')
        const { rollback } = writeFixReports(dir, s, [
            { idboll: 111, from: 10, to: 99 },
            { idboll: 222, from: null, to: 5 },
        ])
        const back = readRollback(rollback)
        assert.equal(back.spec.key, 'consumo')
        assert.deepEqual(back.changes.map((c) => [c.idboll, c.to]), [[111, 10], [222, null]])

        const bogus = path.join(dir, 'bogus.csv')
        fs.writeFileSync(bogus, 'idboll,pdf_url\n1,x/y.pdf\n', 'utf8')
        assert.throws(() => readRollback(bogus), /non correggibile o sconosciuto/)

        const noHeader = path.join(dir, 'nohead.csv')
        fs.writeFileSync(noHeader, '111,10\n', 'utf8')
        assert.throws(() => readRollback(noHeader), /Intestazione inattesa/)
    } finally {
        fs.rmSync(dir, { recursive: true, force: true })
    }
})

interface RecordedCall { table: string; payload: Record<string, unknown>; column: string; ids: number[] }

/**
 * Client finto: registra gli UPDATE e fa fallire il test se il codice provasse a
 * usare insert/upsert/delete o un filtro diverso da .in('idboll', …).
 */
function recordingClient(calls: RecordedCall[]): SupabaseClient {
    const from = (table: string) => ({
        update: (payload: Record<string, unknown>) => ({
            in: (column: string, ids: number[]) => {
                calls.push({ table, payload, column, ids })
                return Promise.resolve({ error: null })
            },
            eq: () => assert.fail('applyFieldFix non deve usare .eq()'),
        }),
        insert: () => assert.fail('applyFieldFix non deve fare INSERT'),
        upsert: () => assert.fail('applyFieldFix non deve fare UPSERT'),
        delete: () => assert.fail('applyFieldFix non deve fare DELETE'),
    })
    return { from } as unknown as SupabaseClient
}

test('applyFieldFix scrive solo la colonna scelta, con soli UPDATE su idboll', async () => {
    const calls: RecordedCall[] = []
    const changes: FieldChange[] = [
        { idboll: 1, from: 1, to: 10 },
        { idboll: 2, from: 2, to: 10 },
        { idboll: 3, from: 3, to: 20 },
    ]
    const res = await applyFieldFix(recordingClient(calls), spec('consumo'), changes)

    assert.equal(res.updated, 3)
    assert.deepEqual(res.errors, [])
    // un gruppo per valore distinto: 10 e 20
    assert.equal(calls.length, 2)
    for (const c of calls) {
        assert.equal(c.table, 'bills')
        assert.deepEqual(Object.keys(c.payload), ['consumo'], 'una sola colonna nel payload')
        assert.equal(c.column, 'idboll')
        assert.ok(c.ids.length <= FIX_CHUNK)
    }
    assert.deepEqual(calls.find((c) => c.payload.consumo === 10)?.ids, [1, 2])
    assert.deepEqual(calls.find((c) => c.payload.consumo === 20)?.ids, [3])
})

test('applyFieldFix spezza in blocchi da FIX_CHUNK e copre ogni idboll una volta', async () => {
    const calls: RecordedCall[] = []
    const changes: FieldChange[] = Array.from({ length: FIX_CHUNK + 3 }, (_, i) => ({
        idboll: i + 1,
        from: 0,
        to: 99,
    }))
    const res = await applyFieldFix(recordingClient(calls), spec('consumo'), changes)

    assert.equal(res.updated, changes.length)
    assert.equal(calls.length, 2, 'un solo valore distinto -> due blocchi')
    assert.equal(calls[0].ids.length, FIX_CHUNK)
    assert.equal(calls[1].ids.length, 3)
    const flat = calls.flatMap((c) => c.ids)
    assert.equal(new Set(flat).size, changes.length)
})

test('applyFieldFix rifiuta un campo fuori whitelist', async () => {
    const calls: RecordedCall[] = []
    const forged = { key: 'pdf_url', label: 'x', kind: 'text', source: 'column', column: 2, hint: '' } as FieldSpec
    await assert.rejects(
        () => applyFieldFix(recordingClient(calls), forged, [{ idboll: 1, from: null, to: 'x' }]),
        /non correggibile/,
    )
    assert.equal(calls.length, 0)
})

test('StandardCsvAdapter rifiuta i nomi PDF non canonici invece di inserirli senza idboll', async () => {
    const csv = [
        'CIF000123;RSSMRA80A01H501U;456789.pdf;ACQUA;16/03/2026;30/04/2026;10,00;5;MP23;SALDO',
        'CIF000124;RSSMRA80A01H501U;0456790.pdf;ACQUA;16/03/2026;30/04/2026;10,00;5;MP23;SALDO',
        'CIF000125;RSSMRA80A01H501U;bolletta_456791.pdf;ACQUA;16/03/2026;30/04/2026;10,00;5;MP23;SALDO',
    ].join('\n')

    const { bills, errors } = await new StandardCsvAdapter().parse(csv)
    // solo la riga canonica entra, le altre due sono segnalate
    assert.equal(bills.length, 1)
    assert.equal(bills[0].idboll, 456789)
    assert.equal(errors.length, 2)
    assert.ok(errors.every((e) => e.includes('non canonico')), errors.join(' | '))
})

test('StandardCsvAdapter: il refactor delle colonne 8/9 non cambia il parsing', async () => {
    const csv = [
        'CIF000123;RSSMRA80A01H501U;456789.pdf;ACQUA;16/03/2026;30/04/2026;1.234,56;789;MP23;SALDO',
        'CIF000124;12345678901;456790.pdf;ACQUA;16/03/2026;Nessuna;0,00;0;;SALDO E CONGUAGLIO',
        'CIF000125;12345678901;456791.pdf;ACQUA;16/03/2026;30/04/2026;10,00;5;ACCONTO',
    ].join('\n')

    const { bills } = await new StandardCsvAdapter().parse(csv)
    assert.equal(bills.length, 3)

    assert.equal(bills[0].idboll, 456789)
    assert.equal(bills[0].importo, 1234.56)
    assert.equal(bills[0].consumo, 789)
    assert.equal(bills[0].billing_type, 'S')
    assert.equal(bills[0].expected_method, 'MP23')
    assert.equal(bills[0].codice_cliente, 'CIF000')

    assert.equal(bills[1].billing_type, 'SALDO E CONGUAGLIO')
    assert.equal(bills[1].expected_method, null)
    assert.equal(bills[1].scadenza, null)

    assert.equal(bills[2].billing_type, 'A')
    assert.equal(bills[2].expected_method, null)
})
