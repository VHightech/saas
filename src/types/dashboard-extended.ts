// Extends src/types/dashboard.ts with entities the new UI needs.
// Keep this file in src/types/ and re-export from dashboard.ts if you prefer a single import path.

import type { Bill } from './dashboard'

// ─────────────────────────────────────────────────────────────
// SUPPLY (fornitura / utenza)
// Deriva dal join di bills.ulm + user_supplies (tabella già presente dalle tue migration).
// ─────────────────────────────────────────────────────────────
export interface Supply {
    id: string                    // uuid user_supplies.id
    user_id: string
    ulm: string                   // es. "H501Z"
    cif: string                   // codice fiscale fornitura
    label: string                 // es. "Casa", "Ufficio" — nullable, fallback sul ULM
    address?: string
    city?: string
    type: 'home' | 'office' | 'other'
    is_primary?: boolean
    created_at: string
}

// ─────────────────────────────────────────────────────────────
// NOTIFICATION (nuova tabella — vedi handoff/supabase/migration_handoff.sql)
// ─────────────────────────────────────────────────────────────
export type NotificationKind =
    | 'bill_new'
    | 'bill_due'
    | 'payment_ok'
    | 'payment_failed'
    | 'consumption_spike'
    | 'system'

export interface AppNotification {
    id: string
    user_id: string
    kind: NotificationKind
    title: string
    body?: string
    href?: string                 // deep link, es. /dashboard/bills/123
    read_at?: string | null
    created_at: string
}

// ─────────────────────────────────────────────────────────────
// ALERT / ANOMALIA (consumo sopra soglia, perdita sospetta, etc.)
// ─────────────────────────────────────────────────────────────
export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface ConsumptionAlert {
    id: string
    user_id: string
    supply_id: string
    severity: AlertSeverity
    title: string
    description?: string
    detected_at: string
    resolved_at?: string | null
    metric_value?: number         // m³ o €
    metric_delta_pct?: number     // variazione vs. media storica
}

// ─────────────────────────────────────────────────────────────
// PAYMENT ATTEMPT (audit trail pagamenti PagoPA)
// ─────────────────────────────────────────────────────────────
export type PaymentStatus =
    | 'pending'
    | 'awaiting_user'
    | 'succeeded'
    | 'failed'
    | 'expired'
    | 'cancelled'

export interface PaymentAttempt {
    id: string
    bill_id: number
    user_id: string
    amount: number
    status: PaymentStatus
    pagopa_iuv?: string           // Identificativo Univoco Versamento
    pagopa_notice_code?: string   // codice avviso 18 cifre
    receipt_url?: string
    error_code?: string
    error_message?: string
    initiated_at: string
    completed_at?: string
}

// ─────────────────────────────────────────────────────────────
// CONSUMPTION BUCKET (output di useConsumption — serie aggregata per mese)
// ─────────────────────────────────────────────────────────────
export interface ConsumptionBucket {
    month: string                 // "2024-05" formato ISO YYYY-MM
    monthLabel: string            // "mag" per il grafico
    value: number                 // m³
    cost: number                  // €
    previousYearValue?: number    // confronto anno precedente
    zoneAverageValue?: number     // media zona (mock per ora)
}

// ─────────────────────────────────────────────────────────────
// DASHBOARD STATS (quelli che src/app/dashboard/page.tsx già calcola)
// Sono i props che DashboardShell si aspetta.
// ─────────────────────────────────────────────────────────────
export interface DashboardStats {
    lastConsumption: number
    lastCost: number
    pendingBillsCount: number
    pendingAmount: number
    paidBillsCount: number
    paidAmount: number
    savingsYoYPct?: number
    trendLabel: string
    fullName: string
    firstName: string
    clientCode: string
    fiscalCode: string
    address: string
    email: string
}

// Re-export for convenience
export type { Bill }
