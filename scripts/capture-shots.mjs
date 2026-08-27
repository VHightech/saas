#!/usr/bin/env node
// Cattura automatica degli screenshot per la presentazione.
//
//   npm run shots -- --client=acme
//
// Richiede il server di sviluppo attivo (npm run dev) e le credenziali in
// presentations/.env.capture, che e ignorato da git.
//
// Chrome si apre in una finestra visibile: il captcha Turnstile del portale
// usa una chiave reale e in headless verrebbe respinto. La viewport resta
// emulata, quindi gli screenshot escono nella misura esatta a prescindere
// dalla finestra.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { launchChrome, sleep } from './presentation/cdp.mjs'
import { VIEWPORTS } from './presentation/shots.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const c = {
    dim: (s) => `\x1b[2m${s}\x1b[0m`,
    bold: (s) => `\x1b[1m${s}\x1b[0m`,
    green: (s) => `\x1b[32m${s}\x1b[0m`,
    yellow: (s) => `\x1b[33m${s}\x1b[0m`,
    red: (s) => `\x1b[31m${s}\x1b[0m`,
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
    const argv = process.argv.slice(2)
    const slug = parseSlug(argv)

    // Modalita manuale: nessuna credenziale da nessuna parte, entra una
    // persona nella finestra di Chrome. E anche il ripiego automatico quando
    // il file delle credenziali non esiste.
    const manual = argv.includes('--manual') || !existsSync(path.join(ROOT, 'presentations', '.env.capture'))
    const env = manual ? {} : await loadCaptureEnv()
    const base = env.CAPTURE_BASE_URL || process.env.CAPTURE_BASE_URL || 'http://localhost:3000'

    await assertDevServer(base)

    const outDir = path.join(ROOT, 'presentations', 'shots', slug)
    await mkdir(outDir, { recursive: true })

    const scrub = await readFile(path.join(ROOT, 'presentations', 'scrub-console.js'), 'utf8')

    console.log(c.bold(`Cattura screenshot per "${slug}"`))
    console.log(c.dim(`  portale: ${base}`))
    console.log(c.dim(`  accesso: ${manual ? 'manuale, entri tu nella finestra' : 'automatico da .env.capture'}`))
    console.log(c.dim('  si apre una finestra Chrome: non chiuderla finche non ho finito.\n'))

    const chrome = await launchChrome({ headless: false })
    const { session } = chrome
    const done = []
    const failed = []

    const shoot = async (file, note) => {
        try {
            await session.evaluate(scrub)
            await sleep(400)
            await writeFile(path.join(outDir, file), await session.screenshot())
            done.push(file)
            console.log(c.green(`  ✓ ${file}`) + c.dim(note ? `  ${note}` : ''))
        } catch (err) {
            failed.push({ file, reason: err.message })
            console.log(c.red(`  ✗ ${file}`) + c.dim(`  ${err.message}`))
        }
    }

    try {
        await session.send('Page.enable')
        await session.send('Runtime.enable')
        await session.send('Network.enable')

        // ── CLIENTE ──────────────────────────────────────────────────────────
        console.log(c.bold('Portale cliente'))
        await session.setViewport(VIEWPORTS.desktop)
        manual
            ? await loginManual(session, base, 'cliente', 1)
            : await login(session, base, env.CAPTURE_CLIENT_CODE, env.CAPTURE_CLIENT_PASSWORD, 'cliente')

        await session.setViewport(VIEWPORTS.desktop)
        for (const [file, route] of [
            ['01-home.png', '/profile'],
            ['02-bollette.png', '/bollette'],
            ['03-confronto.png', '/confronto'],
        ]) {
            await session.goto(base + route)
            await settle(session)
            await shoot(file, route)
        }

        await session.setViewport({ ...VIEWPORTS.mobile, mobile: true })
        await session.goto(base + '/profile')
        await settle(session)
        await shoot('04-mobile-home.png', 'schermata iniziale')

        if (await clickByText(session, 'Bollette')) {
            await settle(session)
            await shoot('05-mobile-bollette.png', 'elenco')

            if (await openFirstBill(session)) {
                await settle(session)
                await shoot('06-mobile-dettaglio.png', 'dettaglio')
            } else {
                failed.push({ file: '06-mobile-dettaglio.png', reason: 'nessuna bolletta apribile' })
                console.log(c.red('  ✗ 06-mobile-dettaglio.png') + c.dim('  nessuna bolletta apribile'))
            }
        } else {
            for (const f of ['05-mobile-bollette.png', '06-mobile-dettaglio.png']) {
                failed.push({ file: f, reason: 'pulsante "Bollette" non trovato' })
                console.log(c.red(`  ✗ ${f}`) + c.dim('  pulsante "Bollette" non trovato'))
            }
        }

        // ── AMMINISTRAZIONE ──────────────────────────────────────────────────
        console.log(c.bold('\nPannello operatori'))
        await session.send('Network.clearBrowserCookies')
        await session.setViewport(VIEWPORTS.desktop)
        await session.send('Emulation.setTouchEmulationEnabled', { enabled: false, maxTouchPoints: 0 })
        manual
            ? await loginManual(session, base, 'operatore', 2)
            : await login(session, base, env.CAPTURE_ADMIN_CODE, env.CAPTURE_ADMIN_PASSWORD, 'operatore')

        await session.goto(base + '/admin/users')
        await settle(session)
        await shoot('07-admin-utenti.png', '/admin/users')

        if (await openFirstUser(session)) {
            await settle(session)
            await shoot('08-admin-dettaglio.png', 'scheda cliente')
        } else {
            failed.push({ file: '08-admin-dettaglio.png', reason: 'nessuna riga cliente cliccabile' })
            console.log(c.red('  ✗ 08-admin-dettaglio.png') + c.dim('  nessuna riga cliente cliccabile'))
        }

        await session.goto(base + '/admin/upload')
        await settle(session)
        await shoot('09-admin-upload.png', '/admin/upload')
    } finally {
        await chrome.close()
    }

    report(done, failed, slug)
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Accesso manuale: e una persona a entrare nella finestra di Chrome.
 * Evita di dover scrivere credenziali da qualche parte e aggira il captcha,
 * che con una persona davanti si risolve sempre.
 *
 * Le istruzioni compaiono sovrapposte alla pagina, non nel terminale: chi
 * esegue l'accesso sta guardando Chrome, non la console.
 */
async function loginManual(session, base, ruolo, passo) {
    await session.goto(base + '/login')
    await session.waitFor("document.getElementById('otp-0')", { timeout: 30_000 })

    await banner(session, `Passo ${passo} di 2`, `Accedi come <b>${ruolo}</b>.`,
        'Appena sei dentro, gli screenshot partono da soli. Non chiudere la finestra.')

    console.log(c.yellow(`  in attesa dell'accesso come ${ruolo}…`))

    const entered = await session.waitFor(
        `!location.pathname.startsWith('/login')`,
        { timeout: 900_000, interval: 500 }
    )
    if (!entered) throw new Error(`accesso come ${ruolo} non effettuato entro quindici minuti`)

    console.log(c.dim(`  accesso come ${ruolo} completato`))
    await sleep(1500)
}

/** Riquadro di istruzioni sovrapposto alla pagina. Sparisce alla navigazione. */
async function banner(session, titolo, riga1, riga2) {
    await session.evaluate(`(() => {
        document.getElementById('__capture_banner')?.remove()
        const el = document.createElement('div')
        el.id = '__capture_banner'
        el.innerHTML =
            '<div style="font:700 11px/1 system-ui;letter-spacing:.14em;text-transform:uppercase;opacity:.75;margin-bottom:8px">'
            + ${JSON.stringify(titolo)} + '</div>'
            + '<div style="font:600 17px/1.4 system-ui;margin-bottom:6px">' + ${JSON.stringify(riga1)} + '</div>'
            + '<div style="font:400 13px/1.5 system-ui;opacity:.8">' + ${JSON.stringify(riga2)} + '</div>'
        el.setAttribute('style', [
            'position:fixed', 'z-index:2147483647', 'top:16px', 'left:50%',
            'transform:translateX(-50%)', 'max-width:520px', 'padding:16px 22px',
            'background:#0B6FA4', 'color:#fff', 'border-radius:12px',
            'box-shadow:0 12px 40px rgba(0,0,0,.35)', 'pointer-events:none',
        ].join(';'))
        document.body.appendChild(el)
        return true
    })()`)
}

/**
 * Accesso automatico con credenziali da file. I campi vengono compilati; il
 * captcha no, perche non e automatizzabile. Se non si risolve da solo, si
 * ricade sull'attesa dell'intervento manuale.
 */
async function login(session, base, code, password, ruolo) {
    if (!code || !password) throw new Error(`credenziali mancanti per il ruolo "${ruolo}"`)

    await session.goto(base + '/login')
    if (!(await session.waitFor("document.getElementById('otp-0')"))) {
        throw new Error('la pagina di accesso non si e caricata')
    }

    // I campi sono controllati da React: va usato il setter nativo, altrimenti
    // il valore compare a schermo ma lo stato del componente resta vuoto.
    await session.evaluate(`(() => {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
        const fire = (el, v) => { set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
        const code = ${JSON.stringify(String(code))}
        for (let i = 0; i < 6; i++) {
            const el = document.getElementById('otp-' + i)
            if (el) fire(el, code[i] ?? '')
        }
        const pw = document.getElementById('password')
        if (pw) fire(pw, ${JSON.stringify(password)})
        return true
    })()`)

    const solved = await session.waitFor(
        `document.querySelector('input[name="cf-turnstile-response"]')?.value`,
        { timeout: 45_000 }
    )

    if (solved) {
        await clickByText(session, 'Accedi')
    } else {
        console.log(c.yellow(`  il captcha non si e risolto da solo.`))
        console.log(c.yellow(`  Completa l'accesso come ${ruolo} nella finestra di Chrome: aspetto.`))
    }

    const entered = await session.waitFor(
        `!location.pathname.startsWith('/login')`,
        { timeout: 300_000, interval: 500 }
    )
    if (!entered) throw new Error(`accesso come ${ruolo} non riuscito entro cinque minuti`)

    console.log(c.dim(`  accesso come ${ruolo} completato`))
    await sleep(1200)
}

/** Attende il quietarsi della pagina: grafici disegnati, nessun caricamento in corso. */
async function settle(session) {
    await session.waitFor(`document.readyState === 'complete'`, { timeout: 20_000 })
    // I grafici arrivano dopo i dati: se la pagina ne prevede, si aspetta il disegno.
    await session.waitFor(
        `(() => {
            const svg = document.querySelectorAll('.recharts-surface, svg.recharts-surface')
            return svg.length === 0 || [...svg].some(s => s.querySelector('path, rect, line'))
        })()`,
        { timeout: 12_000 }
    )
    await sleep(1500)
}

/** Clicca il primo elemento cliccabile il cui testo contiene la stringa data. */
async function clickByText(session, text) {
    return session.evaluate(`(() => {
        const wanted = ${JSON.stringify(text)}.toLowerCase()
        const nodes = [...document.querySelectorAll('button, a, [role="button"]')]
        const hit = nodes.find(el => {
            if (el.disabled) return false
            if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return false
            return (el.innerText || '').trim().toLowerCase().includes(wanted)
        })
        if (!hit) return false
        hit.click()
        return true
    })()`)
}

/** Nell'elenco mobile le bollette sono raggruppate per anno e il gruppo puo essere chiuso. */
async function openFirstBill(session) {
    const isBillRow = `el => /€|EUR/.test(el.innerText || '')`

    if (await session.evaluate(`[...document.querySelectorAll('button')].some(${isBillRow})`)) {
        return session.evaluate(`(() => {
            const hit = [...document.querySelectorAll('button')].find(${isBillRow})
            if (!hit) return false
            hit.click()
            return true
        })()`)
    }

    // Nessuna riga visibile: probabilmente i gruppi per anno sono chiusi.
    await session.evaluate(`(() => {
        const year = [...document.querySelectorAll('button')].find(el => /^\\s*20\\d{2}/.test(el.innerText || ''))
        if (year) year.click()
        return true
    })()`)
    await sleep(900)

    return session.evaluate(`(() => {
        const hit = [...document.querySelectorAll('button')].find(${isBillRow})
        if (!hit) return false
        hit.click()
        return true
    })()`)
}

/** Apre la scheda del primo cliente dell'elenco amministrativo. */
async function openFirstUser(session) {
    const clicked = await session.evaluate(`(() => {
        const rows = [...document.querySelectorAll('tbody tr, [data-user-row], a[href*="/admin/users/"]')]
        const hit = rows.find(el => el.offsetParent)
        if (!hit) return false
        hit.click()
        return true
    })()`)

    if (!clicked) return false
    await sleep(1500)
    return session.evaluate(`location.pathname.split('/').filter(Boolean).length >= 3`)
}

// ─────────────────────────────────────────────────────────────────────────────

function parseSlug(argv) {
    const arg = argv.find((a) => a.startsWith('--client='))
    const slug = arg ? arg.slice('--client='.length).trim() : ''
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
        console.error('Uso: npm run shots -- --client=<slug>')
        process.exit(1)
    }
    return slug
}

async function loadCaptureEnv() {
    const file = path.join(ROOT, 'presentations', '.env.capture')

    if (!existsSync(file)) {
        console.error(c.red('\nManca presentations/.env.capture\n'))
        console.error('Crealo con questo contenuto (il file e ignorato da git):\n')
        console.error(c.dim([
            '  CAPTURE_BASE_URL=http://localhost:3000',
            '  CAPTURE_CLIENT_CODE=123456',
            '  CAPTURE_CLIENT_PASSWORD=...',
            '  CAPTURE_ADMIN_CODE=654321',
            '  CAPTURE_ADMIN_PASSWORD=...',
        ].join('\n')))
        console.error('\nUsa un utente di prova, non il tuo account reale.\n')
        process.exit(1)
    }

    const env = {}
    for (const line of (await readFile(file, 'utf8')).split('\n')) {
        const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
        if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
    return env
}

async function assertDevServer(base) {
    try {
        const res = await fetch(base + '/login', { signal: AbortSignal.timeout(5000) })
        if (!res.ok) throw new Error(`risposta ${res.status}`)
    } catch (err) {
        console.error(c.red(`\nIl portale non risponde su ${base}`))
        console.error(c.dim(`  ${err.message}`))
        console.error('\nAvvia il server con  npm run dev  e riprova.\n')
        process.exit(1)
    }
}

function report(done, failed, slug) {
    console.log('')
    console.log(c.bold(`${done.length} screenshot salvati in presentations/shots/${slug}/`))

    if (failed.length > 0) {
        console.log(c.yellow(`${failed.length} non riusciti:`))
        for (const f of failed) console.log(c.dim(`  ${f.file} — ${f.reason}`))
        console.log(c.dim('\nQuelli mancanti restano segnaposto nel PDF: puoi rifarli a mano'))
        console.log(c.dim('seguendo presentations/README.md, oppure rilanciare questo comando.'))
    }

    console.log('')
    console.log(c.yellow('Guarda ogni immagine prima di usarla.'))
    console.log(c.dim('La sostituzione dei dati reali e automatica ma non infallibile.'))
    console.log('')
    console.log(c.dim(`Poi genera il PDF:  npm run presentation -- --client=${slug}`))
}

main().catch((err) => {
    console.error(c.red(`\n${err.stack ?? err.message}\n`))
    process.exit(1)
})
