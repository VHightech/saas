// Aggregate bills into 12-month consumption buckets for charts.
// Drop into src/hooks/use-consumption.ts

'use client'

import { useMemo } from 'react'
import type { Bill } from '@/types/dashboard'
import type { ConsumptionBucket } from '@/types/dashboard-extended'
import { MONTHS_IT_SHORT } from '@/lib/format'

export function useConsumption(bills: Bill[], monthsBack = 12) {
    return useMemo<ConsumptionBucket[]>(() => {
        const now = new Date()
        const buckets: ConsumptionBucket[] = []
        for (let i = monthsBack - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            const match = bills.filter(b => {
                const bd = new Date(b.data_emissione)
                return bd.getFullYear() === d.getFullYear() && bd.getMonth() === d.getMonth()
            })
            const value = match.reduce((s, b) => s + Number(b.consumo ?? 0), 0)
            const cost = match.reduce((s, b) => s + Number(b.importo ?? 0), 0)

            // Previous year same month
            const prev = bills.filter(b => {
                const bd = new Date(b.data_emissione)
                return bd.getFullYear() === d.getFullYear() - 1 && bd.getMonth() === d.getMonth()
            })
            const previousYearValue = prev.reduce((s, b) => s + Number(b.consumo ?? 0), 0)

            buckets.push({
                month: key,
                monthLabel: MONTHS_IT_SHORT[d.getMonth()],
                value,
                cost,
                previousYearValue: previousYearValue || undefined,
            })
        }
        return buckets
    }, [bills, monthsBack])
}
