"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function ModeToggle() {
    const { setTheme, theme, resolvedTheme } = useTheme()
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])

    // Render a fixed-size placeholder until client-side hydration completes
    // to avoid the "flash" and ensure the correct icon is shown
    if (!mounted) {
        return (
            <div className="w-9 h-9 rounded-full" aria-hidden="true" />
        )
    }

    const isDark = resolvedTheme === "dark"

    return (
        <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="relative p-2 w-9 h-9 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 transition-all flex items-center justify-center touch-manipulation"
            title={isDark ? "Passa alla modalità chiara" : "Passa alla modalità scura"}
            aria-label="Cambia Tema"
        >
            {isDark ? (
                <Sun className="h-[1.1rem] w-[1.1rem] text-yellow-400" />
            ) : (
                <Moon className="h-[1.1rem] w-[1.1rem] text-slate-700" />
            )}
            <span className="sr-only">Toggle theme</span>
        </button>
    )
}
