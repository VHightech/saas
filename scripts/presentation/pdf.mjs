// Stampa HTML → PDF tramite Chrome headless.
//
// Nessuna dipendenza npm: si usa il Chrome già installato sulla macchina.
// Percorso sovrascrivibile con la variabile d'ambiente CHROME_PATH.

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'

const execFileAsync = promisify(execFile)

const CANDIDATES = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
]

export function findBrowser() {
    const override = process.env.CHROME_PATH
    if (override) {
        if (!existsSync(override)) {
            throw new Error(`CHROME_PATH punta a un file inesistente: ${override}`)
        }
        return override
    }

    const found = CANDIDATES.find((p) => existsSync(p))
    if (!found) {
        throw new Error(
            'Chrome o Edge non trovati. Installa Chrome, oppure imposta CHROME_PATH ' +
            'con il percorso completo dell\'eseguibile.'
        )
    }
    return found
}

/**
 * Stampa htmlPath in pdfPath. Il timeout evita che un Chrome bloccato
 * lasci la build appesa a tempo indefinito.
 */
export async function printToPdf(htmlPath, pdfPath) {
    const browser = findBrowser()

    const args = [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--no-pdf-header-footer',
        '--print-to-pdf-no-header',
        '--virtual-time-budget=5000',
        `--print-to-pdf=${pdfPath}`,
        pathToFileURL(htmlPath).href,
    ]

    try {
        await execFileAsync(browser, args, { timeout: 120_000, windowsHide: true })
    } catch (err) {
        if (err.killed) throw new Error('Chrome non ha risposto entro 120 secondi.')
        // Chrome esce con codice non-zero anche quando il PDF è stato scritto:
        // il file su disco è l'unica verifica affidabile.
        if (!existsSync(pdfPath)) {
            throw new Error(`Chrome non ha prodotto il PDF.\n${err.stderr || err.message}`)
        }
    }

    if (!existsSync(pdfPath)) {
        throw new Error('Chrome è terminato senza errori ma il PDF non esiste.')
    }

    return browser
}
