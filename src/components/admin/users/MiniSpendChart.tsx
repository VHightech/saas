'use client'

import { useMemo, useState, useEffect, useRef, useLayoutEffect } from 'react'
import { cn } from '@/lib/utils'

/** Minimal structural shape the chart needs — accepts both the dashboard and admin Bill types. */
interface MiniSpendBill {
    id?: number | string | null
    data_emissione?: string | null
    importo?: number | string | null
    consumo?: number | string | null
}

/** Dual-line (spesa + consumo) sparkline with scrub interaction, used on the admin user detail. */
export function MiniSpendChart({ bills }: { bills: MiniSpendBill[] }) {
    const data = useMemo(() => {
        const sorted = [...bills]
            .filter(b => b.data_emissione)
            .sort((a, b) => new Date(a.data_emissione!).getTime() - new Date(b.data_emissione!).getTime())
            .slice(-6)

        const monthLabel = (d: Date) => d.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '')

        const maxImporto = Math.max(...sorted.map(b => Number(b.importo) || 0), 1)
        const maxConsumo = Math.max(...sorted.map(b => Number(b.consumo) || 0), 1)

        const margin = 12
        const w = 300 - margin * 2

        const points = sorted.map((b, i) => {
            const valI = Number(b.importo) || 0
            const valC = Number(b.consumo) || 0

            // Normalized Y (0-100)
            const yI = valI > 0 ? 100 - ((valI / maxImporto) * 65 + 15) : 85
            const yC = valC > 0 ? 100 - ((valC / maxConsumo) * 65 + 15) : 85

            const x = sorted.length > 1 ? margin + i * (w / (sorted.length - 1)) : margin + w / 2

            return { x, yI, yC, valI, valC, label: monthLabel(new Date(b.data_emissione!)), key: b.id }
        })

        return { points, sorted }
    }, [bills])

    const [active, setActive] = useState<number | null>(null)
    useEffect(() => {
        setActive(data.points.length > 0 ? data.points.length - 1 : null)
    }, [data.points.length])

    const containerRef = useRef<HTMLDivElement>(null)
    const [size, setSize] = useState({ width: 0, height: 0 })
    useLayoutEffect(() => {
        const el = containerRef.current
        if (!el) return
        const update = () => setSize({ width: el.clientWidth, height: el.clientHeight })
        update()
        const ro = new ResizeObserver(update)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    const pathI = data.points.length >= 2
        ? data.points.reduce((acc, p, i, arr) => {
            if (i === 0) return `M ${p.x},${p.yI}`
            const prev = arr[i - 1]
            const dx = p.x - prev.x
            return `${acc} C ${prev.x + dx / 2},${prev.yI} ${p.x - dx / 2},${p.yI} ${p.x},${p.yI}`
        }, '')
        : ''

    const pathC = data.points.length >= 2
        ? data.points.reduce((acc, p, i, arr) => {
            if (i === 0) return `M ${p.x},${p.yC}`
            const prev = arr[i - 1]
            const dx = p.x - prev.x
            return `${acc} C ${prev.x + dx / 2},${prev.yC} ${p.x - dx / 2},${p.yC} ${p.x},${p.yC}`
        }, '')
        : ''

    const areaI = data.points.length >= 2 ? `${pathI} L ${data.points[data.points.length - 1].x},100 L ${data.points[0].x},100 Z` : ''
    const areaC = data.points.length >= 2 ? `${pathC} L ${data.points[data.points.length - 1].x},100 L ${data.points[0].x},100 Z` : ''

    const isEmpty = data.points.length === 0
    const activePoint = active !== null ? data.points[active] : null

    const curI = activePoint ? activePoint.valI : (data.points[data.points.length - 1]?.valI ?? 0)
    const curC = activePoint ? activePoint.valC : (data.points[data.points.length - 1]?.valC ?? 0)

    const handleScrub = (clientX: number, rect: DOMRect) => {
        if (data.points.length === 0) return
        const x = Math.max(0, Math.min(rect.width, clientX - rect.left))
        let closest = 0, closestDist = Infinity
        data.points.forEach((p, i) => {
            const px = (p.x / 300) * rect.width
            const dist = Math.abs(px - x)
            if (dist < closestDist) { closestDist = dist; closest = i }
        })
        if (closest !== active) setActive(closest)
    }

    return (
        <div>
            <div className="mb-4">
                <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-slate-400 mb-3">Andamento spesa & consumo</p>
                <div className="flex items-baseline justify-between gap-2 min-h-[22px]">
                    {isEmpty ? (
                        <span className="text-[12px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-white/5 px-3 py-1 rounded-lg border border-slate-100 dark:border-white/5">
                            nessun dato disponibile
                        </span>
                    ) : (
                        <>
                            <h3 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-white leading-none tabular-nums">
                                € {curI.toFixed(2).replace('.', ',')}
                            </h3>
                            <span className="text-[13px] font-bold text-indigo-500 dark:text-indigo-400 tabular-nums">
                                {curC} mc
                            </span>
                        </>
                    )}
                </div>
            </div>

            <div ref={containerRef} className="relative h-32 mb-6 touch-none select-none">
                <svg viewBox="0 0 300 100" className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="gradI" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#84cc16" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#84cc16" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="gradC" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.15" />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    {isEmpty ? (
                        <>
                            {/* Fake Double Lines for Empty State */}
                            <path
                                d="M 12,85 C 50,75 100,90 150,70 C 200,50 250,80 288,60"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="text-slate-100 dark:text-white/5"
                            />
                            <path
                                d="M 12,75 C 50,85 100,60 150,80 C 200,100 250,60 288,75"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeDasharray="4 4"
                                className="text-slate-100 dark:text-white/5 opacity-60"
                            />
                        </>
                    ) : (
                        <>
                            {/* Area shadows */}
                            <path d={areaI} fill="url(#gradI)" className="transition-all duration-700 ease-out" />
                            <path d={areaC} fill="url(#gradC)" className="transition-all duration-700 ease-out" />

                            {/* Lines */}
                            <path d={pathI} fill="none" stroke="#84cc16" strokeWidth="2.5" strokeLinecap="round" className="transition-all duration-700 ease-out" />
                            <path d={pathC} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4" className="opacity-60 transition-all duration-700 ease-out" />

                            {/* Interaction points */}
                            {data.points.map((p, i) => (
                                <g key={p.key} className={cn("transition-opacity duration-300", active !== null && active !== i ? 'opacity-20' : 'opacity-100')}>
                                    <circle cx={p.x} cy={p.yI} r="3.5" fill="#84cc16" stroke="#fff" strokeWidth="2" />
                                    <circle cx={p.x} cy={p.yC} r="2" fill="#6366f1" />
                                </g>
                            ))}
                        </>
                    )}
                </svg>

                {!isEmpty && (
                    <div
                        className="absolute inset-0 z-40 cursor-crosshair"
                        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); handleScrub(e.clientX, e.currentTarget.getBoundingClientRect()) }}
                        onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) handleScrub(e.clientX, e.currentTarget.getBoundingClientRect()) }}
                    />
                )}

                {activePoint && size.width > 0 && (
                    <>
                        <div
                            className="absolute top-0 bottom-0 w-px pointer-events-none z-10 transition-transform duration-300 ease-out"
                            style={{
                                transform: `translateX(${(activePoint.x / 300) * size.width}px)`,
                                backgroundImage: 'repeating-linear-gradient(to bottom, rgba(132,204,22,0.4) 0 4px, transparent 4px 8px)',
                            }}
                        />

                        {/* Dots */}
                        <div
                            className="absolute top-0 left-0 pointer-events-none z-20 transition-transform duration-300 ease-out"
                            style={{ transform: `translate3d(${(activePoint.x / 300) * size.width}px, ${(activePoint.yI / 100) * size.height}px, 0)` }}
                        >
                            <div className="absolute -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-[2.5px] border-[#84cc16] shadow-[0_2px_8px_rgba(132,204,22,0.55)]" />
                        </div>

                        <div
                            className="absolute top-0 left-0 pointer-events-none z-20 transition-transform duration-300 ease-out"
                            style={{ transform: `translate3d(${(activePoint.x / 300) * size.width}px, ${(activePoint.yC / 100) * size.height}px, 0)` }}
                        >
                            <div className="absolute -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border-[2px] border-indigo-500 shadow-sm" />
                        </div>

                        {/* Labels at bottom */}
                        <div className="absolute -bottom-5 left-0 right-0 h-4">
                            {data.points.map((p, i) => (
                                <span
                                    key={p.key}
                                    className={cn(
                                        "absolute text-[8px] font-bold uppercase tracking-tighter w-12 text-center transition-colors",
                                        active === i ? "text-slate-900 dark:text-white" : "text-slate-400"
                                    )}
                                    style={{ left: `${(p.x / 300) * 100}%`, transform: 'translateX(-50%)' }}
                                >
                                    {p.label}
                                </span>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
