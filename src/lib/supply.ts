// Group bills by supply (ULM), produce Supply[] from bills or user_supplies table.

import type { Bill } from '@/types/dashboard'
import type { Supply } from '@/types/dashboard-extended'

type BillWithStatus = Bill & { status?: string }

/**
 * Groups bills by their ULM into a Supply[] shape.
 * Use when you don't have a user_supplies table yet, or to reconcile.
 */
export function suppliesFromBills(bills: Bill[]): Supply[] {
    const byUlm = new Map<string, Bill[]>()
    for (const b of bills) {
        const key = b.ulm?.trim() || b.cif?.slice(-5) || 'UNKNOWN'
        if (!byUlm.has(key)) byUlm.set(key, [])
        byUlm.get(key)!.push(b)
    }
    return Array.from(byUlm.entries()).map(([ulm, rows]) => {
        const first = rows[0]
        return {
            id: ulm,
            user_id: '',
            ulm,
            cif: first.cif,
            label: ulm,
            type: 'other' as const,
            is_primary: false,
            created_at: first.data_emissione,
        } satisfies Supply
    })
}

/** Filter bills belonging to a supply by ULM match. */
export function billsForSupply(bills: Bill[], supply: Supply): Bill[] {
    return bills.filter(b => (b.ulm?.trim() || '') === supply.ulm)
}

/** Compute simple stats for a list of bills. */
export function computeStats(bills: Bill[]) {
    const withStatus = bills as BillWithStatus[]
    const paid = withStatus.filter(b => b.status === 'paid')
    const pending = withStatus.filter(b => b.status !== 'paid')
    const lastBill = [...bills].sort(
        (a, b) => new Date(b.data_emissione).getTime() - new Date(a.data_emissione).getTime()
    )[0]

    return {
        lastConsumption: lastBill ? Number(lastBill.consumo ?? 0) : 0,
        lastCost: lastBill ? Number(lastBill.importo ?? 0) : 0,
        pendingBillsCount: pending.length,
        pendingAmount: pending.reduce((s, b) => s + Number(b.importo ?? 0), 0),
        paidBillsCount: paid.length,
        paidAmount: paid.reduce((s, b) => s + Number(b.importo ?? 0), 0),
    }
}
