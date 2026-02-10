'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'

interface DashboardContextType {
    supplies: string[]
    setSupplies: (supplies: string[]) => void
    selectedSupply: string
    setSelectedSupply: (supply: string) => void
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined)

export function DashboardProvider({ children }: { children: ReactNode }) {
    const [supplies, setSupplies] = useState<string[]>([])
    const [selectedSupply, setSelectedSupply] = useState<string>('all')

    return (
        <DashboardContext.Provider value={{ supplies, setSupplies, selectedSupply, setSelectedSupply }}>
            {children}
        </DashboardContext.Provider>
    )
}

export function useDashboard() {
    const context = useContext(DashboardContext)
    if (context === undefined) {
        throw new Error('useDashboard must be used within a DashboardProvider')
    }
    return context
}
