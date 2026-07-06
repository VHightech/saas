# Local Standalone Import Script — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move bulk CSV/7z ingestion out of the Vercel app into a standalone,
interactive `tsx` script (`npm run import`) run locally by the super_admin, and reduce
the hosted app to a recap-only "Centro Caricamento" page.

**Architecture:** One codebase, two run targets. The public app stays on Vercel minus
the two ingest Route Handlers and the upload UI. A new local script reuses the existing
CSV adapter + R2 helpers + a service-role Supabase client to parse, dedup, insert, and
upload PDFs, writing to `import_logs` exactly as the old route did (so history, the
`bills.import_log_id` FK, and batch-delete keep working).

**Tech Stack:** Next.js 16, TypeScript 5, `@supabase/supabase-js`, `@aws-sdk/client-s3`
(via `src/lib/r2.ts`), `7zip-bin` + `node-7z`, `csv-parse`, `tsx`, Node built-ins
(`readline/promises`, `node:crypto`, `node:test`).

## Global Constraints

- **Package runner:** `npx` is broken on this machine — invoke everything via
  `npm run <script>` or `node node_modules/.bin/<bin>`. Never use `npx`.
- **No `next build` while `next dev` is running** — it corrupts `.next` and breaks the
  dev server. The only build check in this plan (Task B5) must be run with the dev
  server stopped.
- **Env-load ordering (critical):** `src/lib/r2.ts` reads `process.env.R2_*` at
  module-load time. The script MUST call `dotenv.config()` BEFORE any module that
  transitively imports `r2.ts` is evaluated. Achieve this by keeping the entry file's
  static imports limited to `dotenv`/`path`/`readline`, then loading the core modules
  via **dynamic `import()`** inside `main()`, after `dotenv.config()`.
- **Service-role only, local only:** the script uses `SUPABASE_SERVICE_ROLE_KEY` from
  the operator's `.env.local`; it is never exposed via any HTTP route.
- **import_logs contract:** link key is `r2_path = importId` (a UUID the script
  generates); `kind` must be set explicitly (`'bills'` or `'users'`) so the recap page's
  `.eq('kind','bills')` filter still finds bills imports.
- **Testing reality:** the repo has no unit-test framework. Pure helpers are tested with
  Node's built-in `node:test` (zero new deps) run via `tsx`. I/O-heavy modules are
  verified by the script's own dry-run/preview plus a small-fixture manual run, matching
  the existing `scripts/` convention (e.g. `backfill-from-csv.ts --dry-run`). Types are
  checked with `tsc --noEmit`.

---

## File Structure

**New files**
- `src/lib/admin/import/client.ts` — `createServiceClient()` (service-role Supabase).
- `src/lib/admin/import/import-logs.ts` — `newImportId()`, init/update/complete/fail helpers.
- `src/lib/admin/import/helpers.ts` — pure helpers: `isAffirmative`, `stripQuotes`,
  `sanitizePdfFilename`, `isSafePdfFilename`, `dedupeNewBills`, `chunked`.
- `src/lib/admin/import/prompts.ts` — `createPrompter()`, `requireExistingFile()`.
- `src/lib/admin/import/bills-core.ts` — `analyzeBills()`, `insertBills()`.
- `src/lib/admin/import/pdf-archive.ts` — `analyzeArchive()`, `processArchive()`.
- `src/lib/admin/import/users-core.ts` — `analyzeUsers()`, `commitUsers()`.
- `scripts/import-data.ts` — interactive orchestration entry point.
- `tests/unit/import-helpers.test.ts` — `node:test` tests for pure helpers.

**Modified files**
- `package.json` — add `import`, `typecheck`, `test` scripts.
- `next.config.ts` — remove `experimental.serverActions` + `outputFileTracingExcludes`.
- `src/app/admin/upload/page.tsx` — rewrite recap-only.
- `src/components/admin/admin-layout-shell.tsx` — unwire provider + progress bar.

**Deleted files**
- `src/app/api/upload/route.ts`
- `src/app/api/upload-users/route.ts`
- `src/components/providers/admin-upload-provider.tsx`
- `src/components/ui/global-progress-bar.tsx`

---

# Phase A — The local import script

## Task A1: package.json scripts + service client

**Files:**
- Modify: `package.json` (scripts block)
- Create: `src/lib/admin/import/client.ts`

**Interfaces:**
- Produces: `createServiceClient(): SupabaseClient` — throws if env missing.

- [ ] **Step 1: Add scripts to package.json**

In `package.json`, add these three entries to the `"scripts"` object (keep existing ones):

```json
"import": "tsx scripts/import-data.ts",
"typecheck": "tsc --noEmit",
"test": "node --import tsx --test tests/unit/import-helpers.test.ts"
```

- [ ] **Step 2: Create the service client**

Create `src/lib/admin/import/client.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client for local admin scripts. Bypasses RLS.
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (from .env.local).
 */
export function createServiceClient(): SupabaseClient {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
        throw new Error(
            'Config mancante: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (controlla .env.local)'
        )
    }
    return createClient(url, key)
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors). If `tsconfig.json` excludes `scripts/`, that's fine — this
file lives under `src/` and is covered.

- [ ] **Step 4: Commit**

```bash
git add package.json src/lib/admin/import/client.ts
git commit -m "feat(import): add npm scripts + service-role client for local import"
```

---

## Task A2: Pure helpers + tests (TDD)

**Files:**
- Create: `src/lib/admin/import/helpers.ts`
- Test: `tests/unit/import-helpers.test.ts`

**Interfaces:**
- Produces:
  - `isAffirmative(answer: string): boolean`
  - `stripQuotes(raw: string): string`
  - `sanitizePdfFilename(rawName: string): string`
  - `isSafePdfFilename(name: string): boolean`
  - `dedupeNewBills(parsed: {idboll: number | null}[], existing: Set<number>): { toInsert: T[]; duplicateCount: number }` (generic over the bill shape)
  - `chunked<T>(items: T[], size: number, fn: (chunk: T[]) => Promise<void>): Promise<void>`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/import-helpers.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
    isAffirmative,
    stripQuotes,
    sanitizePdfFilename,
    isSafePdfFilename,
    dedupeNewBills,
} from '../../src/lib/admin/import/helpers'

test('isAffirmative accepts y/yes/s/si case-insensitively', () => {
    for (const yes of ['y', 'Y', 'yes', 'YES', 's', 'S', 'si', 'SI', ' si ']) {
        assert.equal(isAffirmative(yes), true, `expected true for "${yes}"`)
    }
    for (const no of ['', 'n', 'no', 'x', 'nope']) {
        assert.equal(isAffirmative(no), false, `expected false for "${no}"`)
    }
})

test('stripQuotes removes surrounding single/double quotes and trims', () => {
    assert.equal(stripQuotes('  "C:\\path\\file.csv"  '), 'C:\\path\\file.csv')
    assert.equal(stripQuotes("'/tmp/a.7z'"), '/tmp/a.7z')
    assert.equal(stripQuotes('plain'), 'plain')
})

test('sanitizePdfFilename collapses unsafe chars to underscore', () => {
    assert.equal(sanitizePdfFilename('12/34:56.pdf'), '12_34_56.pdf')
    assert.equal(sanitizePdfFilename('good name-1.pdf'), 'good name-1.pdf')
})

test('isSafePdfFilename rejects empty, dotfiles, and overlong names', () => {
    assert.equal(isSafePdfFilename('1234.pdf'), true)
    assert.equal(isSafePdfFilename(''), false)
    assert.equal(isSafePdfFilename('.hidden'), false)
    assert.equal(isSafePdfFilename('a'.repeat(201)), false)
})

test('dedupeNewBills drops existing and in-batch duplicate idboll, keeps null idboll', () => {
    const parsed = [
        { idboll: 1 }, { idboll: 2 }, { idboll: 2 }, { idboll: null }, { idboll: 3 },
    ]
    const existing = new Set<number>([3])
    const { toInsert, duplicateCount } = dedupeNewBills(parsed, existing)
    assert.deepEqual(toInsert.map(b => b.idboll), [1, 2, null])
    assert.equal(duplicateCount, 2) // one in-batch dup (2) + one existing (3)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot find module `helpers` / functions not defined.

- [ ] **Step 3: Implement the helpers**

Create `src/lib/admin/import/helpers.ts`:

```ts
/** True for y/yes/s/si (Italian + English), case-insensitive, trimmed. */
export function isAffirmative(answer: string): boolean {
    const a = answer.trim().toLowerCase()
    return a === 'y' || a === 'yes' || a === 's' || a === 'si'
}

/** Strip one layer of surrounding single/double quotes (drag-and-dropped paths). */
export function stripQuotes(raw: string): string {
    return raw.trim().replace(/^["']|["']$/g, '')
}

/** Collapse anything outside [A-Za-z0-9._- space] to underscore (matches old route). */
export function sanitizePdfFilename(rawName: string): string {
    return rawName.replace(/[^A-Za-z0-9._\- ]/g, '_')
}

/** Reject empty, dotfiles, and names longer than 200 chars (matches old route). */
export function isSafePdfFilename(name: string): boolean {
    return Boolean(name) && !name.startsWith('.') && name.length <= 200
}

/**
 * Filter parsed bills to only the new ones: drops any idboll already in `existing`
 * and any idboll seen twice within the batch (protects the UNIQUE index). Bills with
 * a null idboll are always kept.
 */
export function dedupeNewBills<T extends { idboll: number | null }>(
    parsed: T[],
    existing: Set<number>,
): { toInsert: T[]; duplicateCount: number } {
    const seen = new Set<number>()
    const toInsert = parsed.filter((b) => {
        const k = b.idboll
        if (typeof k === 'number' && k > 0) {
            if (existing.has(k) || seen.has(k)) return false
            seen.add(k)
        }
        return true
    })
    return { toInsert, duplicateCount: parsed.length - toInsert.length }
}

/** Run an async fn over fixed-size slices of items, sequentially. */
export async function chunked<T>(
    items: T[],
    size: number,
    fn: (chunk: T[]) => Promise<void>,
): Promise<void> {
    for (let i = 0; i < items.length; i += size) {
        await fn(items.slice(i, i + size))
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/import/helpers.ts tests/unit/import-helpers.test.ts
git commit -m "feat(import): pure helpers (dedup, filename, prompts) with node:test"
```

---

## Task A3: import_logs helpers

**Files:**
- Create: `src/lib/admin/import/import-logs.ts`

**Interfaces:**
- Consumes: `SupabaseClient` from `@supabase/supabase-js`.
- Produces:
  - `newImportId(): string`
  - `type ImportKind = 'bills' | 'users'`
  - `initImportLog(sb, importId, kind, archiveName, current?): Promise<void>`
  - `updateImportLog(sb, importId, current, processed, total): Promise<void>`
  - `completeImportLog(sb, importId, processed, total, errors?): Promise<void>`
  - `failImportLog(sb, importId, message): Promise<void>`

- [ ] **Step 1: Implement**

Create `src/lib/admin/import/import-logs.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

export type ImportKind = 'bills' | 'users'

/** Client-generated UUID used as import_logs.r2_path AND (for bills) the R2 prefix. */
export function newImportId(): string {
    return randomUUID()
}

export async function initImportLog(
    sb: SupabaseClient,
    importId: string,
    kind: ImportKind,
    archiveName: string | null,
    current = 'Avvio…',
): Promise<void> {
    const { error } = await sb.from('import_logs').upsert(
        {
            r2_path: importId,
            kind,
            archive_name: archiveName,
            status: 'processing',
            total_files: 0,
            processed_files: 0,
            current_file: current,
        },
        { onConflict: 'r2_path' },
    )
    if (error) console.error('[import_logs] init failed:', error.message)
}

export async function updateImportLog(
    sb: SupabaseClient,
    importId: string,
    current: string,
    processed: number,
    total: number,
): Promise<void> {
    const { error } = await sb
        .from('import_logs')
        .update({ current_file: current, processed_files: processed, total_files: total })
        .eq('r2_path', importId)
    if (error) console.error('[import_logs] update failed:', error.message)
}

export async function completeImportLog(
    sb: SupabaseClient,
    importId: string,
    processed: number,
    total: number,
    errors?: unknown,
): Promise<void> {
    const { error } = await sb
        .from('import_logs')
        .update({
            status: 'completed',
            current_file: 'Completato',
            processed_files: processed,
            total_files: total,
            ...(errors ? { errors: errors as object } : {}),
        })
        .eq('r2_path', importId)
    if (error) console.error('[import_logs] complete failed:', error.message)
}

export async function failImportLog(
    sb: SupabaseClient,
    importId: string,
    message: string,
): Promise<void> {
    const { error } = await sb
        .from('import_logs')
        .update({ status: 'error', current_file: message.slice(0, 200) })
        .eq('r2_path', importId)
    if (error) console.error('[import_logs] fail update failed:', error.message)
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin/import/import-logs.ts
git commit -m "feat(import): import_logs lifecycle helpers"
```

---

## Task A4: Prompts module

**Files:**
- Create: `src/lib/admin/import/prompts.ts`

**Interfaces:**
- Consumes: `isAffirmative`, `stripQuotes` from `./helpers`.
- Produces:
  - `createPrompter(): { ask(q): Promise<string>; confirm(q): Promise<boolean>; choose(q, options): Promise<number>; close(): void }`
  - `requireExistingFile(rawPath: string, label: string): string` — resolves, strips quotes, throws if missing.

- [ ] **Step 1: Implement**

Create `src/lib/admin/import/prompts.ts`:

```ts
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
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin/import/prompts.ts
git commit -m "feat(import): interactive prompt helpers (readline)"
```

---

## Task A5: Bills core (analyze + insert)

**Files:**
- Create: `src/lib/admin/import/bills-core.ts`

**Interfaces:**
- Consumes: `SupabaseClient`; `StandardCsvAdapter` from `@/lib/admin/adapters/standard-csv`;
  `ParsedBill` from `@/lib/admin/adapters/types`; `dedupeNewBills`, `chunked` from `./helpers`.
- Produces:
  - `interface BillsAnalysis { parsedRows: number; toInsert: number; duplicateBills: number; matchedUsers: number; parseErrors: string[]; billsToInsert: ParsedBill[] }`
  - `analyzeBills(sb, csvText): Promise<BillsAnalysis>`
  - `insertBills(sb, billsToInsert, importId, onProgress): Promise<{ inserted: number; errors: string[] }>`
  - `type ProgressFn = (current: string, processed: number, total: number) => Promise<void>`

- [ ] **Step 1: Implement**

Create `src/lib/admin/import/bills-core.ts` (ported from the old `/api/upload` route,
parse → dedup → link user_id → chunked insert):

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { StandardCsvAdapter } from '@/lib/admin/adapters/standard-csv'
import type { ParsedBill } from '@/lib/admin/adapters/types'
import { dedupeNewBills, chunked } from './helpers'

export type ProgressFn = (current: string, processed: number, total: number) => Promise<void>

export interface BillsAnalysis {
    parsedRows: number
    toInsert: number
    duplicateBills: number
    matchedUsers: number
    parseErrors: string[]
    billsToInsert: ParsedBill[]
}

/** Load every profile's codice_cliente → id (paged) for user linkage. */
async function loadClientCodeMap(sb: SupabaseClient): Promise<Map<string, string>> {
    const map = new Map<string, string>()
    const pageSize = 1000
    let page = 0
    for (;;) {
        const { data, error } = await sb
            .from('profiles')
            .select('id, codice_cliente')
            .range(page * pageSize, (page + 1) * pageSize - 1)
        if (error) throw new Error(`Errore lettura profili: ${error.message}`)
        for (const p of data ?? []) {
            if (p.codice_cliente) map.set(String(p.codice_cliente).trim(), p.id as string)
        }
        if (!data || data.length < pageSize) break
        page++
    }
    return map
}

/** Fetch existing idboll among the parsed set (chunked .in queries). */
async function loadExistingIdbolls(sb: SupabaseClient, idbolls: number[]): Promise<Set<number>> {
    const existing = new Set<number>()
    await chunked(idbolls, 1000, async (chunk) => {
        const { data } = await sb.from('bills').select('idboll').in('idboll', chunk)
        for (const row of data ?? []) {
            if (typeof row.idboll === 'number') existing.add(row.idboll)
        }
    })
    return existing
}

export async function analyzeBills(sb: SupabaseClient, csvText: string): Promise<BillsAnalysis> {
    const adapter = new StandardCsvAdapter()
    const { bills: parsed, errors: parseErrors } = await adapter.parse(csvText)

    const idbolls = parsed
        .map((b) => b.idboll)
        .filter((n): n is number => typeof n === 'number' && n > 0)
    const existing = idbolls.length ? await loadExistingIdbolls(sb, idbolls) : new Set<number>()

    const { toInsert, duplicateCount } = dedupeNewBills(parsed, existing)

    // Link user_id by codice_cliente (mutates the objects we will insert).
    const clientCodeMap = await loadClientCodeMap(sb)
    const matched = new Set<string>()
    for (const b of toInsert) {
        if (b.codice_cliente && clientCodeMap.has(b.codice_cliente)) {
            b.user_id = clientCodeMap.get(b.codice_cliente)!
            matched.add(b.user_id)
        }
    }

    return {
        parsedRows: parsed.length,
        toInsert: toInsert.length,
        duplicateBills: duplicateCount,
        matchedUsers: matched.size,
        parseErrors,
        billsToInsert: toInsert,
    }
}

export async function insertBills(
    sb: SupabaseClient,
    billsToInsert: ParsedBill[],
    importId: string,
    onProgress: ProgressFn,
): Promise<{ inserted: number; errors: string[] }> {
    const errors: string[] = []
    let processed = 0
    const total = billsToInsert.length

    await chunked(billsToInsert, 500, async (chunk) => {
        // Strip fields that aren't columns on bills; attach the FK.
        const rows = chunk.map(({ original_row_index, cfpi, ...rest }) => ({
            ...rest,
            import_log_id: importId,
        }))
        const { error } = await sb.from('bills').insert(rows)
        if (error) errors.push(`Batch @${processed}: ${error.message}`)
        processed += chunk.length
        await onProgress(`Salvataggio bollette ${Math.min(processed, total)}/${total}…`, processed, total)
    })

    return { inserted: processed, errors }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

> Note: `ParsedBill.user_id` is `string | null` and `original_row_index`/`cfpi` are
> optional, so the destructure-and-strip compiles. If `tsc` flags an unused-var on the
> destructured `original_row_index`/`cfpi`, prefix with `void` is unnecessary — the
> object-rest pattern is the accepted idiom and the existing route used it.

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin/import/bills-core.ts
git commit -m "feat(import): bills analyze + chunked insert (ported from /api/upload)"
```

---

## Task A6: PDF archive processing (7z → R2 → link)

**Files:**
- Create: `src/lib/admin/import/pdf-archive.ts`

**Interfaces:**
- Consumes: `SupabaseClient`; r2 helpers (`buildInvoiceKey`, `uploadPdfToR2`,
  `pdfExistsOnR2`, `listKeysWithPrefix`, `isR2Configured`) from `@/lib/r2`;
  `sanitizePdfFilename`, `isSafePdfFilename` from `./helpers`; `ProgressFn` from `./bills-core`.
- Produces:
  - `interface ArchiveAnalysis { pdfTotal: number; matches: number; alreadyLinked: number }`
  - `analyzeArchive(sb, archivePath, csvPdfNames: string[]): Promise<ArchiveAnalysis>`
  - `processArchive(sb, archivePath, importId, onProgress): Promise<{ uploaded: number; skipped: number; linked: number; errors: string[] }>`

- [ ] **Step 1: Implement**

Create `src/lib/admin/import/pdf-archive.ts` (ported from the archive branch of the old
route; keeps the 7za path fallbacks, R2-resume, and case-insensitive linking):

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import no7z from 'node-7z'
import sevenBin from '7zip-bin'
import {
    buildInvoiceKey,
    uploadPdfToR2,
    pdfExistsOnR2,
    listKeysWithPrefix,
    isR2Configured,
} from '@/lib/r2'
import { sanitizePdfFilename, isSafePdfFilename } from './helpers'
import type { ProgressFn } from './bills-core'

interface SevenZipError extends Error { stderr?: string }

/** Locate the 7za binary, with the same fallbacks the old route used (Windows). */
function resolve7zaPath(): string {
    let p = (sevenBin as { path7za: string }).path7za
    if (fs.existsSync(p)) return p
    const candidates = [
        path.join(process.cwd(), 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe'),
        path.join(process.cwd(), '..', 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe'),
    ]
    for (const c of candidates) if (fs.existsSync(c)) return c
    return p // let node-7z surface a clear error if truly missing
}

function tempPaths(archivePath: string): { archiveCopy: string; extractDir: string; tmpDir: string } {
    const tmpDir = path.join(process.cwd(), 'tmp')
    const safeName = path.basename(archivePath).replace(/[^a-z0-9.]/gi, '_')
    return {
        tmpDir,
        archiveCopy: path.join(tmpDir, safeName),
        extractDir: path.join(tmpDir, `extract_${safeName.replace(/\./g, '_')}`),
    }
}

/** List all *.pdf entries inside a 7z without extracting. */
function list7zPdfNames(archivePath: string, bin: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        const names: string[] = []
        const stream = no7z.list(archivePath, { $bin: bin, recursive: true })
        stream.on('data', (f: { file?: string }) => {
            if (f.file && f.file.toLowerCase().endsWith('.pdf')) names.push(f.file)
        })
        stream.on('end', () => resolve(names))
        stream.on('error', (e: SevenZipError) => reject(e))
    })
}

/** Map nome_pdf(lowercased) → pdf_url for every linked bill (paged). */
async function loadLinkedPdfMap(sb: SupabaseClient): Promise<Map<string, string>> {
    const map = new Map<string, string>()
    const pageSize = 2500
    let page = 0
    for (;;) {
        const { data, error } = await sb
            .from('bills')
            .select('nome_pdf, pdf_url')
            .not('nome_pdf', 'is', null)
            .range(page * pageSize, (page + 1) * pageSize - 1)
        if (error) break
        for (const d of data ?? []) {
            if (d.nome_pdf) map.set(String(d.nome_pdf).toLowerCase(), (d.pdf_url as string) || '')
        }
        if (!data || data.length < pageSize) break
        page++
    }
    return map
}

export interface ArchiveAnalysis { pdfTotal: number; matches: number; alreadyLinked: number }

export async function analyzeArchive(
    sb: SupabaseClient,
    archivePath: string,
    csvPdfNames: string[],
): Promise<ArchiveAnalysis> {
    const bin = resolve7zaPath()
    const pdfPaths = await list7zPdfNames(archivePath, bin)
    const zipNames = pdfPaths.map((p) => path.basename(p).toLowerCase())

    const dbMap = await loadLinkedPdfMap(sb)
    const csvSet = new Set(csvPdfNames.map((n) => n.toLowerCase()))

    const matchSet = new Set<string>()
    const alreadyLinked = new Set<string>()
    for (const name of zipNames) {
        if (dbMap.has(name)) {
            matchSet.add(name)
            const url = dbMap.get(name)
            if (url && url.trim().length > 0) alreadyLinked.add(name)
        }
        if (csvSet.has(name)) matchSet.add(name)
    }
    return { pdfTotal: pdfPaths.length, matches: matchSet.size, alreadyLinked: alreadyLinked.size }
}

function extract7z(archivePath: string, extractDir: string, bin: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const stream = no7z.extractFull(archivePath, extractDir, { $bin: bin, recursive: true })
        stream.on('end', () => resolve())
        stream.on('error', (e: SevenZipError) => reject(e))
    })
}

function walkFiles(dir: string, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) return out
    for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry)
        if (fs.statSync(full).isDirectory()) walkFiles(full, out)
        else out.push(full)
    }
    return out
}

export async function processArchive(
    sb: SupabaseClient,
    archivePath: string,
    importId: string,
    onProgress: ProgressFn,
): Promise<{ uploaded: number; skipped: number; linked: number; errors: string[] }> {
    if (!isR2Configured()) {
        throw new Error('R2 non configurato: imposta R2_ACCOUNT_ENDPOINT/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET in .env.local')
    }
    const bin = resolve7zaPath()
    const { tmpDir, archiveCopy, extractDir } = tempPaths(archivePath)
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

    let uploaded = 0
    let skipped = 0
    let linked = 0
    const errors: string[] = []

    try {
        // Copy into tmp then extract (node-7z reads from a real path).
        fs.copyFileSync(archivePath, archiveCopy)
        await onProgress('Estrazione archivio…', 0, 0)
        await extract7z(archiveCopy, extractDir, bin)

        const pdfFiles = walkFiles(extractDir).filter((f) => f.toLowerCase().endsWith('.pdf'))
        const total = pdfFiles.length
        let processed = 0
        await onProgress('Analisi PDF estratti…', 0, total)

        const linkedMap = await loadLinkedPdfMap(sb)
        const existingR2 = await listKeysWithPrefix(importId)

        const CONCURRENCY = 10
        for (let i = 0; i < pdfFiles.length; i += CONCURRENCY) {
            const chunk = pdfFiles.slice(i, i + CONCURRENCY)
            await Promise.all(
                chunk.map(async (filePath) => {
                    processed++
                    const rawName = path.basename(filePath)
                    const filename = sanitizePdfFilename(rawName)
                    if (!isSafePdfFilename(filename)) {
                        errors.push(`Nome file non sicuro, saltato: ${rawName}`)
                        return
                    }
                    const lower = filename.toLowerCase()

                    // Already linked in DB → skip.
                    const existingUrl = linkedMap.get(lower)
                    if (existingUrl && existingUrl.trim().length > 0) {
                        skipped++
                        return
                    }

                    const r2Key = buildInvoiceKey(filename, importId)
                    try {
                        const onR2 = existingR2.has(r2Key) || (await pdfExistsOnR2(r2Key))
                        if (!onR2) {
                            await uploadPdfToR2(r2Key, fs.readFileSync(filePath))
                            uploaded++
                        }
                        const { data, error } = await sb
                            .from('bills')
                            .update({ pdf_url: r2Key })
                            .ilike('nome_pdf', filename)
                            .select('id')
                        if (error) errors.push(`Link ${filename}: ${error.message}`)
                        else if (data && data.length > 0) linked++
                    } catch (err) {
                        errors.push(`Errore ${filename}: ${err instanceof Error ? err.message : String(err)}`)
                    }
                }),
            )
            if (processed % 50 === 0 || processed === total) {
                await onProgress(`Upload PDF ${processed}/${total}…`, processed, total)
            }
        }
    } finally {
        // Cleanup tmp copy + extraction dir.
        try { if (fs.existsSync(archiveCopy)) fs.unlinkSync(archiveCopy) } catch { /* ignore */ }
        try { if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true }) } catch { /* ignore */ }
    }

    return { uploaded, skipped, linked, errors }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS. If `node-7z`/`7zip-bin` lack precise types, the `@types/node-7z`
devDependency (already installed) covers `node-7z`; `7zip-bin` is typed via the inline
`{ path7za: string }` cast used above.

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin/import/pdf-archive.ts
git commit -m "feat(import): 7z extract + R2 upload + PDF linking (ported)"
```

---

## Task A7: Users core (profiles + supplies + mass-link)

**Files:**
- Create: `src/lib/admin/import/users-core.ts`

**Interfaces:**
- Consumes: `SupabaseClient`; `parse` from `csv-parse/sync`; `chunked` from `./helpers`;
  `ProgressFn` from `./bills-core`.
- Produces:
  - `interface UsersAnalysis { records: number; profiles: number; supplies: number; skipped: { annullato: number; noCif: number; shortCif: number; admin: number }; profilePayloads: Map<string, ProfilePayload>; supplyPayloads: Map<string, SupplyPayload> }`
  - `analyzeUsers(sb, csvText): Promise<UsersAnalysis>`
  - `commitUsers(sb, analysis, onProgress): Promise<{ imported: number; suppliesUpserted: number; errors: string[]; link: Record<string, number> | null }>`

- [ ] **Step 1: Implement**

Create `src/lib/admin/import/users-core.ts` (ported from `/api/upload-users`):

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse/sync'
import { chunked } from './helpers'
import type { ProgressFn } from './bills-core'

interface ProfilePayload {
    codice_cliente: string
    name: string | null
    codice_fiscale: string | null
    partita_iva: string | null
    email: string | null
    pec: string | null
    is_shadow: boolean
    role: 'user'
}
interface SupplyPayload {
    codice_cliente: string
    cif: string
    address: string | null
    city: string | null
    stadio: string | null
    stato_contratto: string | null
}

export interface UsersAnalysis {
    records: number
    profiles: number
    supplies: number
    skipped: { annullato: number; noCif: number; shortCif: number; admin: number }
    profilePayloads: Map<string, ProfilePayload>
    supplyPayloads: Map<string, SupplyPayload>
}

const clean = (v: unknown): string | null => (v == null ? null : String(v).trim() || null)

export async function analyzeUsers(sb: SupabaseClient, csvText: string): Promise<UsersAnalysis> {
    const records = parse(csvText, {
        columns: true,
        delimiter: ';',
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true,
    }) as Record<string, string>[]

    // Reserved admin codice_cliente values must never be touched by an import.
    const { data: adminRows } = await sb
        .from('profiles')
        .select('codice_cliente')
        .in('role', ['admin', 'super_admin', 'superadmin'])
        .not('codice_cliente', 'is', null)
    const adminCodes = new Set<string>((adminRows ?? []).map((r) => r.codice_cliente as string))

    const profilePayloads = new Map<string, ProfilePayload>()
    const supplyPayloads = new Map<string, SupplyPayload>()
    const skipped = { annullato: 0, noCif: 0, shortCif: 0, admin: 0 }

    for (const row of records) {
        const cif = clean(row['CIF'])
        const statoContratto = clean(row['statoContratto'])
        const isAnnullato = statoContratto === '08'
        if (isAnnullato) skipped.annullato++
        if (!cif) { skipped.noCif++; continue }

        const clientCode = cif.length >= 6 ? cif.substring(0, 6) : null
        if (!clientCode) { skipped.shortCif++; continue }
        if (adminCodes.has(clientCode)) { skipped.admin++; continue }

        const emailRaw = clean(row['Mail'])
        if (!isAnnullato) {
            profilePayloads.set(clientCode, {
                codice_cliente: clientCode,
                name: clean(row['RagioneSociale']),
                codice_fiscale: clean(row['CodiceFiscale']),
                partita_iva: clean(row['PartitaIva']),
                email: emailRaw ? emailRaw.toLowerCase() : null,
                pec: clean(row['PEC'])?.toLowerCase() ?? null,
                is_shadow: true,
                role: 'user',
            })
        }
        supplyPayloads.set(cif, {
            codice_cliente: clientCode,
            cif,
            address: clean(row['indirizzo']),
            city: clean(row['comune']),
            stadio: clean(row['stadio']),
            stato_contratto: statoContratto,
        })
    }

    return {
        records: records.length,
        profiles: profilePayloads.size,
        supplies: supplyPayloads.size,
        skipped,
        profilePayloads,
        supplyPayloads,
    }
}

export async function commitUsers(
    sb: SupabaseClient,
    analysis: UsersAnalysis,
    onProgress: ProgressFn,
): Promise<{ imported: number; suppliesUpserted: number; errors: string[]; link: Record<string, number> | null }> {
    const errors: string[] = []
    let imported = 0
    const profiles = [...analysis.profilePayloads.values()]
    const total = analysis.records

    let done = 0
    for (const payload of profiles) {
        try {
            const { data: existing, error: fetchErr } = await sb
                .from('profiles')
                .select('id, codice_cliente, email, name, codice_fiscale, partita_iva, pec, is_shadow')
                .eq('codice_cliente', payload.codice_cliente)
                .maybeSingle()
            if (fetchErr) throw fetchErr

            if (existing) {
                const updates: Record<string, unknown> = {}
                if (!existing.codice_cliente) updates.codice_cliente = payload.codice_cliente
                for (const f of ['name', 'codice_fiscale', 'partita_iva', 'pec'] as const) {
                    const incoming = payload[f]
                    if (incoming && incoming !== existing[f]) updates[f] = incoming
                }
                if (payload.email) {
                    const cur = (existing.email || '').toLowerCase().trim()
                    if (payload.email !== cur && (!cur || existing.is_shadow)) updates.email = payload.email
                    else if (payload.email !== cur) {
                        errors.push(`Email cambiata per utente attivo ${payload.codice_cliente}: ignorata.`)
                    }
                }
                if (Object.keys(updates).length > 0) {
                    const { error } = await sb.from('profiles').update(updates).eq('id', existing.id)
                    if (error) throw error
                }
            } else {
                const { error } = await sb.from('profiles').insert(payload)
                if (error) throw error
            }
            imported++
        } catch (err) {
            errors.push(`Profilo ${payload.codice_cliente}: ${err instanceof Error ? err.message : String(err)}`)
        }
        done++
        if (done % 50 === 0) await onProgress(`Profili ${done}/${profiles.length}…`, Math.round((done / profiles.length) * total * 0.85), total)
    }

    await onProgress('Salvataggio forniture…', Math.round(total * 0.85), total)
    let suppliesUpserted = 0
    const supplyRows = [...analysis.supplyPayloads.values()]
    await chunked(supplyRows, 1000, async (chunk) => {
        const { error, count } = await sb
            .from('user_supplies')
            .upsert(chunk, { onConflict: 'cif', ignoreDuplicates: false, count: 'exact' })
        if (error) errors.push(`Forniture: ${error.message}`)
        else suppliesUpserted += count ?? chunk.length
    })

    await onProgress('Collegamento bollette…', Math.round(total * 0.95), total)
    let link: Record<string, number> | null = null
    const { data: linkData, error: linkErr } = await sb.rpc('mass_link_orphaned_data')
    if (linkErr) errors.push(`Mass-link RPC: ${linkErr.message}`)
    else if (Array.isArray(linkData) && linkData.length > 0) link = linkData[0] as Record<string, number>

    return { imported, suppliesUpserted, errors, link }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin/import/users-core.ts
git commit -m "feat(import): users/supplies upsert + mass-link (ported from /api/upload-users)"
```

---

## Task A8: Interactive orchestration entry point

**Files:**
- Create: `scripts/import-data.ts`

**Interfaces:**
- Consumes (via dynamic import, AFTER dotenv): `createServiceClient`, `newImportId`,
  `initImportLog`/`updateImportLog`/`completeImportLog`/`failImportLog`, `analyzeBills`,
  `insertBills`, `analyzeArchive`, `processArchive`, `analyzeUsers`, `commitUsers`,
  `createPrompter`, `requireExistingFile`.
- Produces: the runnable `npm run import` command.

- [ ] **Step 1: Implement**

Create `scripts/import-data.ts`. Note the ordering rule: only `dotenv`/`path`/`fs` and
the prompts module are statically imported; everything touching env (r2/client) is
imported dynamically inside `main()`.

```ts
/**
 * Interactive local bulk-import tool. Run: `npm run import`
 *
 * Modes:
 *   1) Anagrafiche utenti (CSV)         → profiles + user_supplies + mass-link
 *   2) Bollette + PDF (CSV + 7z)        → bills insert + PDF upload to R2 + link
 *
 * Each run: pick mode → pick file(s) → PREVIEW (nothing written) → confirm → COMMIT.
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, R2_* (.env / .env.local)
 */
import dotenv from 'dotenv'
import path from 'node:path'
import fs from 'node:fs'

dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

async function main() {
    // Dynamic imports so dotenv has populated process.env before r2.ts evaluates.
    const { createServiceClient } = await import('../src/lib/admin/import/client')
    const logs = await import('../src/lib/admin/import/import-logs')
    const bills = await import('../src/lib/admin/import/bills-core')
    const pdf = await import('../src/lib/admin/import/pdf-archive')
    const users = await import('../src/lib/admin/import/users-core')
    const { createPrompter, requireExistingFile } = await import('../src/lib/admin/import/prompts')

    const sb = createServiceClient()
    const p = createPrompter()

    try {
        const mode = await p.choose('Cosa vuoi importare?', [
            'Anagrafiche utenti (CSV)',
            'Bollette + PDF (CSV + 7z)',
        ])

        if (mode === 0) {
            // ---- USERS ----
            const csvPath = requireExistingFile(await p.ask('Percorso CSV anagrafiche: '), 'CSV')
            const csvText = fs.readFileSync(csvPath, 'utf8')

            console.log('\nAnalisi in corso…')
            const a = await users.analyzeUsers(sb, csvText)
            console.log(`\n— Anteprima —
  Righe CSV:            ${a.records}
  Profili da importare: ${a.profiles}
  Forniture:            ${a.supplies}
  Saltati: annullati=${a.skipped.annullato} noCif=${a.skipped.noCif} cifCorto=${a.skipped.shortCif} admin=${a.skipped.admin}\n`)

            if (!(await p.confirm('Procedere con la scrittura?'))) { console.log('Annullato.'); return }

            const importId = logs.newImportId()
            await logs.initImportLog(sb, importId, 'users', path.basename(csvPath), 'Import anagrafiche…')
            const onProgress = async (c: string, done: number, total: number) => {
                process.stdout.write(`\r${c.padEnd(48)}`)
                await logs.updateImportLog(sb, importId, c, done, total)
            }
            const res = await users.commitUsers(sb, a, onProgress)
            process.stdout.write('\n')
            await logs.completeImportLog(sb, importId, a.records, a.records, { errors: res.errors })
            console.log(`\nFatto. Profili: ${res.imported}, Forniture: ${res.suppliesUpserted}, Errori: ${res.errors.length}`)
            if (res.link) console.log(`Bollette agganciate: ${JSON.stringify(res.link)}`)
            if (res.errors.length) console.log(res.errors.slice(0, 20).join('\n'))
        } else {
            // ---- BILLS + PDF ----
            const csvPath = requireExistingFile(await p.ask('Percorso CSV bollette (Xml…): '), 'CSV')
            const archivePath = requireExistingFile(await p.ask('Percorso archivio 7z: '), 'Archivio')
            const csvText = fs.readFileSync(csvPath, 'utf8')

            console.log('\nAnalisi CSV…')
            const a = await bills.analyzeBills(sb, csvText)
            console.log('Analisi archivio…')
            const arch = await pdf.analyzeArchive(sb, archivePath, a.billsToInsert.map((b) => b.nome_pdf))
            console.log(`\n— Anteprima —
  Righe CSV:              ${a.parsedRows}
  Bollette nuove:         ${a.toInsert}
  Duplicati (saltati):    ${a.duplicateBills}
  Clienti collegati:      ${a.matchedUsers}
  PDF nell'archivio:      ${arch.pdfTotal}
  PDF nuovi:              ${arch.matches - arch.alreadyLinked}
  PDF già presenti:       ${arch.alreadyLinked}
  Errori parsing:         ${a.parseErrors.length}\n`)

            if (!(await p.confirm('Procedere con la scrittura?'))) { console.log('Annullato.'); return }

            const importId = logs.newImportId()
            await logs.initImportLog(sb, importId, 'bills', path.basename(archivePath), 'Import bollette…')
            const onProgress = async (c: string, done: number, total: number) => {
                process.stdout.write(`\r${c.padEnd(48)}`)
                await logs.updateImportLog(sb, importId, c, done, total)
            }

            const ins = await bills.insertBills(sb, a.billsToInsert, importId, onProgress)
            const pr = await pdf.processArchive(sb, archivePath, importId, onProgress)
            process.stdout.write('\n')

            const allErrors = [...a.parseErrors, ...ins.errors, ...pr.errors]
            await logs.completeImportLog(sb, importId, pr.uploaded + pr.skipped, arch.pdfTotal, { errors: allErrors })
            console.log(`\nFatto. Bollette inserite: ${ins.inserted}, PDF caricati: ${pr.uploaded}, collegati: ${pr.linked}, saltati: ${pr.skipped}, errori: ${allErrors.length}`)
            if (allErrors.length) console.log(allErrors.slice(0, 20).join('\n'))
        }
    } finally {
        p.close()
    }
}

main().catch((err) => {
    console.error('\nFallito:', err instanceof Error ? err.message : err)
    process.exit(1)
})
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS. (If `tsconfig.json` does not include `scripts/`, run
`node node_modules/.bin/tsc --noEmit scripts/import-data.ts` once to confirm it compiles;
existing scripts under `scripts/` already run under `tsx`, so this is a sanity check only.)

- [ ] **Step 3: Smoke-test the prompt (no data)**

Run: `npm run import`
Then choose mode `1`, and at the CSV path prompt type a non-existent path.
Expected: the menu renders; an invalid path prints `CSV non trovato: <resolved>` and the
script exits non-zero. This proves wiring + env load without writing anything.

- [ ] **Step 4: Commit**

```bash
git add scripts/import-data.ts
git commit -m "feat(import): interactive import-data.ts entry (mode → files → preview → confirm)"
```

---

## Task A9: End-to-end verification with a small fixture

**Files:** none (verification only).

- [ ] **Step 1: Prepare a tiny fixture**

Create a scratch CSV with 2–3 rows in the standard layout (`;`-delimited:
CIF;CFPIVA;NOMEPDF;SERVIZIO;EMISSIONE;SCADENZA;IMPORTO;CONSUMO;MPxx;TIPO), where the
`NOMEPDF` column names match a 2–3 file `.7z` you build from real (or dummy) PDFs whose
filenames are numeric (e.g. `900001.pdf`). Place both under a scratch folder outside the
repo (e.g. `C:\tmp\import-fixture\`).

- [ ] **Step 2: Preview run (writes nothing)**

Run: `npm run import` → mode `2` → point at the fixture CSV and 7z → at the confirm
prompt answer `n`.
Expected: the preview block prints sensible counts (`Bollette nuove`, `PDF nuovi`, etc.)
and the script exits with **no** rows written. Verify in Supabase that no new `bills`
or `import_logs` row appeared.

- [ ] **Step 3: Commit run**

Run again → mode `2` → same files → confirm `y`.
Expected: bills inserted, PDFs uploaded to R2 under `<importId>/`, `bills.pdf_url` set,
and a new `import_logs` row with `kind='bills'`, `status='completed'`.

- [ ] **Step 4: Re-run (dedup + resume)**

Run again → mode `2` → same files → confirm `y`.
Expected: `Duplicati (saltati)` equals the fixture row count, `PDF già presenti` > 0,
`PDF caricati` = 0 (resume/skip works). No duplicate `bills` rows created.

- [ ] **Step 5: Verify the recap page still reads it**

Open `/admin/upload` in the running app (dev). The new fixture import appears in
**Storico Caricamenti** with the right record count, and the per-row delete removes it
(cascading bills + R2). Delete the fixture import to clean up.

- [ ] **Step 6: No commit** (verification task; nothing to commit). If any issue is
  found, fix the relevant module in its own task and re-run this verification.

---

# Phase B — Vercel-side teardown

> Do Phase B only after Phase A is verified — the script must fully replace the routes
> before they are deleted.

## Task B1: Rewrite the Centro Caricamento page (recap-only)

**Files:**
- Modify (replace whole file): `src/app/admin/upload/page.tsx`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/client`; `AdminPageHero`; `toast`;
  `useRouter`. No longer consumes `useAdminUpload`.
- Produces: a client page that fetches `import_logs` (kind='bills'), renders the recap
  header (total records, search, Esporta CSV), the history list with per-row delete, and
  a static info banner about `npm run import`.

- [ ] **Step 1: Replace the file**

Overwrite `src/app/admin/upload/page.tsx` with the recap-only version below. It keeps the
super_admin guard, the `fetchLogs`/`handleDeleteImport` logic, and the `UploadHistory`
component verbatim from the current file, and replaces the three upload cards + preview
modal + FAB with an info banner.

```tsx
'use client'

import { useState, useEffect } from 'react'
import {
    AlertCircle, Loader2, Check, Trash2, History, Search, Download, Database, Terminal,
} from 'lucide-react'
import { toast } from 'sonner'
import { AdminPageHero } from '@/components/admin/admin-page-hero'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AdminUploadPage() {
    const [role, setRole] = useState<string | null>(null)
    const [loadingRole, setLoadingRole] = useState(true)
    const [logs, setLogs] = useState<any[]>([])
    const [loadingLogs, setLoadingLogs] = useState(false)
    const supabase = createClient()
    const router = useRouter()

    const fetchLogs = async () => {
        setLoadingLogs(true)
        try {
            const { data, error } = await supabase
                .from('import_logs')
                .select('*')
                .eq('kind', 'bills')
                .order('created_at', { ascending: false })
                .limit(200)
            if (error) throw error
            setLogs(data || [])
        } catch (err: any) {
            console.error('Error fetching logs:', err.message)
        } finally {
            setLoadingLogs(false)
        }
    }

    useEffect(() => {
        if (role === 'superadmin' || role === 'super_admin') fetchLogs()
    }, [role])

    const handleDeleteImport = async (id: string) => {
        if (!confirm('Sei sicuro di voler eliminare questo caricamento? Verranno eliminate anche tutte le bollette associate e i file su R2.')) return
        try {
            const res = await fetch(`/api/upload/${id}`, { method: 'DELETE' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Errore eliminazione')
            toast.success('Importazione eliminata con successo')
            fetchLogs()
        } catch (err: any) {
            toast.error(err.message)
        }
    }

    useEffect(() => {
        async function checkRole() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.push('/login'); return }
            const { data: profile } = await supabase
                .from('profiles').select('role').eq('auth_user_id', user.id).single()
            const userRole = profile?.role
            setRole(userRole)
            setLoadingRole(false)
            if (userRole !== 'superadmin' && userRole !== 'super_admin') {
                toast.error('Accesso limitato ai Super Admin')
                router.push('/admin/users')
            }
        }
        checkRole()
    }, [])

    if (loadingRole) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="animate-spin text-slate-300 dark:text-slate-700" size={32} />
                    <span className="text-[12px] font-medium text-slate-400">Verifica permessi...</span>
                </div>
            </div>
        )
    }

    if (role !== 'superadmin' && role !== 'super_admin') return null

    return (
        <>
            <AdminPageHero title="Centro Caricamento" />
            <div className="h-full overflow-y-auto custom-scrollbar flex flex-col gap-6 px-6 py-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <ImportInfoBanner />
                <UploadHistory logs={logs} loading={loadingLogs} onDelete={handleDeleteImport} />
            </div>
        </>
    )
}

function ImportInfoBanner() {
    return (
        <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-6">
            <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
                    <Terminal size={22} />
                </div>
                <div className="min-w-0">
                    <h3 className="text-[15px] font-bold text-slate-900 dark:text-white">Le importazioni si eseguono in locale</h3>
                    <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        Per motivi di dimensione e sicurezza, il caricamento massivo di bollette (CSV + 7z) e anagrafiche
                        non avviene più dal web. Eseguilo dal computer autorizzato con:
                    </p>
                    <code className="inline-block mt-3 px-3 py-2 rounded-lg bg-slate-100 dark:bg-white/5 text-[13px] font-mono font-bold text-slate-800 dark:text-slate-100">
                        npm run import
                    </code>
                    <p className="text-[12px] text-slate-400 mt-3 leading-relaxed">
                        Lo script è interattivo: scegli la modalità (anagrafiche oppure bollette+PDF), indica i file,
                        controlla l&apos;anteprima e conferma. I risultati compaiono qui sotto nello storico.
                    </p>
                </div>
            </div>
        </div>
    )
}

function UploadHistory({ logs, loading, onDelete }: any) {
    const [query, setQuery] = useState('')

    if (loading && logs.length === 0) {
        return (
            <div className="mt-4 p-12 text-center flex flex-col items-center gap-3">
                <Loader2 className="animate-spin text-slate-300" size={24} />
                <span className="text-[13px] font-medium text-slate-400">Caricamento storico...</span>
            </div>
        )
    }

    const filtered = query.trim()
        ? logs.filter((l: any) => (l.archive_name || 'Importazione Manuale').toLowerCase().includes(query.trim().toLowerCase()))
        : logs
    const totalRecords = logs.reduce((s: number, l: any) => s + (l.processed_files || 0), 0)

    const exportCsv = () => {
        const header = ['Archivio', 'Record', 'Stato', 'Data']
        const rows = logs.map((l: any) => [
            l.archive_name || 'Importazione Manuale',
            String(l.processed_files ?? 0),
            l.status || '',
            new Date(l.created_at).toLocaleString('it-IT'),
        ])
        const csv = [header, ...rows]
            .map(r => r.map((c: string) => `"${String(c).replace(/"/g, '""')}"`).join(','))
            .join('\n')
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'storico_caricamenti.csv'
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="space-y-5 pb-20">
            <div className="flex items-center justify-between gap-4 px-2 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-600 dark:text-slate-400">
                        <History size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Storico Caricamenti</h2>
                        <p className="text-[11px] text-slate-500 font-medium">
                            {logs.length} importazion{logs.length === 1 ? 'e' : 'i'}
                            {query.trim() && ` · ${filtered.length} risultat${filtered.length === 1 ? 'o' : 'i'}`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                    <div className="flex items-center gap-2 h-9 px-3.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 shrink-0">
                        <Database size={13} className="text-slate-400" />
                        <span className="text-[13px] font-bold text-slate-800 dark:text-white tabular-nums">{totalRecords.toLocaleString('it-IT')}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">record totali</span>
                    </div>
                    <div className="relative flex-1 sm:w-56">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                            placeholder="Cerca archivio..."
                            className="w-full h-9 pl-9 pr-4 rounded-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[12px] text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-slate-300 dark:focus:border-white/20 transition-all"
                        />
                    </div>
                    <button
                        onClick={exportCsv} disabled={logs.length === 0}
                        className="h-9 px-3.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-[#1A1F2A] text-[12px] font-bold flex items-center gap-2 hover:bg-slate-800 dark:hover:bg-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                        title="Esporta la lista (archivio + n. record) in CSV"
                    >
                        <Download size={14} />
                        <span className="hidden sm:inline">Esporta CSV</span>
                    </button>
                </div>
            </div>

            {logs.length === 0 ? (
                <div className="p-12 text-center rounded-[2rem] border border-dashed border-slate-200 dark:border-white/10">
                    <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-300 dark:text-slate-700 mx-auto mb-4">
                        <History size={24} />
                    </div>
                    <p className="text-slate-400 text-[13px] font-medium">Nessun caricamento registrato nel database.</p>
                </div>
            ) : (
                <div className="rounded-3xl border border-slate-200 dark:border-white/10 overflow-hidden bg-white dark:bg-white/[0.02]">
                    <div className="divide-y divide-slate-100 dark:divide-white/5">
                        {filtered.map((log: any) => (
                            <div key={log.id} className="group flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors">
                                <div className="flex items-center gap-3.5 min-w-0">
                                    <div className={cn(
                                        'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                                        log.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                                        log.status === 'error' ? 'bg-rose-500/10 text-rose-500' : 'bg-sky-500/10 text-sky-500'
                                    )}>
                                        {log.status === 'completed' ? <Check size={16} strokeWidth={3} /> :
                                         log.status === 'error' ? <AlertCircle size={16} /> : <Loader2 size={16} className="animate-spin" />}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <h4 className="font-bold text-slate-900 dark:text-white text-[13.5px] truncate">{log.archive_name || 'Importazione Manuale'}</h4>
                                            <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-[9px] font-bold text-slate-500 font-mono tracking-tighter">
                                                {new Date(log.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 min-w-0">
                                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 shrink-0">
                                                <Database size={11} className="text-slate-400" />
                                                <span className="text-slate-700 dark:text-slate-300 font-bold tabular-nums">{log.processed_files}</span>
                                                <span className="text-[10px] text-slate-400 uppercase tracking-tight">record</span>
                                            </div>
                                            {log.status === 'error' && (
                                                <span className="text-[11px] text-rose-500 font-bold bg-rose-500/5 px-2 py-0.5 rounded-lg border border-rose-500/10 truncate">{log.current_file}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => onDelete(log.id)}
                                    className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100 shrink-0"
                                    title="Elimina questo import"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                        {filtered.length === 0 && (
                            <div className="px-4 py-10 text-center text-[12px] text-slate-400 italic">
                                Nessun caricamento corrisponde a “{query}”.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no remaining reference to `useAdminUpload`).

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/upload/page.tsx
git commit -m "feat(admin/upload): recap-only Centro Caricamento (info banner + history/export/delete)"
```

---

## Task B2: Remove the upload provider + global progress bar

**Files:**
- Delete: `src/components/providers/admin-upload-provider.tsx`
- Delete: `src/components/ui/global-progress-bar.tsx`
- Modify: `src/components/admin/admin-layout-shell.tsx`

**Interfaces:**
- Removes the `AdminUploadProvider` wrapper and `<GlobalProgressBar />` mount. The nav
  item for `/admin/upload` stays (points at the recap page).

- [ ] **Step 1: Edit admin-layout-shell.tsx — drop the imports**

Remove these two lines (currently 21–22):

```tsx
import { AdminUploadProvider } from '@/components/providers/admin-upload-provider'
import { GlobalProgressBar } from '@/components/ui/global-progress-bar'
```

- [ ] **Step 2: Edit admin-layout-shell.tsx — unwrap the provider**

Change the outer element from `<AdminUploadProvider>…</AdminUploadProvider>` to a
fragment. Replace the opening `return (\n        <AdminUploadProvider>` with `return (\n        <>`
and the closing `</AdminUploadProvider>\n    )` with `</>\n    )`. Also delete the
`<GlobalProgressBar />` line (currently line 232).

The wrapper becomes:

```tsx
    return (
        <>
            <div className="min-h-screen w-full bg-white dark:bg-[#0F1115] text-slate-700 dark:text-slate-200 font-sans flex">
                {/* ...unchanged sidebar + main... */}
            </div>
        </>
    )
```

- [ ] **Step 3: Delete the two component files**

```bash
git rm src/components/providers/admin-upload-provider.tsx src/components/ui/global-progress-bar.tsx
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS. If any other file still imports `useAdminUpload`/`GlobalProgressBar`, the
compiler will point at it — grep to confirm none remain:
Run: `git grep -n "useAdminUpload\|GlobalProgressBar\|admin-upload-provider"`
Expected: no matches.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(admin): remove upload provider + global progress bar (web upload retired)"
```

---

## Task B3: Delete the ingest Route Handlers

**Files:**
- Delete: `src/app/api/upload/route.ts`
- Delete: `src/app/api/upload-users/route.ts`

Note: `src/app/api/upload/[id]/route.ts` (DELETE batch, `requireSuperadmin`) STAYS.

- [ ] **Step 1: Delete the two route files**

```bash
git rm src/app/api/upload/route.ts src/app/api/upload-users/route.ts
```

- [ ] **Step 2: Confirm nothing references them**

Run: `git grep -n "'/api/upload'\|/api/upload-users\|fetch(\`/api/upload\`"`
Expected: no matches (the recap page only calls `/api/upload/${id}` for delete, which is
a different, surviving route — verify that match, if any, is the `[id]` delete call).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(api): remove bulk ingest routes (moved to local npm run import)"
```

---

## Task B4: Clean up next.config.ts

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Remove the upload-only config**

Delete the `experimental.serverActions` block and the `outputFileTracingExcludes` block
(both existed only for `/api/upload`). The file becomes:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: ['injured-maddie-imperfectly.ngrok-free.dev'],
};

export default nextConfig;
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "chore(next): drop serverActions bodySizeLimit + upload tracing (route removed)"
```

---

## Task B5: Full build sanity + push

**Files:** none (verification).

- [ ] **Step 1: Ensure the dev server is stopped**

Per the global constraint, `next build` while `next dev` runs corrupts `.next`. Confirm no
`next dev` process is running before building.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds; no references to deleted routes/components; `/admin/upload` is
built as a client page. If the build fails on a missing import, fix in the relevant task.

- [ ] **Step 3: Push**

```bash
git push origin master
```

---

## Self-Review

**1. Spec coverage**
- Standalone local `tsx` script, `npm run import` → Tasks A1, A8. ✅
- Interactive prompts (mode → files → preview → confirm) → Task A8. ✅
- Reuse StandardCsvAdapter + r2 helpers + service-role client → Tasks A5, A6, A1. ✅
- `import_logs` with `r2_path=importId`, `kind` set, FK preserved → Task A3, A5–A8. ✅
- Resume (skip PDFs already in R2 under importId) → Task A6 (`listKeysWithPrefix`). ✅
- Vercel: remove ingest routes → B3; remove bodySizeLimit/tracing → B4. ✅
- Repurpose page recap-only (banner + history + export + delete) → B1. ✅
- Remove provider + GlobalProgressBar (spec-corrected) → B2. ✅
- Batch delete route kept → B3 note. ✅
- Users mode (profiles + supplies + mass-link RPC) → A7. ✅

**2. Placeholder scan** — no TBD/TODO; every code step contains complete code; verification
steps contain exact commands and expected outcomes. ✅

**3. Type consistency** — `ProgressFn` is defined once in `bills-core.ts` and imported by
`pdf-archive.ts` and `users-core.ts`. `newImportId`/`initImportLog`/`updateImportLog`/
`completeImportLog`/`failImportLog` names match between A3 and A8. `analyzeBills` returns
`billsToInsert` consumed by `insertBills` and `analyzeArchive`. `analyzeUsers` returns the
`UsersAnalysis` consumed by `commitUsers`. ✅

**Known deviations from the original spec (flagged for reviewer):**
- The spec's earlier "keep GlobalProgressBar" line is superseded (Task B2) — it is
  provider-driven and non-functional once web uploads are gone; the spec was updated to
  reflect this.
- Module layout is `src/lib/admin/import/*` (not one file), per the spec's "small,
  single-purpose modules" principle.
