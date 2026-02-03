"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

type Tenant = {
    id: string
    slug: string
    name: string
    logo_url: string | null
    primary_color: string | null
    features: {
        crm?: boolean
        invoicing?: boolean
    }
}

type TenantContextType = {
    tenant: Tenant | null
    isLoading: boolean
    hasFeature: (feature: keyof Tenant['features']) => boolean
}

const TenantContext = createContext<TenantContextType>({
    tenant: null,
    isLoading: true,
    hasFeature: () => false
})

export function TenantProvider({
    children,
    initialTenantSlug = "acq", // Passed from layout (server component)
}: {
    children: React.ReactNode
    initialTenantSlug?: string
}) {
    const [tenant, setTenant] = useState<Tenant | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        async function loadTenant() {
            try {
                // In a real scenario, we might have passed the full tenant object from the server
                // But fetching it here ensures we have the latest config
                const { data, error } = await supabase
                    .from("tenants")
                    .select("*")
                    .eq("slug", initialTenantSlug)
                    .single()

                if (error) {
                    console.error("Error loading tenant:", error)
                } else {
                    setTenant(data)
                    // Apply custom branding if available
                    if (data.primary_color) {
                        document.documentElement.style.setProperty("--primary", data.primary_color)
                    }
                }
            } catch (e) {
                console.error("Failed to load tenant", e)
            } finally {
                setIsLoading(false)
            }
        }

        loadTenant()
    }, [initialTenantSlug])

    const hasFeature = (feature: keyof Tenant['features']) => {
        return !!tenant?.features?.[feature]
    }

    return (
        <TenantContext.Provider value={{ tenant, isLoading, hasFeature }}>
            {children}
        </TenantContext.Provider>
    )
}

export const useTenant = () => useContext(TenantContext)
