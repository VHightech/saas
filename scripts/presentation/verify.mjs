// Verifica che nessuna pagina trabocchi.
//
// Le pagine hanno `overflow: hidden`: il contenuto in eccesso viene tagliato
// senza lasciare traccia nel PDF. Senza questo controllo si scoprirebbe il
// problema solo aprendo il file, o peggio, non scoprendolo affatto.

import { execFile } from 'node:child_process'
import { readFile, writeFile, unlink } from 'node:fs/promises'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'
import { findBrowser } from './pdf.mjs'

const execFileAsync = promisify(execFile)

const PROBE = `<script>
window.addEventListener('load', () => {
    const pages = [...document.querySelectorAll('.page')].map((p, i) => ({
        page: i + 1,
        tag: (p.querySelector('.page-tag') || {}).textContent || 'copertina',
        over: p.scrollHeight - p.clientHeight,
    }))
    document.title = 'OVERFLOW_REPORT' + JSON.stringify(pages)
})
</script>`

/**
 * Misura l'eccedenza di ogni pagina in pixel CSS.
 * Restituisce solo le pagine che traboccano; array vuoto = documento a posto.
 */
export async function checkOverflow(htmlPath) {
    const probePath = htmlPath.replace(/\.html$/, '.probe.html')
    const html = await readFile(htmlPath, 'utf8')
    await writeFile(probePath, html.replace('</body>', `${PROBE}</body>`), 'utf8')

    try {
        const { stdout } = await execFileAsync(
            findBrowser(),
            [
                '--headless=new',
                '--disable-gpu',
                '--no-first-run',
                '--virtual-time-budget=4000',
                '--dump-dom',
                pathToFileURL(probePath).href,
            ],
            { timeout: 120_000, windowsHide: true, maxBuffer: 64 * 1024 * 1024 }
        )

        const match = stdout.match(/OVERFLOW_REPORT(\[[^<]*\])/)
        if (!match) return null

        return JSON.parse(match[1]).filter((p) => p.over > 0)
    } catch {
        // Il controllo è un ausilio, non un cancello: se fallisce, la build prosegue.
        return null
    } finally {
        await unlink(probePath).catch(() => {})
    }
}
