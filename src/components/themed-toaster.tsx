'use client'

import { Toaster } from 'sonner'
import { useTheme } from 'next-themes'

/**
 * Sonner Toaster wired to the active next-themes theme so toast popups
 * (save/reset/delete confirmations, etc.) match light/dark mode instead of
 * always rendering light.
 */
export function ThemedToaster() {
    const { resolvedTheme } = useTheme()
    return (
        <Toaster
            richColors
            position="top-center"
            theme={(resolvedTheme === 'dark' ? 'dark' : 'light')}
        />
    )
}
