# Acqdash — Handoff Pack

Pacchetto di migrazione dal **prototipo HTML** al **progetto reale Next.js 15 + Supabase**.

## Stack target (già presente nel tuo repo)

- **Next.js 16** (App Router) + React 19
- **TypeScript**
- **Supabase** (`@supabase/ssr` + `@supabase/supabase-js`)
- **Tailwind v4** + **shadcn/ui** (`components.json` presente)
- **recharts** per i grafici
- **framer-motion** per transizioni
- **Cloudflare R2** (via `@aws-sdk/client-s3`) per PDF bollette

## Cosa contiene questo pacchetto

```
handoff/
├── README.md                       ← questo file
├── MIGRATION_CHECKLIST.md          ← checklist step-by-step
├── components/
│   ├── dashboard/
│   │   ├── DashboardShell.tsx      ← hero + header + sidebar responsive
│   │   ├── ConsumptionChart.tsx    ← grafico recharts con filtri 1M/3M/6M/1Y
│   │   ├── BillsList.tsx           ← lista bollette con drawer dettaglio
│   │   ├── BillDrawer.tsx          ← drawer laterale con PDF + pagamento
│   │   ├── SupplySwitcher.tsx      ← selector forniture (header)
│   │   ├── CommandPalette.tsx      ← ⌘K (usa cmdk)
│   │   ├── NotificationsMenu.tsx   ← popover notifiche
│   │   ├── AlertsWidget.tsx        ← anomalie / avvisi
│   │   └── StatsGrid.tsx           ← 4 stat cards (consumo/spesa/risparmio/pagate)
│   └── admin/
│       ├── AdminShell.tsx
│       ├── UsersTable.tsx
│       └── UploadZone.tsx          ← drop PDF/ZIP + progresso
├── hooks/
│   ├── use-supply.ts               ← selected supply + localStorage
│   ├── use-bills.ts                ← fetch + cache bollette
│   └── use-consumption.ts          ← aggregazione 12M
├── lib/
│   ├── format.ts                   ← fmtEur, fmtDate, fmtM3
│   └── supply.ts                   ← raggruppa bollette per ULM
├── types/
│   └── dashboard-extended.ts       ← Supply, Notification, Alert (estende types/dashboard.ts)
├── tokens/
│   ├── tokens.json                 ← design tokens (colori, spacing, type)
│   └── tokens.css                  ← CSS custom properties
├── api/
│   └── openapi.yaml                ← contratto API REST
├── supabase/
│   ├── migration_handoff.sql       ← nuove tabelle (notifications, alerts, supplies view)
│   └── rls_handoff.sql             ← policies RLS per le nuove tabelle
└── fetch-examples/
    ├── bills.ts                    ← esempi Supabase queries
    ├── supplies.ts
    └── payments.ts
```

## Principio guida: mobile = responsive, non app separata

Il prototipo HTML mostra mobile come "app iOS" per chiarezza visiva, ma **in produzione è la stessa dashboard Next.js** con breakpoint Tailwind:

| Breakpoint | Layout |
|---|---|
| `< 768px` (mobile) | Single column, header collapsato, sidebar in `<Sheet>`, bottom-tab bar |
| `768–1024px` (tablet) | 2 colonne, sidebar icon-only |
| `> 1024px` (desktop) | 3 colonne, sidebar estesa, ⌘K attivo |

Tutti i componenti in `handoff/components/` sono **responsive-first** con Tailwind.

## Come usare

### 1. Quick start

```bash
# Dal root del tuo repo acqdash
cp -r /path/to/handoff ./src/handoff   # oppure tienilo fuori dal build
```

### 2. Installa dipendenze mancanti

```bash
npm i cmdk @radix-ui/react-popover @radix-ui/react-sheet
```

(Il resto è già nel tuo `package.json`.)

### 3. Integra nell'ordine

Segui `MIGRATION_CHECKLIST.md`. In sintesi:

1. Copia `types/dashboard-extended.ts` → `src/types/`
2. Copia `lib/format.ts` e `lib/supply.ts` → `src/lib/`
3. Copia `tokens/tokens.css` → `src/app/globals.css` (merge)
4. Lancia `supabase/migration_handoff.sql` sul tuo DB
5. Copia componenti in `src/components/dashboard/` un-per-un, testando
6. Sostituisci `src/app/dashboard/page.tsx` con `handoff/pages/dashboard-page.tsx`

### 4. Endpoint API

Il file `api/openapi.yaml` descrive tutti gli endpoint che la dashboard consuma. Puoi:
- Generare types TypeScript: `npx openapi-typescript api/openapi.yaml -o src/types/api.ts`
- Generare client: `npx openapi-fetch`
- Importare in Postman/Insomnia per test

Per ogni endpoint c'è un **esempio di fetch** pronto in `fetch-examples/`.

## Mappatura prototipo → codice reale

| Prototipo HTML | Componente handoff | Destinazione repo |
|---|---|---|
| `dash-v3-main.jsx` > `UserDashboardV3` | `DashboardShell.tsx` | `src/components/dashboard/` |
| `dash-v3-core.jsx` > chart recharts | `ConsumptionChart.tsx` | `src/components/dashboard/widgets/` |
| `dash-v3-core.jsx` > `CommandPalette` | `CommandPalette.tsx` | `src/components/dashboard/` |
| `dash-v3-core.jsx` > drawer | `BillDrawer.tsx` | `src/components/dashboard/` |
| `mobile-app.jsx` | — (sostituito da responsive breakpoints) | — |
| `admin-marine.jsx` | `AdminShell.tsx` + `UsersTable.tsx` | `src/components/admin/` |

## Test checklist suggerita

- [ ] Unit: `lib/format.ts` (fmtEur, fmtDate su diverse locale)
- [ ] Unit: `lib/supply.ts` (grouping bollette per ULM)
- [ ] Integration: `ConsumptionChart` con dataset vuoto / 1 punto / 12 mesi
- [ ] Integration: `BillDrawer` con bolletta senza PDF url
- [ ] E2E (Playwright): login → dashboard → apri bolletta → paga PagoPA → ritorno
- [ ] A11y: axe-core su ogni pagina (contrasto, focus, aria)
- [ ] Responsive: Chrome DevTools 375px / 768px / 1440px

## Sicurezza — punti critici già presenti nel tuo repo

Il tuo `SECURITY_REVIEW_2026-04-20.md` e le migrazioni in `supabase/migrations/` coprono già:
- RLS su `bills`, `profiles`, `user_supplies`
- Lockdown `tenants` (rimosso)
- Policies fissate su ricorsione

Questo handoff **non tocca** quelle policy. Aggiunge solo 3 tabelle nuove (`notifications`, `alerts`, `payment_attempts`) con RLS isolata per utente.

## Contatti / domande

Se qualcosa non è chiaro, apri un issue sul repo e tagga `@design-handoff`.

---

**Generato**: 24 aprile 2026
**Versione**: 1.0.0
**Autore**: Design handoff per Acqdash
