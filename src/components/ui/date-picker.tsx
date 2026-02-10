'use client'

import { useState, useEffect, useRef } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addMonths, subMonths, isSameMonth, isSameDay, isToday } from 'date-fns'
import { it } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DatePickerProps {
    value: string | Date | null
    onChange: (date: Date | null) => void
    placeholder?: string
    className?: string
}

export function DatePicker({ value, onChange, placeholder = "Seleziona data", className }: DatePickerProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const containerRef = useRef<HTMLDivElement>(null)

    // Parse value to Date if needed
    const selectedDate = value ? (typeof value === 'string' ? new Date(value) : value) : null

    // Helper to format display value
    const displayValue = selectedDate ? format(selectedDate, 'dd/MM/yyyy', { locale: it }) : ''

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        if (selectedDate) {
            setCurrentMonth(selectedDate)
        }
    }, [isOpen]) // Reset to focused date when opening

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))

    const handleSelect = (day: Date) => {
        onChange(day)
        setIsOpen(false)
    }

    const days = eachDayOfInterval({
        start: startOfWeek(startOfMonth(currentMonth), { locale: it }),
        end: endOfWeek(endOfMonth(currentMonth), { locale: it })
    })

    const weekDays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

    return (
        <div className={cn("relative", className)} ref={containerRef}>
            {/* Input Trigger */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="btn-glass btn-glass-neutral !rounded-full !justify-start px-3 py-1.5 min-w-[120px]"
            >
                <CalendarIcon size={14} className="opacity-70" />
                <span className={cn("text-xs font-bold", !selectedDate ? "opacity-70" : "")}>
                    {displayValue || placeholder}
                </span>
            </div>

            {/* Calendar Popover */}
            {isOpen && (
                <div className="absolute top-full mt-2 left-0 z-50 bg-white/90 dark:bg-[#1e1e1e]/90 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl p-4 min-w-[280px] animate-in fade-in zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <button onClick={prevMonth} className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full text-slate-600 dark:text-slate-300">
                            <ChevronLeft size={16} />
                        </button>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100 capitalize">
                            {format(currentMonth, 'MMMM yyyy', { locale: it })}
                        </span>
                        <button onClick={nextMonth} className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full text-slate-600 dark:text-slate-300">
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    {/* Week Days */}
                    <div className="grid grid-cols-7 mb-2">
                        {weekDays.map(d => (
                            <div key={d} className="text-center text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Days Grid */}
                    <div className="grid grid-cols-7 gap-1">
                        {days.map((day, i) => {
                            const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
                            const isCurrentMonth = isSameMonth(day, currentMonth)
                            const isTodayDate = isToday(day)

                            return (
                                <button
                                    key={i}
                                    onClick={() => handleSelect(day)}
                                    className={cn(
                                        "h-8 w-8 rounded-full text-xs flex items-center justify-center transition-all",
                                        !isCurrentMonth && "text-slate-300 dark:text-slate-700",
                                        isCurrentMonth && "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10",
                                        isSelected && "bg-sky-500 text-white shadow-md shadow-sky-500/20 hover:bg-sky-600 dark:hover:bg-sky-600",
                                        !isSelected && isTodayDate && "ring-1 ring-sky-500 text-sky-600 dark:text-sky-400 font-bold"
                                    )}
                                >
                                    {format(day, 'd')}
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
