'use client'

import { useRef, useState, useEffect, useMemo, type PointerEvent as ReactPointerEvent } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CodeBadge } from '@/components/ui/CodeBadge'
import { getContractStatus, STATUS_SOFT_CLASS, STATUS_GLASS_CLASS } from '@/lib/contract-status'

interface SuppliesCarouselProps {
    supplies: any[]
    selectedUlm: string | 'all'
    setSelectedUlm: (v: string | 'all') => void
    supplyIndex: number
    setSupplyIndex: (i: number) => void
}

/**
 * Horizontal, drag/snap supply carousel. Slide 0 is the "all supplies" intro
 * (hidden while searching); slides 1..n are individual forniture. Selecting a
 * slide drives `selectedUlm` upstream so the charts/table filter to it.
 */
export function SuppliesCarousel({ supplies, selectedUlm, setSelectedUlm, supplyIndex, setSupplyIndex }: SuppliesCarouselProps) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const scrollingRef = useRef(false)
    const scrollTimer = useRef<any>(null)
    const dragState = useRef<{ startX: number; startScroll: number; pointerId: number; moved: boolean } | null>(null)

    const [searchQuery, setSearchQuery] = useState('')
    const [scrollLeft, setScrollLeft] = useState(0)
    const [clientWidth, setClientWidth] = useState(0)

    useEffect(() => {
        if (scrollRef.current) {
            setClientWidth(scrollRef.current.clientWidth)
            const initialIdx = searchQuery
                ? 0
                : (selectedUlm === 'all' ? 0 : supplies.findIndex(s => s.ulm === selectedUlm) + 1)
            scrollRef.current.scrollLeft = initialIdx * scrollRef.current.clientWidth
            setScrollLeft(initialIdx * scrollRef.current.clientWidth)
        }
    }, [supplies, searchQuery, selectedUlm])

    const filteredSupplies = useMemo(() => {
        if (!searchQuery) return supplies
        const query = searchQuery.toLowerCase().trim()
        return supplies.filter(s =>
            (s.address || '').toLowerCase().includes(query) ||
            (s.city || '').toLowerCase().includes(query) ||
            (s.ulm || '').toLowerCase().includes(query) ||
            (s.codice_ulm || '').toLowerCase().includes(query)
        )
    }, [supplies, searchQuery])

    // Slide 0 = "all" intro (only when not searching), slides 1..n = each filtered fornitura
    const totalSlides = searchQuery ? filteredSupplies.length : supplies.length + 1
    const safeIndex = Math.min(supplyIndex, Math.max(0, totalSlides - 1))

    const applySelection = (i: number) => {
        if (!searchQuery) {
            if (i === 0) setSelectedUlm('all')
            else setSelectedUlm(supplies[i - 1]?.ulm || 'all')
        } else {
            setSelectedUlm(filteredSupplies[i]?.ulm || 'all')
        }
    }

    const scrollToIndex = (i: number) => {
        const el = scrollRef.current
        if (!el) return
        const w = el.clientWidth
        scrollingRef.current = true
        el.scrollTo({ left: i * w, behavior: 'smooth' })
        setSupplyIndex(i)
        applySelection(i)
        clearTimeout(scrollTimer.current)
        scrollTimer.current = setTimeout(() => { scrollingRef.current = false }, 400)
    }

    const handleScroll = () => {
        const el = scrollRef.current
        if (!el) return
        setScrollLeft(el.scrollLeft)
        setClientWidth(el.clientWidth)
        if (scrollingRef.current) return
        const w = el.clientWidth
        if (w <= 0) return
        const idx = Math.round(el.scrollLeft / w)
        if (idx !== safeIndex && idx >= 0 && idx < totalSlides) {
            setSupplyIndex(idx)
            applySelection(idx)
        }
    }

    const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
        const el = scrollRef.current
        if (!el) return
        // Don't hijack drag on interactive children (buttons, anchors, inputs)
        const target = e.target as HTMLElement
        if (target.closest('button, a, input')) return
        dragState.current = {
            startX: e.clientX,
            startScroll: el.scrollLeft,
            pointerId: e.pointerId,
            moved: false,
        }
        el.setPointerCapture(e.pointerId)
        el.style.scrollSnapType = 'none'
    }

    const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
        const el = scrollRef.current
        const d = dragState.current
        if (!el || !d || d.pointerId !== e.pointerId) return
        const dx = e.clientX - d.startX
        if (Math.abs(dx) > 4) d.moved = true
        el.scrollLeft = d.startScroll - dx
    }

    const finishDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
        const el = scrollRef.current
        const d = dragState.current
        if (!el || !d || d.pointerId !== e.pointerId) return
        const w = el.clientWidth
        const idx = Math.max(0, Math.min(totalSlides - 1, Math.round(el.scrollLeft / w)))
        scrollingRef.current = true
        el.scrollTo({ left: idx * w, behavior: 'smooth' })
        setSupplyIndex(idx)
        applySelection(idx)
        clearTimeout(scrollTimer.current)
        scrollTimer.current = setTimeout(() => {
            scrollingRef.current = false
            if (el) el.style.scrollSnapType = 'x mandatory'
        }, 400)
        try { el.releasePointerCapture(d.pointerId) } catch {}
        dragState.current = null
    }

    useEffect(() => {
        const el = scrollRef.current
        if (!el || supplies.length === 0) return
        const w = el.clientWidth
        el.scrollLeft = safeIndex * w
    }, [supplies.length])

    // Reset snap index and auto-select when searching
    useEffect(() => {
        setSupplyIndex(0)
        const el = scrollRef.current
        if (el) {
            el.scrollLeft = 0
        }
        if (searchQuery) {
            if (filteredSupplies.length > 0) {
                setSelectedUlm(filteredSupplies[0].ulm || 'all')
            } else {
                setSelectedUlm('all')
            }
        } else {
            setSelectedUlm('all')
        }
    }, [searchQuery])

    if (supplies.length === 0) {
        return (
            <div className="col-span-12 lg:col-span-4 relative overflow-hidden bg-white dark:from-[#1A1D23] dark:to-[#15171C] dark:bg-gradient-to-br rounded-[2rem] p-4 flex flex-col h-full min-h-[110px] shadow-[0_1px_2px_rgba(10,37,64,0.04)]">
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-[12px] text-slate-400">Nessuna fornitura</p>
                </div>
            </div>
        )
    }

    return (
        <div className="col-span-12 lg:col-span-4 relative overflow-hidden bg-white dark:from-[#1A1D23] dark:to-[#15171C] dark:bg-gradient-to-br rounded-[2rem] p-4 flex flex-col h-full min-h-[110px] shadow-[0_1px_2px_rgba(10,37,64,0.04)]">
            <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-[#1E5BFF]/5 blur-2xl pointer-events-none" />

            {/* Search Input for Quick Filtering */}
            {supplies.length > 3 && (
                <div className="mb-2 relative group shrink-0 z-10">
                    <input
                        type="text"
                        placeholder="Filtra forniture per indirizzo, ULM..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-9 w-full pl-9 pr-8 rounded-full bg-slate-100 dark:bg-white/10 text-[12px] text-slate-700 dark:text-slate-200 placeholder:text-slate-500 outline-none focus:ring-2 ring-[#1E5BFF]/20 transition-all"
                    />
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#93C5FD] transition-colors" />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            )}

            <div
                ref={scrollRef}
                onScroll={handleScroll}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={finishDrag}
                onPointerCancel={finishDrag}
                className="flex-1 flex overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 cursor-grab active:cursor-grabbing select-none touch-pan-x"
                style={{ scrollSnapType: 'x mandatory' }}
            >
                {filteredSupplies.length === 0 && searchQuery ? (
                    <div className="shrink-0 w-full snap-center px-4 flex items-center justify-center">
                        <div className="text-center p-4">
                            <p className="text-[12px] font-bold text-slate-400">Nessuna corrispondenza</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Prova con un altro indirizzo o ULM</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Intro slide (shown only when not searching) */}
                        {!searchQuery && (() => {
                            const cardIdx = 0
                            const distance = clientWidth > 0
                                ? Math.abs(scrollLeft - cardIdx * clientWidth) / clientWidth
                                : (safeIndex === cardIdx ? 0 : 1)
                            const progress = Math.max(0, Math.min(1, 1 - distance))

                            return (
                                <div className="shrink-0 w-full snap-center px-4">
                                    <div
                                        className="relative rounded-2xl p-4 flex flex-col h-full justify-center transition-all overflow-hidden text-white shadow-[0_4px_16px_rgba(30,91,255,0.08)] animate-gradient-shift"
                                        style={{
                                            background: 'linear-gradient(135deg, #064E3B 0%, #065F46 50%, #1E5BFF 100%)',
                                            transform: `scale(${0.98 + 0.02 * progress})`,
                                            opacity: 0.7 + 0.3 * progress,
                                            transition: 'transform 220ms ease-out, opacity 220ms ease-out',
                                            color: `color-mix(in srgb, currentColor, #ffffff ${progress * 100}%)`
                                        }}
                                    >
                                        {/* Inactive overlay — bg-slate-50/80 (light) or bg-[#1A1D23] (dark) */}
                                        <div
                                            className="absolute inset-0 bg-slate-50/80 dark:bg-[#1A1D23] border border-slate-100 dark:border-white/5 rounded-2xl pointer-events-none"
                                            style={{
                                                opacity: 1 - progress,
                                                transition: 'opacity 220ms ease-out'
                                            }}
                                        />

                                        <div className="absolute top-3 right-3 z-10">
                                            {/* Inactive badge */}
                                            <span
                                                className="text-[10px] px-2.5 py-1 rounded-full bg-[#1E5BFF]/10 text-[#1E5BFF] dark:text-[#93C5FD] dark:bg-white/10 transition-all"
                                                style={{ opacity: 1 - progress }}
                                            >
                                                {supplies.length} fornitur{supplies.length === 1 ? 'a' : 'e'}
                                            </span>
                                            {/* Active badge */}
                                            <span
                                                className="absolute inset-0 flex items-center justify-center text-[10px] px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white transition-all whitespace-nowrap"
                                                style={{ opacity: progress }}
                                            >
                                                {supplies.length} fornitur{supplies.length === 1 ? 'a' : 'e'}
                                            </span>
                                        </div>

                                        <p className="text-[14px] font-bold leading-snug z-10">
                                            Tutte le forniture
                                        </p>
                                        <p className={cn(
                                            "text-[12px] mt-1 z-10",
                                            safeIndex === 0 ? "text-white/80" : "text-slate-400 dark:text-slate-500"
                                        )}>
                                            Scorri per filtrare per fornitura.
                                        </p>

                                        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl" style={{ opacity: progress }}>
                                            <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-emerald-400/20 blur-3xl animate-wave-pulse" />
                                            <div className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl animate-wave-pulse" style={{ animationDelay: '2.5s' }} />
                                            <div className="absolute bottom-0 left-0 w-full h-24 overflow-hidden">
                                                <div className="absolute bottom-0 left-0 w-[200%] h-full flex animate-wave-slide reverse opacity-15" style={{ animationDuration: '25s' }}>
                                                    <svg className="w-1/2 h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
                                                        <path fill="#ffffff" d="M0,160 C240,160 480,60 720,160 C960,260 1200,160 1440,160 L1440,320 L0,320 Z" />
                                                    </svg>
                                                    <svg className="w-1/2 h-full -ml-[1px]" viewBox="0 0 1440 320" preserveAspectRatio="none">
                                                        <path fill="#ffffff" d="M0,160 C240,160 480,60 720,160 C960,260 1200,160 1440,160 L1440,320 L0,320 Z" />
                                                    </svg>
                                                </div>
                                                <div className="absolute bottom-0 left-0 w-[200%] h-full flex animate-wave-slide opacity-25" style={{ animationDuration: '18s' }}>
                                                    <svg className="w-1/2 h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
                                                        <path fill="#ffffff" d="M0,200 C360,200 480,100 720,200 C960,300 1080,200 1440,200 L1440,320 L0,320 Z" />
                                                    </svg>
                                                    <svg className="w-1/2 h-full -ml-[1px]" viewBox="0 0 1440 320" preserveAspectRatio="none">
                                                        <path fill="#ffffff" d="M0,200 C360,200 480,100 720,200 C960,300 1080,200 1440,200 L1440,320 L0,320 Z" />
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })()}

                        {(searchQuery ? filteredSupplies : supplies).map((s: any, idx: number) => {
                            const status = getContractStatus(s.stadio)
                            const cardIdx = searchQuery ? idx : idx + 1
                            const distance = clientWidth > 0
                                ? Math.abs(scrollLeft - cardIdx * clientWidth) / clientWidth
                                : (safeIndex === cardIdx ? 0 : 1)
                            const progress = Math.max(0, Math.min(1, 1 - distance))

                            const inactiveStatusCls = STATUS_SOFT_CLASS[status.color]
                            const activeStatusCls = STATUS_GLASS_CLASS[status.color]

                            return (
                                <div key={s.id} className="shrink-0 w-full snap-center px-4">
                                    <div
                                        className="rounded-2xl p-3 flex flex-col h-full overflow-hidden relative text-white shadow-[0_4px_16px_rgba(30,91,255,0.08)] animate-gradient-shift"
                                        style={{
                                            background: 'linear-gradient(135deg, #064E3B 0%, #065F46 50%, #1E5BFF 100%)',
                                            transform: `scale(${0.98 + 0.02 * progress})`,
                                            opacity: 0.7 + 0.3 * progress,
                                            transition: 'transform 220ms ease-out, opacity 220ms ease-out',
                                            color: `color-mix(in srgb, currentColor, #ffffff ${progress * 100}%)`
                                        }}
                                    >
                                        {/* Inactive overlay — bg-slate-50/80 (light) or bg-[#1A1D23] (dark) */}
                                        <div
                                            className="absolute inset-0 bg-slate-50/80 dark:bg-[#1A1D23] border border-slate-100 dark:border-white/5 rounded-2xl pointer-events-none"
                                            style={{
                                                opacity: 1 - progress,
                                                transition: 'opacity 220ms ease-out'
                                            }}
                                        />

                                        <div className="flex items-center justify-between gap-2 mb-1.5 z-10">
                                            <span
                                                className="text-[10px] font-bold uppercase tracking-[0.18em] truncate"
                                                style={{
                                                    color: `color-mix(in srgb, #64748B ${(1 - progress) * 100}%, rgba(255,255,255,0.8) ${progress * 100}%)`
                                                }}
                                            >
                                                Fornitura
                                            </span>

                                            <div className="relative shrink-0 h-6 flex items-center">
                                                {/* Inactive Status Badge */}
                                                <span
                                                    className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap cursor-default transition-opacity", inactiveStatusCls)}
                                                    style={{ opacity: 1 - progress }}
                                                    title={`Contratto ${status.label}`}
                                                >
                                                    Contratto {status.label}
                                                </span>
                                                {/* Active Status Badge */}
                                                <span
                                                    className={cn("absolute right-0 text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap cursor-default transition-opacity", activeStatusCls)}
                                                    style={{ opacity: progress }}
                                                    title={`Contratto ${status.label}`}
                                                >
                                                    Contratto {status.label}
                                                </span>
                                            </div>
                                        </div>
                                        <div
                                            className="mb-1.5 z-10 leading-snug"
                                            style={{
                                                color: `color-mix(in srgb, currentColor, #ffffff ${progress * 100}%)`
                                            }}
                                        >
                                            <p className="text-[14px] font-bold break-words whitespace-normal">
                                                {s.address || 'Utenza'}
                                            </p>
                                            {s.city && (
                                                <p className="text-[11px] font-medium opacity-70 truncate">
                                                    {s.city}
                                                </p>
                                            )}
                                        </div>
                                        <div className="relative mt-auto z-10 h-7">
                                            {/* Inactive ULM */}
                                            <div className="absolute inset-0" style={{ opacity: 1 - progress, pointerEvents: progress > 0.5 ? 'none' : 'auto' }}>
                                                <CodeBadge value={s.codice_ulm || (s.cif ? String(s.cif).slice(-6) : s.ulm)} label="ULM" copyable light={false} />
                                            </div>
                                            {/* Active ULM */}
                                            <div className="absolute inset-0" style={{ opacity: progress, pointerEvents: progress <= 0.5 ? 'none' : 'auto' }}>
                                                <CodeBadge value={s.codice_ulm || (s.cif ? String(s.cif).slice(-6) : s.ulm)} label="ULM" copyable light={true} />
                                            </div>
                                        </div>

                                        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl" style={{ opacity: progress }}>
                                            <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-emerald-400/20 blur-3xl animate-wave-pulse" />
                                            <div className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl animate-wave-pulse" style={{ animationDelay: '2.5s' }} />
                                            <div className="absolute bottom-0 left-0 w-full h-24 overflow-hidden">
                                                <div className="absolute bottom-0 left-0 w-[200%] h-full flex animate-wave-slide reverse opacity-15" style={{ animationDuration: '25s' }}>
                                                    <svg className="w-1/2 h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
                                                        <path fill="#ffffff" d="M0,160 C240,160 480,60 720,160 C960,260 1200,160 1440,160 L1440,320 L0,320 Z" />
                                                    </svg>
                                                    <svg className="w-1/2 h-full -ml-[1px]" viewBox="0 0 1440 320" preserveAspectRatio="none">
                                                        <path fill="#ffffff" d="M0,160 C240,160 480,60 720,160 C960,260 1200,160 1440,160 L1440,320 L0,320 Z" />
                                                    </svg>
                                                </div>
                                                <div className="absolute bottom-0 left-0 w-[200%] h-full flex animate-wave-slide opacity-25" style={{ animationDuration: '18s' }}>
                                                    <svg className="w-1/2 h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
                                                        <path fill="#ffffff" d="M0,200 C360,200 480,100 720,200 C960,300 1080,200 1440,200 L1440,320 L0,320 Z" />
                                                    </svg>
                                                    <svg className="w-1/2 h-full -ml-[1px]" viewBox="0 0 1440 320" preserveAspectRatio="none">
                                                        <path fill="#ffffff" d="M0,200 C360,200 480,100 720,200 C960,300 1080,200 1440,200 L1440,320 L0,320 Z" />
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </>
                )}
            </div>

            {/* Segmented progress bar */}
            {totalSlides > 1 && (
                <div className="flex items-center gap-1 mt-3 shrink-0">
                    {Array.from({ length: totalSlides }).map((_, i: number) => (
                        <button
                            key={i}
                            onClick={() => scrollToIndex(i)}
                            className={cn(
                                "flex-1 h-1.5 rounded-full transition-colors duration-200",
                                i === safeIndex
                                    ? "bg-[#93C5FD] dark:bg-[#93C5FD]"
                                    : "bg-slate-200 hover:bg-slate-300 dark:bg-white/15 dark:hover:bg-white/25"
                            )}
                            title={i === 0 && !searchQuery ? 'Tutte' : `Fornitura ${searchQuery ? i + 1 : i}`}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
