'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Supply } from '@/types/dashboard-extended'

const STORAGE_KEY = 'acqdash.selected_supply_id'

export function useSupply(supplies: Supply[]) {
    const [selectedId, setSelectedId] = useState<string | null>(null)

    useEffect(() => {
        if (typeof window === 'undefined') return
        const saved = window.localStorage.getItem(STORAGE_KEY)
        const exists = supplies.find(s => s.id === saved)
        if (exists) {
            setSelectedId(saved)
        } else if (supplies.length > 0) {
            const primary = supplies.find(s => s.is_primary) ?? supplies[0]
            setSelectedId(primary.id)
        }
    }, [supplies])

    const setSupply = useCallback((id: string) => {
        setSelectedId(id)
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(STORAGE_KEY, id)
        }
    }, [])

    const selected = supplies.find(s => s.id === selectedId) ?? supplies[0] ?? null

    return { selected, selectedId, setSupply, supplies }
}
