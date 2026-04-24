# Migration Checklist — Acqdash Handoff → Repo reale

Segui questi step in ordine. Ogni step è atomico: se qualcosa va storto, puoi tornare indietro senza rompere il resto.

## Phase 0 — Setup (15 min)

- [ ] Crea branch `handoff/design-v3` dal tuo `main`
- [ ] Copia `handoff/` nella root del repo (fuori da `src/` per ora)
- [ ] Leggi `handoff/README.md` fino in fondo
- [ ] Installa dipendenze mancanti:
  ```bash
  npm i cmdk @radix-ui/react-popover
  npx shadcn@latest add sheet popover command dialog sonner
  ```

## Phase 1 — Design tokens (10 min)

- [ ] Apri `handoff/tokens/tokens.css` e copia le CSS custom properties
- [ ] Merge in `src/app/globals.css` (dentro `@layer base { :root { ... } }`)
- [ ] Aggiungi le stesse var anche nel blocco `.dark { ... }` con valori dark
- [ ] Testa: crea un componente che usa `var(--acq-blue)` e verifica che si veda
- [ ] Opzionale: importa `handoff/tokens/tokens.json` in Figma se hai un plugin token-sync

## Phase 2 — Types & lib (10 min)

- [ ] Copia `handoff/types/dashboard-extended.ts` → `src/types/dashboard-extended.ts`
- [ ] Aggiorna `src/types/dashboard.ts` aggiungendo `export * from './dashboard-extended'`
- [ ] Copia `handoff/lib/format.ts` → `src/lib/format.ts`
- [ ] Copia `handoff/lib/supply.ts` → `src/lib/supply.ts`
- [ ] Verifica che TS compili: `npx tsc --noEmit`

## Phase 3 — Database (20 min)

- [ ] Apri Supabase Studio → SQL Editor
- [ ] Incolla `handoff/supabase/migration_handoff.sql` e **non lanciarlo subito**: leggilo
- [ ] Verifica che non tocchi tabelle esistenti (solo `CREATE TABLE IF NOT EXISTS`)
- [ ] Lancia la migrazione
- [ ] Lancia `handoff/supabase/rls_handoff.sql` per le policy
- [ ] Verifica RLS: connettiti come utente non-admin e fai un `SELECT * FROM notifications` — deve tornare solo le sue
- [ ] Salva la migrazione nel tuo folder `supabase/migrations/` con timestamp

## Phase 4 — Hooks (15 min)

- [ ] Copia `handoff/hooks/use-supply.ts` → `src/hooks/use-supply.ts`
- [ ] Copia `handoff/hooks/use-bills.ts` → `src/hooks/use-bills.ts`
- [ ] Copia `handoff/hooks/use-consumption.ts` → `src/hooks/use-consumption.ts`
- [ ] Testa `useSupply`: in un componente, verifica che lo switch persista su reload

## Phase 5 — Componenti dashboard (1–2 ore)

**Ordine consigliato** (ogni step è indipendente):

### 5.1 Stats & chart (dati puri)
- [ ] `StatsGrid.tsx` → `src/components/dashboard/widgets/`
- [ ] `ConsumptionChart.tsx` → `src/components/dashboard/widgets/`
- [ ] Testa entrambi in una pagina dummy prima di integrarli

### 5.2 Bills
- [ ] `BillsList.tsx` → `src/components/dashboard/`
- [ ] `BillDrawer.tsx` → `src/components/dashboard/`
- [ ] Verifica integrazione con `PdfViewer.tsx` esistente
- [ ] Verifica che il download PDF da R2 funzioni via presigned URL

### 5.3 Header
- [ ] `SupplySwitcher.tsx` → `src/components/dashboard/`
- [ ] `NotificationsMenu.tsx` → `src/components/dashboard/`
- [ ] `CommandPalette.tsx` → `src/components/dashboard/`
- [ ] Shortcut `⌘K` / `Ctrl+K` funziona

### 5.4 Alerts
- [ ] `AlertsWidget.tsx` → `src/components/dashboard/widgets/`
- [ ] Mock dati per testare; collega a tabella `alerts` reale

### 5.5 Shell
- [ ] `DashboardShell.tsx` → `src/components/dashboard/`
- [ ] Questo è il componente più grande — integra tutti i precedenti
- [ ] Verifica responsive: 375px / 768px / 1440px

## Phase 6 — Admin (30 min)

- [ ] Copia `handoff/components/admin/*.tsx` → `src/components/admin/`
- [ ] Integra in `src/app/admin/users/page.tsx`
- [ ] Testa upload bollette con `UploadZone`

## Phase 7 — Pagamenti PagoPA (30 min)

- [ ] Apri `PAGOPA_INTEGRATION_GUIDE.md` (già nel tuo repo)
- [ ] Verifica che `payment-actions.ts` restituisca l'URL PagoPA corretto
- [ ] In `BillDrawer.tsx`, il bottone "Paga con PagoPA" usa `startPagoPaPayment(billId)` da `actions/payment-actions.ts`
- [ ] Callback: aggiungi route `app/api/pagopa/callback/route.ts` se non esiste
- [ ] Aggiorna tabella `payment_attempts` al ritorno

## Phase 8 — Pagina dashboard (15 min)

- [ ] Apri `src/app/dashboard/page.tsx`
- [ ] **Rimuovi** l'injection dei mock (linee ~22–178)
- [ ] Sostituisci il return con `<DashboardShell ... />`
- [ ] Verifica che i dati reali da Supabase arrivino al componente

## Phase 9 — Mobile responsive (20 min)

- [ ] Apri ogni componente copiato e verifica classi Tailwind responsive
- [ ] Su mobile `< 768px`, la `Sidebar` va in `<Sheet>` (drawer)
- [ ] La bottom-tab bar si mostra solo `sm:hidden`
- [ ] I charts recharts usano `<ResponsiveContainer width="100%" />`

## Phase 10 — API contract (10 min)

- [ ] Genera types: `npx openapi-typescript handoff/api/openapi.yaml -o src/types/api.ts`
- [ ] Importa in Postman per testare endpoint

## Phase 11 — Test (1 ora)

- [ ] `npx tsc --noEmit` — 0 errori
- [ ] `npm run build` — build passa
- [ ] Playwright E2E: login → dashboard → apri bolletta → ⌘K → cerca → esci
- [ ] Lighthouse: Performance > 85, A11y > 95
- [ ] Test su Chrome/Safari/Firefox

## Phase 12 — Deploy (10 min)

- [ ] Merge branch su `main`
- [ ] Deploy su staging (Vercel/Cloudflare)
- [ ] Smoke test con 3 utenti reali
- [ ] Deploy prod

---

## Rollback

Se qualcosa va storto in **Phase 3** (database), ogni migrazione in `handoff/supabase/` ha la sezione `-- ROLLBACK` commentata in fondo.

Per le fasi 5–8, basta revertare il branch.

---

**Tempo totale stimato**: 4–6 ore per uno sviluppatore single-full-stack.
