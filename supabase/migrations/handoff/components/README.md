# Componenti — Quick reference

## Alberatura

```
handoff/
├── components/
│   ├── dashboard/
│   │   ├── DashboardShell.tsx      ← entry point (compone tutto)
│   │   ├── StatsGrid.tsx           ← 4 KPI
│   │   ├── ConsumptionChart.tsx    ← recharts con filtri
│   │   ├── BillsList.tsx           ← lista + hover + badge
│   │   ├── BillDrawer.tsx          ← dettaglio + pay + PDF
│   │   ├── SupplySwitcher.tsx     ← dropdown forniture
│   │   ├── NotificationsMenu.tsx   ← popover con badge
│   │   ├── AlertsWidget.tsx        ← anomalie
│   │   └── CommandPalette.tsx      ← ⌘K
│   └── admin/
│       ├── UsersTable.tsx
│       └── UploadZone.tsx
├── hooks/
│   ├── use-supply.ts               ← supply + localStorage
│   └── use-consumption.ts          ← 12-month buckets
├── lib/
│   ├── format.ts                   ← fmtEur / fmtDate / fmtM3 / fmtPct
│   └── supply.ts                   ← suppliesFromBills / billsForSupply / computeStats
├── types/
│   └── dashboard-extended.ts       ← Supply / Notification / Alert / PaymentAttempt
├── tokens/
│   ├── tokens.json
│   └── tokens.css
├── supabase/
│   ├── migration_handoff.sql       ← 3 nuove tabelle
│   └── rls_handoff.sql             ← policies
├── api/
│   └── openapi.yaml
├── fetch-examples/
│   └── server-actions.ts
├── pages/
│   └── dashboard-page.tsx          ← esempio sostituzione page.tsx
├── README.md
└── MIGRATION_CHECKLIST.md
```

## Dipendenze extra da installare

```bash
npm i cmdk
npx shadcn@latest add sheet command popover dialog sonner
```

(recharts, framer-motion, lucide-react già nel tuo `package.json`.)

## Props contract principali

### `<DashboardShell />`
```ts
interface DashboardShellProps {
    profile: Profile
    bills: Bill[]
    supplies: Supply[]
    notifications: AppNotification[]
    alerts: ConsumptionAlert[]
    onPayBill?: (bill: Bill) => void
    onDownloadBill?: (bill: Bill) => void
    onMarkNotificationRead?: (id: string) => void
    onMarkAllNotificationsRead?: () => void
    onNavigate?: (href: string) => void
}
```

Tutti i callback sono opzionali — il componente funziona anche senza.

## Responsive breakpoints (Tailwind v4)

- `< 640px` → mobile: stats 2-col, sidebar hamburger, drawer full-width
- `640–1024px` → tablet: stats 2-col, sidebar icon-only
- `> 1024px` → desktop: 3-column grid, ⌘K visibile, drawer 512px

## Integrazione con il codice esistente

| Tuo file esistente | Relazione |
|---|---|
| `src/types/dashboard.ts` | Esteso da `handoff/types/dashboard-extended.ts` |
| `src/components/dashboard/PdfViewer.tsx` | Usabile dentro `BillDrawer` per preview inline |
| `src/components/dashboard/supply-selector.tsx` | Sostituibile da `SupplySwitcher.tsx` |
| `src/actions/payment-actions.ts` | Da chiamare in `onPayBill` |
| `src/actions/user-data.ts` | Invariato — fornisce `profile + bills` |
| `src/lib/r2.ts` | Da chiamare in `onDownloadBill` per presigned URL |
| `src/components/admin/BulkUploader.tsx` | Sostituibile (opzionale) da `UploadZone.tsx` |
