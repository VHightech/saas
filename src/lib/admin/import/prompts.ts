import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import fs from 'node:fs'
import path from 'node:path'
import { isAffirmative, stripQuotes } from './helpers'

export function createPrompter() {
    const rl = readline.createInterface({ input, output })
    return {
        async ask(q: string): Promise<string> {
            return (await rl.question(q)).trim()
        },
        async confirm(q: string): Promise<boolean> {
            return isAffirmative(await rl.question(`${q} [y/N] `))
        },
        /** Prints a numbered menu; returns the 0-based index of the chosen option. */
        async choose(q: string, options: string[]): Promise<number> {
            output.write(`\n${q}\n`)
            options.forEach((o, i) => output.write(`  ${i + 1}) ${o}\n`))
            while (true) {
                const raw = (await rl.question('> ')).trim()
                const n = Number.parseInt(raw, 10)
                if (Number.isInteger(n) && n >= 1 && n <= options.length) return n - 1
                output.write(`Scelta non valida. Inserisci un numero fra 1 e ${options.length}.\n`)
            }
        },
        close() {
            rl.close()
        },
    }
}

/** Resolve a user-typed path (possibly quoted), asserting it exists. */
export function requireExistingFile(rawPath: string, label: string): string {
    const resolved = path.resolve(stripQuotes(rawPath))
    if (!fs.existsSync(resolved)) {
        throw new Error(`${label} non trovato: ${resolved}`)
    }
    return resolved
}
