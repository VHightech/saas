import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
    isAffirmative,
    stripQuotes,
    sanitizePdfFilename,
    isSafePdfFilename,
    dedupeNewBills,
} from '../../src/lib/admin/import/helpers'
import { idbollFromPdfName, pdfNameForIdboll } from '../../src/lib/bill-pdf'

test('idbollFromPdfName accetta solo il nome canonico <cifre>.pdf', () => {
    assert.equal(idbollFromPdfName('20230000001.pdf'), 20230000001)
    assert.equal(idbollFromPdfName('  456789.PDF  '), 456789)
    // zeri iniziali: `0123.pdf` non è il file della bolletta 123
    assert.equal(idbollFromPdfName('0123.pdf'), null)
    // suffissi o prefissi: mai indovinare a quale bolletta appartiene
    assert.equal(idbollFromPdfName('123abc.pdf'), null)
    assert.equal(idbollFromPdfName('bolletta_123.pdf'), null)
    assert.equal(idbollFromPdfName('123.pdf.bak'), null)
    assert.equal(idbollFromPdfName('123'), null)
    assert.equal(idbollFromPdfName(''), null)
    assert.equal(idbollFromPdfName('0.pdf'), null)
    // oltre Number.MAX_SAFE_INTEGER non si può confrontare in modo affidabile
    assert.equal(idbollFromPdfName('99999999999999999999.pdf'), null)
})

test('pdfNameForIdboll e idbollFromPdfName sono inverse sulla forma canonica', () => {
    for (const id of [1, 42, 20230000001, 20260099999]) {
        assert.equal(pdfNameForIdboll(id), `${id}.pdf`)
        assert.equal(idbollFromPdfName(pdfNameForIdboll(id)), id)
    }
})

test('isAffirmative accepts y/yes/s/si case-insensitively', () => {
    for (const yes of ['y', 'Y', 'yes', 'YES', 's', 'S', 'si', 'SI', ' si ']) {
        assert.equal(isAffirmative(yes), true, `expected true for "${yes}"`)
    }
    for (const no of ['', 'n', 'no', 'x', 'nope']) {
        assert.equal(isAffirmative(no), false, `expected false for "${no}"`)
    }
})

test('stripQuotes removes surrounding single/double quotes and trims', () => {
    assert.equal(stripQuotes('  "C:\\path\\file.csv"  '), 'C:\\path\\file.csv')
    assert.equal(stripQuotes("'/tmp/a.7z'"), '/tmp/a.7z')
    assert.equal(stripQuotes('plain'), 'plain')
})

test('sanitizePdfFilename collapses unsafe chars to underscore', () => {
    assert.equal(sanitizePdfFilename('12/34:56.pdf'), '12_34_56.pdf')
    assert.equal(sanitizePdfFilename('good name-1.pdf'), 'good name-1.pdf')
})

test('isSafePdfFilename rejects empty, dotfiles, and overlong names', () => {
    assert.equal(isSafePdfFilename('1234.pdf'), true)
    assert.equal(isSafePdfFilename(''), false)
    assert.equal(isSafePdfFilename('.hidden'), false)
    assert.equal(isSafePdfFilename('a'.repeat(201)), false)
})

test('dedupeNewBills drops existing and in-batch duplicate idboll, keeps null idboll', () => {
    const parsed = [
        { idboll: 1 }, { idboll: 2 }, { idboll: 2 }, { idboll: null }, { idboll: 3 },
    ]
    const existing = new Set<number>([3])
    const { toInsert, duplicateCount } = dedupeNewBills(parsed, existing)
    assert.deepEqual(toInsert.map(b => b.idboll), [1, 2, null])
    assert.equal(duplicateCount, 2) // one in-batch dup (2) + one existing (3)
})
