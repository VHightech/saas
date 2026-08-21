#!/usr/bin/env node
// Genera la presentazione PDF personalizzata per un prospect.
//
//   npm run presentation -- --client=acme
//
// Produce out/<Prodotto>-<Azienda>.pdf e, accanto, lo stesso documento in HTML
// per un'anteprima rapida nel browser senza rigenerare.

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadClientConfig, contrastWarning, ConfigError, PLACEHOLDER_NAME } from './presentation/config.mjs'
import { renderDocument } from './presentation/render.mjs'
import { printToPdf } from './presentation/pdf.mjs'
import { checkOverflow } from './presentation/verify.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const c = {
    dim: (s) => `\x1b[2m${s}\x1b[0m`,
    bold: (s) => `\x1b[1m${s}\x1b[0m`,
    green: (s) => `\x1b[32m${s}\x1b[0m`,
    yellow: (s) => `\x1b[33m${s}\x1b[0m`,
    red: (s) => `\x1b[31m${s}\x1b[0m`,
}

async function main() {
    const slug = parseSlug(process.argv.slice(2))

    const cfg = await loadClientConfig(slug, ROOT)
    console.log(`${c.bold(cfg.productName)} per ${c.bold(cfg.company)}`)

    if (cfg.productName === PLACEHOLDER_NAME) {
        console.log(c.yellow(`  avviso: il nome del prodotto e ancora il segnaposto "${PLACEHOLDER_NAME}".`))
        console.log(c.dim('          Impostare "productName" prima di inviare il PDF a un cliente.'))
    }

    const warning = contrastWarning(cfg.primary)
    if (warning) console.log(c.yellow(`  avviso: ${warning}`))

    const { html, missing } = await renderDocument(cfg, ROOT)

    if (missing.length > 0) {
        console.log(c.yellow(`  ${missing.length} screenshot mancanti, sostituiti da segnaposto:`))
        for (const shot of missing) {
            console.log(c.dim(`    presentations/shots/${slug}/${shot.file}  — ${shot.what}`))
        }
    }

    const outDir = path.join(ROOT, 'out')
    await mkdir(outDir, { recursive: true })

    const base = `${slugify(cfg.productName)}-${slugify(cfg.company)}`
    const htmlPath = path.join(outDir, `${base}.html`)
    const pdfPath = path.join(outDir, `${base}.pdf`)

    await writeFile(htmlPath, html, 'utf8')

    const overflowing = await checkOverflow(htmlPath)
    if (overflowing === null) {
        console.log(c.dim('  controllo impaginazione non riuscito, si prosegue'))
    } else if (overflowing.length > 0) {
        console.log(c.yellow(`  ${overflowing.length} pagine traboccano e verranno tagliate:`))
        for (const p of overflowing) {
            console.log(c.yellow(`    pagina ${p.page} (${p.tag}): ${p.over}px in eccesso`))
        }
    }

    const browser = await printToPdf(htmlPath, pdfPath)

    console.log(c.dim(`  motore: ${browser}`))
    console.log(c.green(`  PDF:  out/${base}.pdf`))
    console.log(c.dim(`  HTML: out/${base}.html  (anteprima nel browser)`))
}

function parseSlug(argv) {
    const arg = argv.find((a) => a.startsWith('--client='))
    const slug = arg ? arg.slice('--client='.length).trim() : ''

    if (!slug) {
        console.error('Uso: npm run presentation -- --client=<slug>')
        console.error('Il file presentations/clients/<slug>.json deve esistere.')
        process.exit(1)
    }
    return slug
}

function slugify(s) {
    return String(s)
        .normalize('NFD').replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

main().catch((err) => {
    console.error(c.red(err instanceof ConfigError ? `\n${err.message}\n` : `\n${err.stack}\n`))
    process.exit(1)
})
