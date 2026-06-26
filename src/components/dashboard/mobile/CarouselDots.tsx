'use client'

import { cn } from '@/lib/utils'

interface CarouselDotsProps {
    count: number
    active: number
    /** Max dots shown at once before the window starts sliding. */
    maxVisible?: number
    /** Tailwind bg for the active pill + full-size dots. */
    activeClass?: string
    inactiveClass?: string
}

/**
 * iOS-style page indicator. When `count` fits within `maxVisible` it shows
 * exactly that many dots (4 bills → 4 dots). When there are more, it renders a
 * sliding window whose edge dots shrink/fade so it reads as an infinite carousel
 * of dots instead of capping or overflowing.
 */
export function CarouselDots({
    count,
    active,
    maxVisible = 7,
    activeClass = 'bg-blue-600 dark:bg-blue-400',
    inactiveClass = 'bg-blue-300 dark:bg-blue-800',
}: CarouselDotsProps) {
    if (count <= 1) return null

    const clampedActive = Math.max(0, Math.min(count - 1, active))

    // Few enough to show them all — no window, no fade.
    if (count <= maxVisible) {
        return (
            <div className="flex justify-center gap-2 items-center">
                {Array.from({ length: count }, (_, i) => (
                    <span
                        key={i}
                        className={cn(
                            'h-2 rounded-full transition-all duration-300 shrink-0',
                            i === clampedActive ? `w-6 ${activeClass}` : `w-2 ${inactiveClass}`,
                        )}
                    />
                ))}
            </div>
        )
    }

    // Sliding window centred on the active index, clamped to the ends.
    const half = Math.floor(maxVisible / 2)
    let start = clampedActive - half
    let end = clampedActive + half
    if (start < 0) { end -= start; start = 0 }
    if (end > count - 1) { start -= end - (count - 1); end = count - 1 }
    start = Math.max(0, start)

    const visible: number[] = []
    for (let i = start; i <= end; i++) visible.push(i)

    return (
        <div className="flex justify-center gap-2 items-center">
            {visible.map((i) => {
                const isActive = i === clampedActive
                const moreBefore = start > 0
                const moreAfter = end < count - 1
                const atEdge = (i === start && moreBefore) || (i === end && moreAfter)
                const nearEdge = (i === start + 1 && moreBefore) || (i === end - 1 && moreAfter)

                const sizeClass = isActive
                    ? `w-6 h-2 ${activeClass}`
                    : atEdge
                        ? `w-1 h-1 ${inactiveClass} opacity-60`
                        : nearEdge
                            ? `w-1.5 h-1.5 ${inactiveClass} opacity-80`
                            : `w-2 h-2 ${inactiveClass}`

                return (
                    <span
                        key={i}
                        className={cn('rounded-full transition-all duration-300 shrink-0', sizeClass)}
                    />
                )
            })}
        </div>
    )
}
