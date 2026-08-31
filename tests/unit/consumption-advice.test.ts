import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
    consumptionComparison,
    consumptionAdvice,
    consumptionAdviceText,
} from '../../src/lib/consumption-advice'

/** Bolletta minima: solo i campi che il confronto guarda. */
const bill = (date: string, consumo: number) => ({ data_emissione: date, consumo })

/** Una bolletta al mese, da gennaio, per `months` mesi. */
const monthly = (year: number, months: number, consumo: number) =>
    Array.from({ length: months }, (_, i) =>
        bill(`${year}-${String(i + 1).padStart(2, '0')}-10`, consumo)
    )

test('anno in corso parziale: confronta gli stessi mesi, non 8 contro 12', () => {
    // 2026 fatturato fino ad agosto a 110 mc/mese, 2025 completo a 100 mc/mese.
    // Il totale annuo direbbe 880 contro 1200 = -27% (falso calo).
    const bills = [...monthly(2026, 8, 110), ...monthly(2025, 12, 100)]
    const { advice } = consumptionComparison(bills)

    assert.equal(advice.currentYear, 2026)
    assert.equal(advice.prevYear, 2025)
    assert.equal(advice.lastMonth, 7, 'ultimo mese fatturato = agosto (indice 7)')
    assert.equal(advice.partial, true)
    assert.equal(advice.periodLabel, 'gen–ago')
    assert.equal(advice.currentTotal, 880)
    assert.equal(advice.prevTotal, 800, 'solo gennaio-agosto del 2025')
    assert.equal(Math.round(advice.diffPct), 10)
    assert.equal(advice.level, 'warn')
})

test('anno completo: confronto sui 12 mesi, senza etichetta di periodo', () => {
    const bills = [...monthly(2025, 12, 90), ...monthly(2024, 12, 100)]
    const { advice } = consumptionComparison(bills)

    assert.equal(advice.partial, false)
    assert.equal(advice.periodLabel, '')
    assert.equal(advice.currentTotal, 1080)
    assert.equal(advice.prevTotal, 1200)
    assert.equal(Math.round(advice.diffPct), -10)
    assert.equal(advice.level, 'ok')
})

test('fatturazione trimestrale: il periodo si chiude sull ultima bolletta', () => {
    const bills = [
        bill('2026-01-15', 30), bill('2026-04-15', 40), bill('2026-07-15', 50),
        bill('2025-01-15', 25), bill('2025-04-15', 25), bill('2025-07-15', 25), bill('2025-10-15', 60),
    ]
    const { advice } = consumptionComparison(bills)

    assert.equal(advice.lastMonth, 6, 'luglio')
    assert.equal(advice.currentTotal, 120)
    assert.equal(advice.prevTotal, 75, 'la bolletta di ottobre 2025 resta fuori dal confronto')
    assert.equal(Math.round(advice.diffPct), 60)
    assert.equal(advice.level, 'alert')
})

test('consumo 0 reale e diverso da mese senza letture', () => {
    const bills = [
        ...monthly(2026, 3, 10),
        bill('2025-01-10', 10), bill('2025-02-10', 0), bill('2025-03-10', 10),
    ]
    const { prevByMonth, prevCovered } = consumptionComparison(bills)

    assert.equal(prevByMonth[1], 0)
    assert.equal(prevCovered[1], true, 'febbraio 2025 ha una bolletta da 0 mc: e un dato, non un buco')
    assert.equal(prevCovered[3], false, 'aprile 2025 non ha bollette')
})

test('serie mensili: piu bollette nello stesso mese si sommano', () => {
    const bills = [
        bill('2026-03-05', 10), bill('2026-03-25', 15),
        ...monthly(2025, 3, 10),
    ]
    const { curByMonth, advice } = consumptionComparison(bills)

    assert.equal(curByMonth[2], 25, 'le due bollette di marzo 2026 sommate')
    // Il 2026 ha fatturato solo marzo: si confronta marzo con marzo, non con
    // gennaio-marzo 2025 (sarebbe lo stesso errore in scala ridotta).
    assert.equal(advice.periodLabel, 'mar')
    assert.equal(advice.currentTotal, 25)
    assert.equal(advice.prevTotal, 10, 'solo marzo 2025')
    assert.equal(Math.round(advice.diffPct), 150)
})

test('ciclo di fatturazione slittato: la finestra parte dal primo mese comune', () => {
    // Caso reale (fornitura 505850): 2026 fatturato da gennaio, 2025 da febbraio.
    // Contare gen-ago 2026 (8 periodi) contro gen-ago 2025 (7) gonfiava la
    // percentuale: la finestra deve partire da febbraio.
    const bills = [
        ...monthly(2026, 8, 110),
        ...Array.from({ length: 11 }, (_, i) => bill(`2025-${String(i + 2).padStart(2, '0')}-10`, 100)),
    ]
    const { advice } = consumptionComparison(bills)

    assert.equal(advice.periodLabel, 'feb–ago', 'gennaio 2026 resta fuori: il 2025 non ha gennaio')
    assert.equal(advice.currentTotal, 770, 'feb-ago 2026 = 7 mesi')
    assert.equal(advice.prevTotal, 700, 'feb-ago 2025 = 7 mesi')
    assert.equal(Math.round(advice.diffPct), 10, 'senza il taglio iniziale sarebbe stato +26%')
})

test('un solo anno di dati: nessun confronto', () => {
    const { advice } = consumptionComparison(monthly(2026, 5, 20))

    assert.equal(advice.hasData, false)
    assert.equal(advice.level, 'none')
    assert.equal(advice.diffPct, 0)
    assert.equal(advice.currentTotal, 100, 'il consumo dell anno in corso resta disponibile')
    assert.match(consumptionAdviceText(advice), /due anni di letture/)
})

test('anno precedente senza dati nel periodo confrontato: nessun confronto', () => {
    // 2026 fatturato a gennaio, 2025 solo a novembre: non c e nulla da confrontare.
    const bills = [bill('2026-01-10', 30), bill('2025-11-10', 500)]
    const { advice } = consumptionComparison(bills)

    assert.equal(advice.hasData, false)
    assert.equal(advice.prevTotal, 0)
})

test('differenza che arrotonda a zero: stabile, non aumento', () => {
    // +0,4%: la card mostra "0%", quindi il verdetto non puo essere "in aumento".
    const bills = [bill('2026-01-10', 1004), bill('2025-01-10', 1000)]
    const { advice } = consumptionComparison(bills)

    assert.equal(Math.round(advice.diffPct), 0)
    assert.equal(advice.level, 'ok')
    assert.match(consumptionAdviceText(advice), /stabili/)
})

test('testo del consiglio: cita gli stessi mesi quando il confronto e parziale', () => {
    const parziale = consumptionAdvice([...monthly(2026, 6, 200), ...monthly(2025, 12, 100)])
    assert.match(consumptionAdviceText(parziale), /stessi mesi del 2025/)

    const completo = consumptionAdvice([...monthly(2025, 12, 200), ...monthly(2024, 12, 100)])
    assert.match(consumptionAdviceText(completo), /rispetto al 2024/)
})

test('date non valide o mancanti vengono ignorate senza rompere il calcolo', () => {
    const bills = [
        ...monthly(2026, 2, 50),
        ...monthly(2025, 2, 50),
        { data_emissione: 'non-una-data', consumo: 9999 },
        { data_emissione: null, consumo: 9999 },
        { consumo: 9999 },
    ]
    const { advice } = consumptionComparison(bills as any[])

    assert.equal(advice.currentTotal, 100)
    assert.equal(advice.prevTotal, 100)
    assert.equal(Math.round(advice.diffPct), 0)
})

test('consumo in formato stringa viene interpretato', () => {
    const bills = [
        { data_emissione: '2026-01-10', consumo: '12,5' },
        { data_emissione: '2025-01-10', consumo: '10' },
    ]
    const { advice } = consumptionComparison(bills as any[])

    assert.equal(advice.currentTotal, 12.5)
    assert.equal(advice.prevTotal, 10)
    assert.equal(Math.round(advice.diffPct), 25)
})
