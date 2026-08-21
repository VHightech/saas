// Client minimale per il Chrome DevTools Protocol.
//
// Serve a pilotare Chrome senza installare Playwright: Node 22 ha WebSocket
// nativo, e il protocollo copre tutto quello che ci serve — emulare una
// viewport, navigare, cliccare, catturare.
//
// Chrome viene avviato in modalita visibile: il portale e protetto da un
// captcha Turnstile con chiave reale, che in headless verrebbe quasi
// certamente respinto. La viewport resta comunque emulata, quindi gli
// screenshot escono esatti a prescindere dalla dimensione della finestra.

import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { findBrowser } from './pdf.mjs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function launchChrome({ headless = false } = {}) {
    const profileDir = await mkdtemp(path.join(os.tmpdir(), 'acqdash-capture-'))
    const executable = findBrowser()

    const args = [
        `--user-data-dir=${profileDir}`,
        '--remote-debugging-port=0',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-features=Translate,MediaRouter',
        '--window-size=1500,1000',
        'about:blank',
    ]
    if (headless) args.unshift('--headless=new')

    const proc = spawn(executable, args, { stdio: 'ignore', windowsHide: false })

    const port = await readDevToolsPort(profileDir)
    const wsUrl = await findPageTarget(port)
    const session = await Session.connect(wsUrl)

    return {
        session,
        async close() {
            session.close()
            proc.kill()
            await sleep(300)
            await rm(profileDir, { recursive: true, force: true }).catch(() => {})
        },
    }
}

/** Chrome scrive la porta scelta nella prima riga di DevToolsActivePort. */
async function readDevToolsPort(profileDir, timeoutMs = 30_000) {
    const file = path.join(profileDir, 'DevToolsActivePort')
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
        if (existsSync(file)) {
            const [line] = (await readFile(file, 'utf8')).split('\n')
            const port = Number(line.trim())
            if (Number.isInteger(port) && port > 0) return port
        }
        await sleep(150)
    }
    throw new Error('Chrome non ha aperto la porta di debug entro 30 secondi.')
}

async function findPageTarget(port, timeoutMs = 15_000) {
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
        try {
            const res = await fetch(`http://127.0.0.1:${port}/json/list`)
            const targets = await res.json()
            const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
            if (page) return page.webSocketDebuggerUrl
        } catch {
            // Chrome non ancora pronto: si riprova.
        }
        await sleep(200)
    }
    throw new Error('Nessuna scheda disponibile in Chrome.')
}

class Session {
    static connect(wsUrl) {
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(wsUrl)
            const session = new Session(ws)
            ws.addEventListener('open', () => resolve(session), { once: true })
            ws.addEventListener('error', () => reject(new Error(`Connessione CDP fallita: ${wsUrl}`)), { once: true })
        })
    }

    constructor(ws) {
        this.ws = ws
        this.nextId = 1
        this.pending = new Map()
        this.handlers = new Map()

        ws.addEventListener('message', (event) => {
            const msg = JSON.parse(event.data)

            if (msg.id !== undefined) {
                const slot = this.pending.get(msg.id)
                if (!slot) return
                this.pending.delete(msg.id)
                msg.error ? slot.reject(new Error(`${msg.error.message} (${slot.method})`)) : slot.resolve(msg.result)
                return
            }

            for (const cb of this.handlers.get(msg.method) ?? []) cb(msg.params)
        })
    }

    send(method, params = {}) {
        const id = this.nextId++
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject, method })
            this.ws.send(JSON.stringify({ id, method, params }))
        })
    }

    on(event, cb) {
        if (!this.handlers.has(event)) this.handlers.set(event, [])
        this.handlers.get(event).push(cb)
    }

    close() {
        try { this.ws.close() } catch { /* gia chiusa */ }
    }

    // ---------- comodita ----------

    async setViewport({ width, height, mobile = false, scale = 2 }) {
        await this.send('Emulation.setDeviceMetricsOverride', {
            width,
            height,
            deviceScaleFactor: scale,
            mobile,
            screenWidth: width,
            screenHeight: height,
        })
        if (mobile) {
            await this.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
        }
    }

    async goto(url, { timeout = 45_000 } = {}) {
        const loaded = this.once('Page.loadEventFired', timeout)
        await this.send('Page.navigate', { url })
        await loaded.catch(() => { /* alcune navigazioni non emettono load: si prosegue */ })
    }

    once(event, timeout) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`Timeout in attesa di ${event}`)), timeout)
            this.on(event, (params) => {
                clearTimeout(timer)
                resolve(params)
            })
        })
    }

    /** Valuta un'espressione nella pagina e ne restituisce il valore. */
    async evaluate(expression) {
        const { result, exceptionDetails } = await this.send('Runtime.evaluate', {
            expression,
            returnByValue: true,
            awaitPromise: true,
        })
        if (exceptionDetails) {
            throw new Error(`Errore nella pagina: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`)
        }
        return result.value
    }

    /** Attende che un'espressione diventi vera. Restituisce false allo scadere. */
    async waitFor(expression, { timeout = 20_000, interval = 200 } = {}) {
        const deadline = Date.now() + timeout
        while (Date.now() < deadline) {
            try {
                if (await this.evaluate(`!!(${expression})`)) return true
            } catch {
                // La pagina puo essere in mezzo a una navigazione: si riprova.
            }
            await sleep(interval)
        }
        return false
    }

    async screenshot() {
        const { data } = await this.send('Page.captureScreenshot', {
            format: 'png',
            captureBeyondViewport: false,
        })
        return Buffer.from(data, 'base64')
    }
}

export { sleep }
