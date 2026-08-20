// Rendering del template in un documento HTML autoconsistente.
//
// Tutti gli asset (logo, screenshot, foglio di stile) vengono incorporati come
// data URI: il file risultante si apre in qualunque browser e si stampa senza
// dipendere da percorsi locali.

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { SHOTS } from './shots.mjs'

const IF_BLOCK = /\{\{#if\s+([\w.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g
const VAR = /\{\{([\w.]+)\}\}/g

const MIME = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
}

export async function renderDocument(cfg, root) {
    const templateDir = path.join(root, 'presentations', 'template')

    const [template, css] = await Promise.all([
        readFile(path.join(templateDir, 'presentation.html'), 'utf8'),
        readFile(path.join(templateDir, 'style.css'), 'utf8'),
    ])

    const { shots, missing } = await collectShots(cfg, root)
    const logo = cfg.logo ? await inlineAsset(path.join(root, 'presentations', 'logos', cfg.logo)) : ''

    const vars = {
        ...cfg,
        ...cfg.sections,
        ...shots,
        logo,
    }

    let body = template
        .replace(IF_BLOCK, (_, key, inner) => (isTruthy(vars[key]) ? inner : ''))

    body = numberPages(body)

    body = body.replace(VAR, (whole, key) => {
        const value = vars[key]
        return value === undefined || value === null ? whole : String(value)
    })

    const html = wrap(body, css, cfg)
    return { html, missing }
}

/** Sostituisce {{PAGE}} con un contatore progressivo, dopo lo sfoltimento dei blocchi. */
function numberPages(body) {
    let n = 0
    return body.replace(/\{\{PAGE\}\}/g, () => String(++n))
}

function isTruthy(value) {
    return value !== undefined && value !== null && value !== false && value !== ''
}

/**
 * Carica gli screenshot del prospect. Quelli mancanti diventano un segnaposto
 * visibile, così la presentazione si genera comunque e si vede cosa manca.
 */
async function collectShots(cfg, root) {
    const dir = path.join(root, 'presentations', 'shots', cfg.slug)
    const shots = {}
    const missing = []

    for (const shot of SHOTS) {
        const file = path.join(dir, shot.file)
        if (existsSync(file)) {
            shots[shot.key] = await inlineAsset(file)
        } else {
            shots[shot.key] = placeholder(shot)
            missing.push(shot)
        }
    }

    return { shots, missing }
}

async function inlineAsset(file) {
    const mime = MIME[path.extname(file).toLowerCase()]
    if (!mime) throw new Error(`Formato immagine non supportato: ${file}`)
    const data = await readFile(file)
    return `data:${mime};base64,${data.toString('base64')}`
}

/** Segnaposto SVG con il nome del file atteso, incorporato come data URI. */
function placeholder(shot) {
    const isMobile = shot.viewport === 'mobile'
    const [w, h] = isMobile ? [390, 844] : [1440, 900]
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="#eef2f7"/>
<rect x="8" y="8" width="${w - 16}" height="${h - 16}" fill="none" stroke="#b9c6d6" stroke-width="3" stroke-dasharray="14 10"/>
<text x="50%" y="${h / 2 - 14}" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="${isMobile ? 20 : 34}" font-weight="700" fill="#7d8ea3">screenshot mancante</text>
<text x="50%" y="${h / 2 + 22}" text-anchor="middle" font-family="Segoe UI, sans-serif" font-size="${isMobile ? 15 : 24}" fill="#93a3b6">${shot.file}</text>
</svg>`
    return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`
}

function wrap(body, css, cfg) {
    return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<title>${escapeHtml(cfg.productName)} — ${escapeHtml(cfg.company)}</title>
<style>
:root { --primary: ${cfg.primary}; --accent: ${cfg.accent}; }
${css}
</style>
</head>
<body>
${body}
</body>
</html>`
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}
