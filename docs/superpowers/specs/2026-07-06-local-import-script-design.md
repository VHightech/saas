# Design — Local standalone import script for bulk ingestion

**Date:** 2026-07-06
**Status:** Approved (design), pending implementation plan
**Owner:** Valdelsa High Tech

## Problem

Bulk data ingestion (bills CSV + 7z PDF archive, and the users/anagrafica CSV)
currently runs as two Next.js Route Handlers:

- `src/app/api/upload/route.ts` — bills CSV + 7z PDF archive → Supabase + R2.
- `src/app/api/upload-users/route.ts` — users/anagrafica CSV → Supabase.

These cannot run on Vercel:

- they spawn a **native `7za` binary** (`7zip-bin` / `node-7z`);
- they **read/write the local filesystem** (`process.cwd()/tmp`, `public/invoices/acq`);
- they expect **very large request bodies** (the `serverActions.bodySizeLimit: '500mb'`
  was raised for this; Vercel serverless also caps request bodies at ~4.5 MB and has a
  read-only filesystem).

They are also the single largest attack-surface item in the app: a service-role
+ shell-out + arbitrary-file-write endpoint.

**Usage profile (confirmed):** uploads are **big & rare** — hundreds of MB to a few
GB per archive, run occasionally (≈ monthly). A manual, run-when-needed process is
acceptable. The operator is effectively the **super_admin**, working from their own PC.

## Goal

Move bulk ingestion out of the hosted app entirely, into a **standalone local
script** the super_admin runs on their machine, while keeping the lightweight admin
features (history, batch-delete, users, invite, settings) on Vercel.

Non-goals: queues, always-on workers, browser→R2 presigned uploads, or any new
hosted infrastructure (all rejected as over-engineered for a big-and-rare workload).

## Architecture — one codebase, two run targets

### Vercel (public app)
Everything as today **except** bulk ingestion. Keeps:
- Public user area (login, dashboard, profile, bill/PDF view via `/api/bills/[id]/pdf`).
- Admin import **history / batch list** page (reads `import_logs`).
- **Batch delete** `/api/upload/[id]` (DELETE, `requireSuperadmin`) — pure R2 + DB.
- `GlobalProgressBar` polling `import_logs` (harmless; shows nothing unless a run is active).

### Local (super_admin's PC)
A single standalone `tsx` script, `npm run import`, that performs ingestion directly
against Supabase (service-role) + R2, driven by interactive prompts. Same pattern as
existing `scripts/backfill-from-csv.ts`, `scripts/relink-bills-from-r2.ts`, etc.
Config loaded from `.env.local` via `dotenv`.

## The import script

**Entry point:** `scripts/import-data.ts`, wired as `"import": "tsx scripts/import-data.ts"`
in `package.json`.

**Interactive flow:**
1. **Pick mode** — `(1) Anagrafiche utenti (CSV)` or `(2) Bollette + PDF (CSV + 7z)`.
2. **Pick file(s)** — prompt for CSV path; for mode 2 also the 7z archive path.
   Validate existence before continuing.
3. **Preview / dry-run** — parse and report counts (rows, new vs duplicate `idboll`,
   matched users, PDFs in archive vs already-linked) **without writing anything**.
   Reuses the existing preview logic from the route.
4. **Confirm** — explicit `y/N`. On no, exit clean.
5. **Commit** — insert bills / upsert profiles+supplies, extract 7z, upload PDFs to R2,
   link them, write progress + final status to `import_logs`.

**Code reuse (port core, drop HTTP shell):** the script reuses, without rewriting logic:
- `StandardCsvAdapter` (`src/lib/admin/adapters/standard-csv.ts`) for parsing.
- `r2.ts` helpers: `buildInvoiceKey`, `uploadPdfToR2`, `pdfExistsOnR2`,
  `listKeysWithPrefix`, `isR2Configured`.
- A service-role Supabase client.
- The same `import_logs` upsert keyed on `r2_path = importId` (the script generates the
  `importId` UUID). This preserves the FK `bills.import_log_id → import_logs.r2_path`,
  and keeps history + batch-delete working unchanged.

It **drops**: `requireAdmin()`/auth, in-memory rate limiting, `req.formData()` — none
are needed for a trusted local run.

**Module layout (avoid one 640-line file):** keep focused modules, e.g.
- `scripts/import-data.ts` — prompts + orchestration.
- `src/lib/admin/import/bills-ingest.ts` — parse → dedup → insert bills.
- `src/lib/admin/import/pdf-r2.ts` — 7z extract → R2 upload → link.
- `src/lib/admin/import/users-ingest.ts` — profiles + user_supplies upsert + mass-link RPC.

(The exact module boundaries are refined during planning; principle: small,
single-purpose, independently testable.)

**Progress:** printed to console with counts, and mirrored into `import_logs` so the
dashboard history reflects the run.

**Resume:** keep the existing "skip PDFs already present in R2 under this `importId`"
behavior so a re-run after interruption does not re-upload.

## Vercel-side changes

**Removed:**
- `src/app/api/upload/route.ts`.
- `src/app/api/upload-users/route.ts`.
- The upload *action* UI: `BulkUploader` and the `admin-upload-provider` parts that
  exist only to drive the upload POST / generate `importId`.
- `experimental.serverActions.bodySizeLimit` and the `/api/upload`
  `outputFileTracingExcludes` entry in `next.config.ts` (both existed only for the
  upload route). This supersedes the interim `2mb` change — the override is removed
  entirely, reverting to the safe 1 MB default.

**Repurposed — the "Centro Caricamento" page (`src/app/admin/upload/page.tsx`):**
The page stays and keeps its current look, but the **upload actions are removed** while
the **history/recap stays fully functional**.

- **Removed from the page:** the three top upload cards — *Flusso Dati CSV* (Scegli i
  file), *Archivio Fatture* (Scegli i file), and *Anagrafica Utenti* (Scegli CSV Clienti
  / Esegui). All file inputs, POST calls, and `admin-upload-provider` upload logic go.
- **Replaced with:** a short static info banner in that top area explaining that bulk
  imports now run locally via `npm run import` (mode → files → preview → confirm) and
  that results appear below in the history.
- **Kept and fully working:** the **Storico Caricamenti** section — total-records
  counter (e.g. "115.878 record totali"), the "importazioni" count, **search**
  ("Cerca archivio…"), **Esporta CSV**, and the per-row **delete** (batch delete via the
  `requireSuperadmin` route → cascades bills + R2 purge).
- The admin sidebar link to this page stays.

**Also removed (discovered during planning):** `GlobalProgressBar` and
`AdminUploadProvider`. The progress bar is driven entirely by the client-side upload
provider's state, not by polling `import_logs`; with web uploads gone it can never
display anything, so both it and the provider (which exist only to drive/report web
uploads) are removed, and their mount in `admin-layout-shell.tsx` is unwired. This
supersedes the earlier "keep GlobalProgressBar" note.

**Kept elsewhere:** batch delete route (`/api/upload/[id]` DELETE), the import history
read + Esporta CSV + per-row delete on the page.

**Dependencies:** `7zip-bin` / `node-7z` remain in `package.json` but are now a
local-script concern only; they no longer ship in a Vercel function bundle.

## Security impact

- Removes the `7za` shell-out, arbitrary filesystem writes, and large-body handling
  from the hosted attack surface.
- The service-role key on the operator's machine (`.env.local`) is the only credential
  the script needs; it is never invoked via a public endpoint.
- **Caveat (honest):** service-role usage is *not* eliminated from Vercel — batch-delete
  and some admin actions still use it. The win is removing the ingest endpoint class,
  not all service-role usage.

## Testing

- **Dry-run first:** the preview step is the primary safety net — it must report exactly
  what a commit would change, writing nothing.
- **Small-fixture run:** a tiny CSV + a 2–3 file 7z against the real (or a scratch)
  project to validate insert, R2 upload, linking, and `import_logs` status transitions.
- **Duplicate re-run:** re-running the same archive should skip already-linked PDFs and
  already-inserted `idboll` (verifies dedup + resume).
- **Manual verification** of `import_logs` history + batch-delete after a script run
  (proves the FK/history contract still holds).

## Open questions / risks

- **Filesystem/CWD assumptions:** the ported code uses `process.cwd()/tmp` and
  `public/invoices/acq`; confirm these resolve sanely when run as a script (they should,
  since scripts run from repo root).
- **`.env.local` completeness:** the operator's machine must have all R2 + service-role
  vars; the script should fail fast with a clear message if any are missing.
- **Windows 7za path:** existing route has fallbacks for locating `7za.exe`; the script
  must retain equivalent path resolution (operator is on Windows).
