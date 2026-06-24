'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RangeCalendarProps {
    from: string
    to: string
    onChange: (from: string, to: string) => void
}

const MONTH_NAMES = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
const WEEK_DAYS = ['lu', 'ma', 'me', 'gi', 've', 'sa', 'do']

/** Inline dual-month range picker used inside the "Periodo" filter popover. */
export function RangeCalendar({ from, to, onChange }: RangeCalendarProps) {
    const initial = from ? new Date(from) : new Date()
    const [viewYear, setViewYear] = useState(initial.getFullYear())
    const [viewMonth, setViewMonth] = useState(initial.getMonth())
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const fromDate = from ? new Date(from) : null
    const toDate = to ? new Date(to) : null

    const firstOfMonth = new Date(viewYear, viewMonth, 1)
    const startOffset = (firstOfMonth.getDay() + 6) % 7
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const daysInPrev = new Date(viewYear, viewMonth, 0).getDate()

    const cells: { date: Date; current: boolean }[] = []
    for (let i = startOffset - 1; i >= 0; i--) {
        cells.push({ date: new Date(viewYear, viewMonth - 1, daysInPrev - i), current: false })
    }
    for (let d = 1; d <= daysInMonth; d++) {
        cells.push({ date: new Date(viewYear, viewMonth, d), current: true })
    }
    while (cells.length % 7 !== 0 || cells.length < 42) {
        const last = cells[cells.length - 1].date
        cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), current: false })
        if (cells.length >= 42) break
    }

    const inRange = (d: Date) => fromDate && toDate && d >= fromDate && d <= toDate
    const isStart = (d: Date) => fromDate && d.toDateString() === fromDate.toDateString()
    const isEnd = (d: Date) => toDate && d.toDateString() === toDate.toDateString()

    const handleClick = (d: Date) => {
        const s = fmt(d)
        if (!from || (from && to)) { onChange(s, ''); return }
        if (new Date(s).getTime() < new Date(from).getTime()) { onChange(s, from); return }
        onChange(from, s)
    }

    const nav = (delta: number) => {
        const m = viewMonth + delta
        const y = viewYear + Math.floor(m / 12)
        setViewMonth(((m % 12) + 12) % 12)
        setViewYear(y)
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <button onClick={() => nav(-1)} className="w-6 h-6 rounded-md hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center text-slate-500">
                    <ChevronLeft size={12} />
                </button>
                <p className="text-[11px] font-bold text-[#0A2540] dark:text-white capitalize">{MONTH_NAMES[viewMonth]} {viewYear}</p>
                <button onClick={() => nav(1)} className="w-6 h-6 rounded-md hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center text-slate-500">
                    <ChevronRight size={12} />
                </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 mb-0.5">
                {WEEK_DAYS.map(w => (
                    <p key={w} className="text-[9px] font-bold uppercase text-slate-400 text-center">{w}</p>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
                {cells.map((c, i) => {
                    const r = inRange(c.date)
                    const s = isStart(c.date)
                    const e = isEnd(c.date)
                    const isToday = c.date.toDateString() === new Date().toDateString()
                    return (
                        <button
                            key={i}
                            onClick={() => handleClick(c.date)}
                            className={cn(
                                "h-7 rounded-md text-[11px] font-bold transition-colors",
                                !c.current && "text-slate-300 dark:text-slate-600",
                                c.current && !r && !s && !e && "text-[#0A2540] dark:text-white hover:bg-slate-100 dark:hover:bg-white/10",
                                r && !s && !e && "bg-[#1E5BFF]/10 text-[#1E5BFF]",
                                (s || e) && "bg-[#1E5BFF] text-white",
                                isToday && !s && !e && !r && "ring-1 ring-[#1E5BFF]/40"
                            )}
                        >
                            {c.date.getDate()}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
