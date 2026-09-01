import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const execFileAsync = promisify(execFile)
const ROOT = path.resolve('.')
const OUT_DIR = path.join(ROOT, 'out')
const PARTS_DIR = path.join(ROOT, 'presentations/manual_template/parts')

const imgs = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'imgs.json'), 'utf-8'))
const css = fs.readFileSync(path.join(ROOT, 'presentations/manual_template/style.css'), 'utf-8')

const partFiles = fs.readdirSync(PARTS_DIR).sort()
console.log(`Loading ${partFiles.length} template parts...`)

let bodyHtml = ''
for (const pf of partFiles) {
    let partContent = fs.readFileSync(path.join(PARTS_DIR, pf), 'utf-8')
    for (const [key, val] of Object.entries(imgs)) {
        partContent = partContent.replaceAll(`{{${key}}}`, val)
    }
    bodyHtml += partContent + '\n'
}

const fullHtml = `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Guida al Portale Bollette Online — Acquambiente Marche</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
    <style>
${css}
    </style>
</head>
<body>

<header class="top-navbar">
    <div style="display: flex; align-items: center; gap: 14px;">
        <img src="${imgs.logo}" alt="Acquambiente Marche" class="nav-logo">
        <span class="nav-badge">Guida Ufficiale</span>
    </div>
    <div class="nav-actions">
        <button onclick="window.print()" class="btn btn-dark">🖨️ Stampa / Salva PDF</button>
        <a href="https://portaleacq.vercel.app" target="_blank" class="btn btn-accent">Vai al Portale ↗</a>
    </div>
</header>

<div class="manual-wrapper">
${bodyHtml}
</div>

</body>
</html>
`

const htmlPath = path.join(OUT_DIR, 'manuale-portale-bollette.html')
fs.writeFileSync(htmlPath, fullHtml, 'utf-8')
console.log(`HTML generated successfully at: ${htmlPath}`)

// Compiling PDF via Chrome / Edge Headless
async function buildPdf() {
    const CANDIDATES = [
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
        'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    ]
    const browser = CANDIDATES.find((p) => fs.existsSync(p))
    if (!browser) {
        console.error('No Chrome or Edge browser found!')
        return
    }

    const pdfPath = path.join(OUT_DIR, 'manuale-portale-bollette.pdf')
    console.log(`Compiling PDF with: ${browser}...`)

    const args = [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--no-pdf-header-footer',
        '--print-to-pdf-no-header',
        `--print-to-pdf=${pdfPath}`,
        pathToFileURL(htmlPath).href,
    ]

    await execFileAsync(browser, args)
    console.log(`PDF successfully created at: ${pdfPath}`)
}

buildPdf().catch((err) => console.error('PDF error:', err))
