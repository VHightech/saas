// Caricamento e validazione della configurazione per singolo prospect.
//
// La validazione è deliberatamente severa: meglio un errore chiaro prima di
// generare, che un PDF con la copertina sbagliata mandato per e-mail.

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const HEX = /^#[0-9a-fA-F]{6}$/
const SECTORS = ['idrico', 'energia', 'misto']

const DEFAULTS = {
    productName: 'ACQDASH',
    tagline: 'Piattaforma di gestione bollette per gestori idrici ed energetici',
    vendor: 'Grafiche Valdelsa S.r.l.',
    vendorContact: 'Matteo Volterrani',
    vendorEmail: 'matteo.volterrani@valdelsahightech.com',
    accent: '#22C55E',
    sector: 'misto',
}

const DEFAULT_SECTIONS = {
    pricing: false,
    technicalAnnex: true,
}

class ConfigError extends Error {}

/**
 * Legge presentations/clients/<slug>.json e restituisce una configurazione
 * validata e completa di default. Non muta l'oggetto letto da disco.
 */
export async function loadClientConfig(slug, root) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
        throw new ConfigError(
            `Slug non valido: "${slug}". Ammesse solo minuscole, cifre e trattini.`
        )
    }

    const configPath = path.join(root, 'presentations', 'clients', `${slug}.json`)

    if (!existsSync(configPath)) {
        throw new ConfigError(
            `Configurazione non trovata: ${configPath}\n` +
            `Copia presentations/clients/esempio.json e adattalo.`
        )
    }

    let raw
    try {
        raw = JSON.parse(await readFile(configPath, 'utf8'))
    } catch (err) {
        throw new ConfigError(`JSON non valido in ${configPath}: ${err.message}`)
    }

    const cfg = {
        ...DEFAULTS,
        ...raw,
        slug,
        sections: { ...DEFAULT_SECTIONS, ...(raw.sections ?? {}) },
    }

    const problems = validate(cfg, root)
    if (problems.length > 0) {
        throw new ConfigError(
            `Configurazione incompleta in ${configPath}:\n` +
            problems.map((p) => `  - ${p}`).join('\n')
        )
    }

    return cfg
}

function validate(cfg, root) {
    const problems = []

    if (!cfg.company?.trim()) {
        problems.push('"company" è obbligatorio (ragione sociale del prospect)')
    }
    if (!cfg.date?.trim()) {
        problems.push('"date" è obbligatorio (es. "Settembre 2026")')
    }
    if (!HEX.test(cfg.primary ?? '')) {
        problems.push('"primary" deve essere un colore esadecimale a 6 cifre, es. "#0B6FA4"')
    }
    if (!HEX.test(cfg.accent ?? '')) {
        problems.push('"accent" deve essere un colore esadecimale a 6 cifre, es. "#22C55E"')
    }
    if (!SECTORS.includes(cfg.sector)) {
        problems.push(`"sector" deve essere uno fra: ${SECTORS.join(', ')}`)
    }
    if (cfg.logo) {
        const logoPath = path.join(root, 'presentations', 'logos', cfg.logo)
        if (!existsSync(logoPath)) {
            problems.push(`logo non trovato: presentations/logos/${cfg.logo}`)
        }
    }
    if (cfg.sections.pricing) {
        for (const field of ['price_setup', 'price_recurring', 'price_migration', 'price_support']) {
            if (!cfg[field]?.trim()) {
                problems.push(`"${field}" è obbligatorio quando sections.pricing è true`)
            }
        }
    }

    return problems
}

/**
 * Avverte se il colore primario è troppo chiaro: la copertina ha testo bianco
 * e diventerebbe illeggibile. Non blocca — è una scelta del committente.
 */
export function contrastWarning(hex) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
    const ratio = 1.05 / (luminance + 0.05)

    return ratio < 4.5
        ? `il colore primario ${hex} dà un contrasto di ${ratio.toFixed(1)}:1 con il testo ` +
          `bianco della copertina (soglia consigliata 4.5:1). Valuta una tinta più scura.`
        : null
}

export { ConfigError }
