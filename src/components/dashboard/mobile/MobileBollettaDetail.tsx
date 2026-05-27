'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Download, CreditCard, Euro, MapPin, FileText, Clock, Loader2, User, Droplets } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Bill } from '@/types/dashboard'
import type { UserSupply } from './MobileShell'

interface MobileBollettaDetailProps {
    bill: Bill
    supply?: UserSupply
    onBack: () => void
    onPay?: (bill: Bill) => void
    onNext?: () => void
    onPrev?: () => void
    allBills?: Bill[]
    onSelectBill?: (bill: Bill) => void
    isPaying?: boolean
}

export function MobileBollettaDetail({ 
    bill, 
    supply, 
    onBack, 
    onPay,
    onNext,
    onPrev,
    allBills = [],
    onSelectBill,
    isPaying
}: MobileBollettaDetailProps) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const [isScrolling, setIsScrolling] = useState(false)
    // Live scroll position for smooth per-card animation
    const [scrollLeft, setScrollLeft] = useState(0)
    const [stride, setStride] = useState(0)
    useEffect(() => {
        if (scrollRef.current) setStride(getStride(scrollRef.current))
    }, [allBills.length])

    const currentIndex = useMemo(() => {
        return allBills.findIndex(b => b.id === bill.id)
    }, [allBills, bill.id])

    const isMultiBill = allBills.length > 1

    const billNumber = (b: Bill) => b.idboll || b.nome_pdf?.replace('.pdf', '') || b.id
    const formatPrice = (p: any) => Number(p || 0).toFixed(2).replace('.', ',')

    const formatDate = (dateStr?: string | null) => {
        if (!dateStr) return '-'
        const d = new Date(dateStr)
        return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
    }

    const monthYear = (dateStr?: string | null) => {
        if (!dateStr) return '-'
        const d = new Date(dateStr)
        return d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
    }

    // Stride between successive card snap points = card width (100vw - 60) + gap (12) = clientWidth - 48
    const getStride = (el: HTMLDivElement) => Math.max(1, el.clientWidth - 48)

    // Target progress (0..100) for the issued → due timeline of the current bill.
    // - today before issued      → 0 (bar stays at left)
    // - today between dates      → proportional (bar stops mid-way)
    // - today on or past scadenza → 100 (bar fully filled)
    // - invalid / missing dates  → 0 (don't lie with a full bar)
    const targetProgress = useMemo(() => {
        const dueDateStr = bill.scadenza || bill.data_scadenza
        const issuedStr = bill.data_emissione
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const dueDate = dueDateStr ? new Date(dueDateStr) : null
        const issued = issuedStr ? new Date(issuedStr) : null
        if (!issued || !dueDate) return 0
        const dueMs = dueDate.getTime()
        const issuedMs = issued.getTime()
        if (Number.isNaN(dueMs) || Number.isNaN(issuedMs)) return 0
        const totalMs = dueMs - issuedMs
        if (totalMs <= 0) return 0
        const elapsedMs = today.getTime() - issuedMs
        return Math.max(0, Math.min(100, (elapsedMs / totalMs) * 100))
    }, [bill.scadenza, bill.data_scadenza, bill.data_emissione])

    // Animated progress — on bill change we instantly snap to 0 (no transition)
    // and then enable the transition for the slide to the target. Without the
    // snap-step, the bar would first animate BACKWARDS from the previous bill's
    // value to 0 and the user would never see the clean left-to-right fill.
    const [animatedProgress, setAnimatedProgress] = useState(0)
    const [progressTransitionOn, setProgressTransitionOn] = useState(false)
    useEffect(() => {
        setProgressTransitionOn(false)
        setAnimatedProgress(0)
        const t = setTimeout(() => {
            setProgressTransitionOn(true)
            setAnimatedProgress(targetProgress)
        }, 60)
        return () => clearTimeout(t)
    }, [bill.id, targetProgress])

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const s = getStride(e.currentTarget)
        setScrollLeft(e.currentTarget.scrollLeft)
        setStride(s)
        if (isScrolling) return
        const index = Math.round(e.currentTarget.scrollLeft / s)

        if (index !== currentIndex && index >= 0 && index < allBills.length) {
            onSelectBill?.(allBills[index])
        }
    }

    // Keep scroll position in sync with the externally-selected bill
    useEffect(() => {
        if (!scrollRef.current || currentIndex < 0) return
        const stride = getStride(scrollRef.current)
        const target = currentIndex * stride
        if (Math.abs(scrollRef.current.scrollLeft - target) < 4) return
        setIsScrolling(true)
        scrollRef.current.scrollLeft = target
        const t = setTimeout(() => setIsScrolling(false), 120)
        return () => clearTimeout(t)
    }, [currentIndex])

    const handleDownload = () => {
        // PDFs are served exclusively via the authenticated signed-URL route.
        window.open(`/api/bills/${bill.id}/pdf`, '_blank')
    }

    return (
        <div
            className="fixed inset-0 z-50 bg-[#F8FAFC] dark:bg-[#0F1115] flex flex-col animate-content-in"
            style={{
                paddingTop: 'env(safe-area-inset-top)',
                paddingBottom: 'env(safe-area-inset-bottom)',
            }}
        >
            {/* Premium Header */}
            <div className="bg-[#F8FAFC] dark:bg-[#0F1115] px-5 pt-4 pb-4 shrink-0">
                <div className="flex items-center justify-between">
                    <button 
                        onClick={onBack} 
                        className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-[#0A2540] dark:text-white active:scale-90 transition-transform"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <p className="text-xl font-black text-[#0A2540] dark:text-white tracking-tight">Dettaglio</p>
                    <div className="w-12" /> {/* Spacer */}
                </div>
            </div>

            <div
                className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pb-6 space-y-6"
                style={{ touchAction: 'pan-y' }}
            >
                {/* Horizontal Card Carousel */}
                <div className="relative -mx-5 px-5">
                    <div
                        ref={scrollRef}
                        onScroll={isMultiBill ? handleScroll : undefined}
                        className={cn(
                            "flex scrollbar-hide gap-3 px-5",
                            isMultiBill
                                ? "overflow-x-auto snap-x snap-mandatory"
                                : "justify-center overflow-x-hidden snap-none"
                        )}
                        style={{
                            scrollPadding: '20px',
                            touchAction: isMultiBill ? 'pan-x pan-y' : 'pan-y',
                        }}
                    >
                        {allBills.map((b, idx) => {
                            const isPaid = b.status === 'paid'
                            const type = String(b.billing_type || '').trim().toUpperCase()
                            const isSaldo = type.startsWith('S')
                            const tLabel = isSaldo ? 'Saldo' : 'Acconto'
                            const isActive = idx === currentIndex
                            // Smooth per-card "centeredness" — drives gradient fade,
                            // scale, opacity and grayscale continuously while scrolling.
                            const distance = stride > 0
                                ? Math.abs(scrollLeft - idx * stride) / stride
                                : (isActive ? 0 : 1)
                            const progress = Math.max(0, Math.min(1, 1 - distance))

                            return (
                                <div
                                    key={b.id}
                                    className={cn(
                                        "shrink-0 snap-center",
                                        allBills.length === 1 ? "w-full" : "w-[calc(100vw-60px)]"
                                    )}
                                    style={{
                                        transform: `scale(${0.92 + 0.08 * progress})`,
                                        opacity: 0.4 + 0.6 * progress,
                                        filter: `grayscale(${(1 - progress) * 0.2})`,
                                        transition: 'transform 220ms ease-out, opacity 220ms ease-out, filter 220ms ease-out',
                                    }}
                                >
                                    <div
                                        className="relative overflow-hidden rounded-[2.25rem] text-white p-6 aspect-[1.6/1] min-h-[200px] bg-slate-900 dark:bg-white/5 flex flex-col justify-between"
                                    >
                                        {/* Layered active gradient — fades in/out smoothly with scroll progress */}
                                        <div
                                            className="absolute inset-0 animate-gradient-shift"
                                            style={{
                                                background: 'linear-gradient(135deg, #064E3B 0%, #065F46 50%, #1E5BFF 100%)',
                                                opacity: progress,
                                                transition: 'opacity 220ms ease-out',
                                            }}
                                        />
                                        
                                        {/* Waves Background Overlay */}
                                        <div
                                            className="absolute inset-0 overflow-hidden pointer-events-none rounded-[2.25rem]"
                                            style={{ opacity: progress, transition: 'opacity 220ms ease-out' }}
                                        >
                                            <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-emerald-400/20 blur-3xl animate-wave-pulse" />
                                            <div className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-3xl animate-wave-pulse" style={{ animationDelay: '2.5s' }} />
                                            <div className="absolute bottom-0 left-0 w-full h-24 overflow-hidden">
                                                <div className="absolute bottom-0 left-0 w-[200%] h-full flex animate-wave-slide reverse opacity-15" style={{ animationDuration: '25s' }}>
                                                    <svg className="w-1/2 h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
                                                        <path fill="#ffffff" d="M0,160 C240,160 480,60 720,160 C960,260 1200,160 1440,160 L1440,320 L0,320 Z" />
                                                    </svg>
                                                    <svg className="w-1/2 h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
                                                        <path fill="#ffffff" d="M0,160 C240,160 480,60 720,160 C960,260 1200,160 1440,160 L1440,320 L0,320 Z" />
                                                    </svg>
                                                </div>
                                                <div className="absolute bottom-0 left-0 w-[200%] h-full flex animate-wave-slide opacity-25" style={{ animationDuration: '18s' }}>
                                                    <svg className="w-1/2 h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
                                                        <path fill="#ffffff" d="M0,200 C360,200 480,100 720,200 C960,300 1080,200 1440,200 L1440,320 L0,320 Z" />
                                                    </svg>
                                                    <svg className="w-1/2 h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
                                                        <path fill="#ffffff" d="M0,200 C360,200 480,100 720,200 C960,300 1080,200 1440,200 L1440,320 L0,320 Z" />
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="relative z-10 flex-1 flex flex-col justify-between h-full">
                                            {/* Top Row: Emissione (left) and Status/Type Badges (right) */}
                                            <div className="flex justify-between items-start">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/60 mb-1">
                                                        Emissione Bolletta
                                                    </span>
                                                    <span className="text-[14px] font-black uppercase tracking-wider text-white leading-none">
                                                        {monthYear(b.data_emissione)}
                                                    </span>
                                                </div>
                                                
                                                <div className="flex flex-col items-end gap-1.5 shrink-0">
                                                    <span className={cn(
                                                        "text-[11px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-lg backdrop-blur-md border",
                                                        isSaldo 
                                                            ? "bg-blue-500/20 border-blue-400/20 text-blue-200" 
                                                            : "bg-orange-500/20 border-orange-400/20 text-orange-200"
                                                    )}>
                                                        {tLabel}
                                                    </span>
                                                    {isPaid ? (
                                                        <span className="text-[10px] font-black tracking-[0.15em] uppercase text-emerald-300 bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-400/20 flex items-center gap-1.5">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                            PAGATA
                                                        </span>
                                                    ) : b.expected_method === 'MP23' ? (
                                                        <span className="text-[10px] font-black tracking-[0.15em] uppercase text-[#93C5FD] bg-[#1E5BFF]/20 px-2.5 py-1 rounded-lg border border-[#60A5FA]/20 flex items-center gap-1.5">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-[#60A5FA] animate-pulse" />
                                                            DA PAGARE
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>

                                            {/* Middle Row: Amount */}
                                            <div className="my-auto pt-2 flex justify-between items-center">
                                                <span className="text-3xl font-extrabold opacity-70 text-left">€</span>
                                                <span className="text-4xl font-extrabold tracking-tight text-right">{formatPrice(b.importo)}</span>
                                            </div>

                                            {/* Bottom Row: Bill Serial Number & PagoPA logo */}
                                            <div className="flex justify-between items-end border-t border-white/10 pt-3">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-white/50">N° Bolletta</span>
                                                    <span className="text-[12px] font-bold text-white mt-0.5 font-mono">{billNumber(b)}</span>
                                                </div>
                                                {!isPaid && b.expected_method === 'MP23' && (
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <img src="/pagoPA-white.svg" alt="pagoPA" className="h-5 w-auto opacity-90" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Pagination Dots - Moved Under Cards */}
                    {allBills.length > 1 && (
                        <div className="flex flex-col items-center mt-6 mb-2">
                            <div className="flex justify-center gap-2 items-center">
                                {allBills.slice(0, 10).map((_, i) => (
                                    <div 
                                        key={i} 
                                        className={cn(
                                            "h-2 rounded-full transition-all duration-300 shrink-0",
                                            i === currentIndex 
                                                ? "w-8 bg-blue-600 dark:bg-blue-400" 
                                                : "w-2 bg-blue-300 dark:bg-blue-800"
                                        )} 
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Details Section - Synchronized with current bill (no remount animation) */}
                <div className="px-5 space-y-4">
                    {(() => {
                        const dueDateStr = bill.scadenza || bill.data_scadenza
                        const issuedStr = bill.data_emissione

                        const today = new Date()
                        today.setHours(0, 0, 0, 0)
                        const dueDate = dueDateStr ? new Date(dueDateStr) : null
                        const issued = issuedStr ? new Date(issuedStr) : null

                        return (
                            <div className="bg-white dark:bg-[#1A1D23] p-5 rounded-[2rem] space-y-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                        <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 bg-[#1E5BFF]/10 dark:bg-white/5 text-[#1E5BFF] dark:text-[#93C5FD]">
                                            <Clock size={20} strokeWidth={2.5} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Periodo</p>
                                            <p className="text-[18px] font-bold text-[#0A2540] dark:text-white tracking-tight leading-tight">
                                                {issued && dueDate
                                                    ? `${Math.max(1, Math.ceil((dueDate.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24)))} giorni`
                                                    : '—'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Consumo</p>
                                        <p className="text-[18px] font-bold text-[#1E5BFF] dark:text-[#93C5FD] tracking-tight leading-tight flex items-center gap-1 justify-end">
                                            <Droplets size={14} className="text-[#1E5BFF] dark:text-[#93C5FD] shrink-0" fill="currentColor" fillOpacity={0.25} />
                                            {bill.consumo || 0} <span className="text-[12px] font-medium text-slate-400">mc</span>
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="relative h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className="absolute top-0 left-0 h-full rounded-full bg-[#1E5BFF] dark:bg-[#93C5FD]"
                                            style={{
                                                width: `${animatedProgress}%`,
                                                transformOrigin: 'left center',
                                                transition: progressTransitionOn
                                                    ? 'width 1400ms cubic-bezier(0.16, 1, 0.3, 1)'
                                                    : 'none',
                                            }}
                                        />
                                    </div>
                                    <div className="flex justify-between">
                                        <div>
                                            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Emissione</p>
                                            <p className="text-[13px] font-bold text-[#0A2540] dark:text-white mt-0.5">{formatDate(issuedStr)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Scadenza</p>
                                            <p className="text-[13px] font-bold text-[#0A2540] dark:text-white mt-0.5">{formatDate(dueDateStr)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })()}

                    <div className="bg-white dark:bg-[#1A1D23] rounded-[2rem] px-4 py-1 divide-y divide-slate-100 dark:divide-white/5">
                        <div className="py-3 flex justify-between items-center gap-3">
                            <div className="flex items-center gap-2.5 text-slate-400">
                                <FileText size={14} />
                                <span className="text-[11px] font-bold uppercase tracking-wider">N° Bolletta</span>
                            </div>
                            <span className="text-[16px] font-mono font-bold text-[#0A2540] dark:text-white truncate">{billNumber(bill)}</span>
                        </div>
                        <div className="py-3 flex justify-between items-center gap-3">
                            <div className="flex items-center gap-2.5 text-slate-400 shrink-0">
                                <MapPin size={14} />
                                <span className="text-[11px] font-bold uppercase tracking-wider">Fornitura</span>
                            </div>
                            <span className="text-[14px] font-bold text-[#0A2540] dark:text-white text-right truncate">
                                {supply?.address || bill.ulm}
                            </span>
                        </div>
                        <div className="py-3 flex justify-between items-center gap-3">
                            <div className="flex items-center gap-2.5 text-slate-400">
                                <User size={14} />
                                <span className="text-[11px] font-bold uppercase tracking-wider">CIF</span>
                            </div>
                            <span className="text-[14px] font-bold text-[#0A2540] dark:text-white truncate">
                                {supply?.cif || bill.cif || '—'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sticky Bottom Actions */}
            <div className="p-5 bg-white/95 dark:bg-[#1A1D23]/95 backdrop-blur-lg border-t border-slate-100 dark:border-white/5 shrink-0 flex flex-col gap-2.5 shadow-[0_-8px_30px_rgb(0,0,0,0.04)]">
                {bill.status !== 'paid' && bill.expected_method === 'MP23' && (
                    <button
                        onClick={() => {
                            if (!isPaying) onPay?.(bill);
                        }}
                        disabled={isPaying}
                        className="w-full bg-[#1E5BFF] text-white py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-base tracking-tight active:scale-[0.98] transition-all disabled:opacity-50 shadow-md shadow-[#1E5BFF]/20"
                    >
                        {isPaying ? (
                            <Loader2 size={20} className="animate-spin" />
                        ) : (
                            <CreditCard size={20} strokeWidth={3} />
                        )}
                        {isPaying ? 'Elaborazione...' : 'Paga ora con PagoPA'}
                    </button>
                )}
                <button
                    onClick={handleDownload}
                    className="w-full py-4 rounded-2xl bg-slate-100 dark:bg-white/5 text-[#0A2540] dark:text-white font-bold text-sm tracking-tight active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                >
                    <FileText size={20} strokeWidth={2.5} className="text-[#1E5BFF] dark:text-[#93C5FD]" />
                    Visualizza Bolletta PDF
                </button>
            </div>
        </div>
    )
}
