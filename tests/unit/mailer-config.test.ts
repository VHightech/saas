import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveSmtpConfig } from '../../src/lib/mailer'

const base = {
    SMTP_HOST: 'smtp.example.com',
    SMTP_USER: 'utente',
    SMTP_PASS: 'segreto',
    MAIL_FROM: 'Acquambiente Marche <noreply@acquambientemarche.it>',
} satisfies Record<string, string | undefined>

test('resolveSmtpConfig deriva secure dalla porta: 465 = TLS implicito', () => {
    assert.equal(resolveSmtpConfig({ ...base, SMTP_PORT: '465' })?.secure, true)
    assert.equal(resolveSmtpConfig({ ...base, SMTP_PORT: '587' })?.secure, false)
    assert.equal(resolveSmtpConfig({ ...base, SMTP_PORT: '25' })?.secure, false)
    assert.equal(resolveSmtpConfig({ ...base, SMTP_PORT: '2525' })?.secure, false)
})

test('resolveSmtpConfig usa la porta 587 quando SMTP_PORT non è impostata', () => {
    const cfg = resolveSmtpConfig(base)
    assert.equal(cfg?.port, 587)
    assert.equal(cfg?.secure, false)
})

test('SMTP_SECURE sovrascrive la derivazione automatica', () => {
    assert.equal(resolveSmtpConfig({ ...base, SMTP_PORT: '587', SMTP_SECURE: 'true' })?.secure, true)
    assert.equal(resolveSmtpConfig({ ...base, SMTP_PORT: '465', SMTP_SECURE: 'false' })?.secure, false)
    // un valore non riconosciuto non deve disattivare la derivazione
    assert.equal(resolveSmtpConfig({ ...base, SMTP_PORT: '465', SMTP_SECURE: 'forse' })?.secure, true)
})

test('resolveSmtpConfig ritorna null se manca un pezzo della configurazione', () => {
    for (const missing of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'] as const) {
        const env: Record<string, string | undefined> = { ...base, SMTP_PORT: '587' }
        delete env[missing]
        assert.equal(resolveSmtpConfig(env), null, `${missing} mancante deve dare null`)
    }
    // stringhe vuote valgono come mancanti
    assert.equal(resolveSmtpConfig({ ...base, SMTP_HOST: '   ' }), null)
})

test('resolveSmtpConfig rifiuta porte non valide invece di indovinare', () => {
    for (const port of ['0', '-1', '70000', 'abc', '']) {
        const cfg = resolveSmtpConfig({ ...base, SMTP_PORT: port })
        if (port === '') {
            // vuota = non impostata → default 587
            assert.equal(cfg?.port, 587)
        } else {
            assert.equal(cfg, null, `porta "${port}" deve dare null`)
        }
    }
})

test('resolveSmtpConfig ripulisce gli spazi ma non la password', () => {
    const cfg = resolveSmtpConfig({
        ...base,
        SMTP_HOST: '  smtp.example.com  ',
        SMTP_USER: '  utente  ',
        SMTP_PASS: '  con spazi  ',
        SMTP_PORT: '587',
    })
    assert.equal(cfg?.host, 'smtp.example.com')
    assert.equal(cfg?.user, 'utente')
    // la password NON va trimmata: gli spazi possono farne parte
    assert.equal(cfg?.pass, '  con spazi  ')
})
