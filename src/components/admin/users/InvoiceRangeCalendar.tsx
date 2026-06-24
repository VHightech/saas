'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
    format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
    eachDayOfInterval, isSameMonth, isSameDay, isToday, isAfter, isBefore,
} from 'date-fns'
import { it as itLocale } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface InvoiceRangeCalendarProps {
    from: Date | null
    to: Date | null
    onChange: (from: Date | null, to: Date | null) => void
}

/** Date-fns based range picker (with hover preview) for the admin invoice filter. */
export function InvoiceRangeCalendar({ from, to, onChange }: InvoiceRangeCalendarProps) {
    const [month, setMonth] = useState(from || to || new Date())
    const [hover, setHover] = useState<Date | null>(null)

    const monthStart = startOfMonth(month)
    const monthEnd = endOfMonth(month)
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

    const handleClick = (d: Date) => {
        // No range yet, or both set → start fresh
        if (!from || (from && to)) { onChange(d, null); return }
        // Have from, picking second
        if (isBefore(d, from)) onChange(d, from)
        else if (isSameDay(d, from)) onChange(d, d)
        else onChange(from, d)
    }

    const inRange = (d: Date) => {
        if (from && to) return !isBefore(d, from) && !isAfter(d, to)
        if (from && hover && !to) {
            const a = isBefore(hover, from) ? hover : from
            const b = isBefore(hover, from) ? from : hover
            return !isBefore(d, a) && !isAfter(d, b)
        }
        return false
    }

    return (
        <div className="select-none">
            <div className="flex items-center justify-between mb-2 px-1">
                <button
                    onClick={() => setMonth(subMonths(month, 1))}
                    className="h-6 w-6 rounded-md hover:bg-slate-100 dark:hover:bg-white/5 flex items-center justify-center text-slate-500"
                >
                    <ChevronLeft size={14} />
                </button>
                <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 capitalize">
                    {format(month, 'MMMM yyyy', { locale: itLocale })}
                </span>
                <button
                    onClick={() => setMonth(addMonths(month, 1))}
                    className="h-6 w-6 rounded-md hover:bg-slate-100 dark:hover:bg-white/5 flex items-center justify-center text-slate-500"
                >
                    <ChevronRight size={14} />
                </button>
            </div>
            <div className="grid grid-cols-7 gap-y-1 mb-1">
                {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((d, i) => (
                    <div key={i} className="text-[9px] font-bold uppercase tracking-wider text-slate-400 text-center">{d}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5">
                {days.map((d) => {
                    const out = !isSameMonth(d, month)
                    const isFrom = from && isSameDay(d, from)
                    const isTo = to && isSameDay(d, to)
                    const endpoint = isFrom || isTo
                    const range = inRange(d) && !endpoint
                    return (
                        <button
                            key={d.toISOString()}
                            onClick={() => handleClick(d)}
                            onMouseEnter={() => setHover(d)}
                            onMouseLeave={() => setHover(null)}
                            className={cn(
                                'h-7 text-[11px] font-medium flex items-center justify-center transition-colors',
                                out && 'text-slate-300 dark:text-slate-600',
                                !out && !endpoint && !range && 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 rounded-md',
                                isToday(d) && !endpoint && 'ring-1 ring-inset ring-slate-300 dark:ring-white/20 rounded-md',
                                range && 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200',
                                isFrom && 'bg-[#1A1F2A] text-white rounded-l-md',
                                isTo && 'bg-[#1A1F2A] text-white rounded-r-md',
                                isFrom && (!to || isSameDay(from!, to)) && 'rounded-md',
                            )}
                        >
                            {format(d, 'd')}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
