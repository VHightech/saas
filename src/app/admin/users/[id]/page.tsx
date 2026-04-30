'use client'

import { use, useMemo, useState, useEffect, useRef, useLayoutEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
    ArrowLeft, Download, Eye, Edit2, Key, ChevronLeft, ChevronRight,
    Search, FileText, X, Check, Calendar, ChevronDown, Copy, Droplets
} from 'lucide-react'
import { Toaster, toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { format, startOfDay, endOfDay, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, isAfter, isBefore } from 'date-fns'
import { it as itLocale } from 'date-fns/locale'
import { updateUser } from '../actions'
import { ExpensesTrendChart } from '@/components/dashboard/widgets/ExpensesTrendChart'
import { AdminPageHero } from '@/components/admin/admin-page-hero'
import { cn } from '@/lib/utils'

interface Profile {
    id: string
    name: string | null
    email: string | null
    phone: string | null
    cfpi: string | null
    cif: string | null
    address: string | null
    city: string | null
    codice_cliente: string | null
    is_shadow?: boolean
}

interface UserSupply {
    id: string
    cif: string
    address: string | null
    city: string | null
    codice_cliente: string
    ulm?: string
}

interface Bill {
    id: number
    nome_pdf: string | null
    pdf_url: string | null
    data_emissione: string | null
    scadenza: string | null
    importo: number | null
    consumo: number | null
    tipo_servizio: string | null
    billing_type: string | null
    expected_method: string | null
    ulm: string | null
    numero_bolletta: string | null
}

function formatEuro(n: number) {
    return `${(n || 0).toFixed(2).replace('.', ',')} €`
}

function CodeBadge({ value, label, copyable, mono = true }: { value: string; label?: string; copyable?: boolean; mono?: boolean }) {
    const [copied, setCopied] = useState(false)
    const copy = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!copyable || !value) return
        try { await navigator.clipboard.writeText(value) } catch {}
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }
    const Wrapper: any = copyable ? 'button' : 'span'
    
    return (
        <div className="group relative inline-flex items-center">
            <Wrapper
                {...(copyable ? { onClick: copy, title: `Copia ${value}` } : {})}
                className={cn(
                    'relative inline-flex items-center h-7 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 px-3 rounded-full max-w-full transition-all duration-300',
                    copyable && 'cursor-pointer hover:border-slate-300 dark:hover:border-white/20 active:scale-[0.98]',
                    copyable && 'pr-8', // Reserve space for icon on right
                    copied && 'border-emerald-500/50 bg-emerald-50 dark:bg-emerald-500/10'
                )}
            >
                <div className="flex items-center gap-2 min-w-0">
                    {label && (
                        <span className={cn(
                            "text-[8px] font-bold uppercase tracking-wider transition-colors duration-300 shrink-0",
                            copied ? "text-emerald-500/70" : "text-slate-400 dark:text-slate-500"
                        )}>
                            {label}
                        </span>
                    )}
                    <span className={cn(
                        "text-[11px] font-bold truncate transition-colors duration-300 tabular-nums",
                        mono && "font-mono",
                        copied ? "text-emerald-700 dark:text-emerald-400" : "text-slate-700 dark:text-slate-200"
                    )}>
                        {copied ? 'Copiato!' : value}
                    </span>
                </div>

                {/* Internal Icon - revealed on right */}
                {copyable && (
                    <div className={cn(
                        "absolute right-1.5 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300 origin-center",
                        copied 
                            ? "opacity-100 scale-100 bg-emerald-600 text-white" 
                            : "opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 bg-slate-900 dark:bg-white text-white dark:text-[#1A1F2A]"
                    )}>
                        {copied ? <Check size={10} strokeWidth={3} /> : <Copy size={9} strokeWidth={2.5} />}
                    </div>
                )}
            </Wrapper>
        </div>
    )
}

function RailCard({ label, action, children }: { label: string; action?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="bg-white dark:bg-[#1A1D23] rounded-xl border border-slate-200/70 dark:border-white/5 p-4">
            <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-slate-400">{label}</p>
                {action}
            </div>
            {children}
        </div>
    )
}

function Metric({ value, label, valueClass }: { value: string; label: string; valueClass?: string }) {
    return (
        <div className="flex flex-col">
            <p className={cn('text-[16px] font-bold tracking-tight text-slate-900 dark:text-white leading-none', valueClass)}>
                {value}
            </p>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 mt-1.5">{label}</p>
        </div>
    )
}

function MiniSpendChart({ bills }: { bills: Bill[] }) {
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
                <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-2">Andamento spesa & consumo</p>
                <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-[22px] font-bold tracking-tight text-slate-900 dark:text-white leading-none tabular-nums">
                        € {curI.toFixed(2).replace('.', ',')}
                    </h3>
                    <span className="text-[13px] font-bold text-indigo-500 dark:text-indigo-400 tabular-nums">
                        {curC} mc
                    </span>
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
                    
                    {!isEmpty && (
                        <>
                            {/* Consumption Area (Background) */}
                            {areaC && <path d={areaC} fill="url(#gradC)" />}
                            {pathC && <path d={pathC} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.4" />}
                            
                            {/* Importo Area (Foreground) */}
                            {areaI && <path d={areaI} fill="url(#gradI)" />}
                            {pathI && <path d={pathI} fill="none" stroke="#84cc16" strokeWidth="2.5" className="drop-shadow-[0_2px_4px_rgba(132,204,22,0.4)]" />}
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

function RangeCalendar({
    from, to, onChange,
}: {
    from: Date | null
    to: Date | null
    onChange: (from: Date | null, to: Date | null) => void
}) {
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

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const [invoiceSearch, setInvoiceSearch] = useState('')
    const [fromDate, setFromDate] = useState<Date | null>(null)
    const [toDate, setToDate] = useState<Date | null>(null)
    const [periodOpen, setPeriodOpen] = useState(false)
    const periodRef = useRef<HTMLDivElement>(null)
    const [selectedUlm, setSelectedUlm] = useState<string>('all')
    const [supplyOpen, setSupplyOpen] = useState(false)
    const supplyRef = useRef<HTMLDivElement>(null)
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(25)
    const [loading, setLoading] = useState(true)

    const [profile, setProfile] = useState<Profile | null>(null)
    const [userSupplies, setUserSupplies] = useState<UserSupply[]>([])
    const [bills, setBills] = useState<Bill[]>([])

    const supabase = createClient()

    useEffect(() => { fetchData() }, [id])

    useEffect(() => {
        function handler(e: MouseEvent) {
            if (periodRef.current && !periodRef.current.contains(e.target as Node)) setPeriodOpen(false)
            if (supplyRef.current && !supplyRef.current.contains(e.target as Node)) setSupplyOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    async function fetchData() {
        setLoading(true)
        const { data: profileData, error: profileError } = await supabase
            .from('profiles').select('*').eq('id', id).single()
        if (profileError) { console.error(profileError); setLoading(false); return }
        setProfile(profileData)

        const { data: suppliesData } = await supabase
            .from('user_supplies').select('*').eq('user_id', id).order('created_at', { ascending: true })
        if (suppliesData) setUserSupplies(suppliesData)

        const { data: billsData } = await supabase
            .from('bills').select('*').eq('user_id', id).order('data_emissione', { ascending: false })
        setBills(billsData || [])
        setLoading(false)
    }

    const [isEditing, setIsEditing] = useState(false)
    const [userData, setUserData] = useState({
        name: '', email: '', phone: '', address: '', city: '', fiscalCode: '', cif: ''
    })

    useEffect(() => {
        if (profile) {
            setUserData({
                name: profile.name || '',
                email: profile.email || '',
                phone: profile.phone || '',
                address: profile.address || '',
                city: profile.city || '',
                fiscalCode: profile.cfpi || '',
                cif: profile.cif || ''
            })
        }
    }, [profile])

    const handleSave = async () => {
        if (!userData.name.trim()) { toast.error("Il campo Anagrafica è obbligatorio."); return }
        toast.promise(
            updateUser(id, {
                name: userData.name, email: userData.email, phone: userData.phone,
                address: userData.address, city: userData.city,
                cfpi: userData.fiscalCode, cif: userData.cif
            }),
            {
                loading: 'Salvataggio in corso...',
                success: (res) => {
                    if (res.error) throw new Error(res.error)
                    setIsEditing(false); fetchData()
                    return 'Modifiche salvate'
                },
                error: (err) => `Errore: ${err.message}`
            }
        )
    }

    const handleResetPwd = () => {
        const email = isEditing ? userData.email : profile?.email
        if (!email) { toast.error("Nessuna email presente."); return }
        toast("Confermi invio reset password?", {
            description: `Email a: ${email}`,
            action: {
                label: 'Invia',
                onClick: async () => {
                    const { error } = await supabase.auth.resetPasswordForEmail(email, {
                        redirectTo: `${window.location.origin}/auth/update-password`,
                    })
                    if (error) toast.error("Errore: " + error.message)
                    else toast.success("Email di reset inviata!")
                }
            }
        })
    }

    const analytics = useMemo(() => {
        if (!profile) return null
        const totalInvoices = bills.length
        const totalAmount = bills.reduce((s, i) => s + (Number(i.importo) || 0), 0)
        const totalConsumo = bills.reduce((s, i) => s + (Number(i.consumo) || 0), 0)
        return { totalInvoices, totalAmount, totalConsumo }
    }, [profile, bills])

    const uniqueUlms = useMemo(() => {
        const set = new Set<string>()
        // 1. From bills
        bills.forEach(b => { if (b.ulm) set.add(b.ulm) })
        // 2. From supplies table (including those without bills yet)
        userSupplies.forEach(s => {
            if (s.ulm) set.add(s.ulm)
            else if (s.cif && s.cif.length >= 6) set.add(s.cif.slice(-6))
        })
        return Array.from(set).sort()
    }, [bills, userSupplies])

    const filteredInvoices = useMemo(() => {
        let filtered = bills
        if (selectedUlm !== 'all') {
            filtered = filtered.filter(inv => inv.ulm === selectedUlm)
        }
        if (fromDate) {
            const start = startOfDay(fromDate).getTime()
            filtered = filtered.filter(inv => inv.data_emissione && new Date(inv.data_emissione).getTime() >= start)
        }
        if (toDate) {
            const end = endOfDay(toDate).getTime()
            filtered = filtered.filter(inv => inv.data_emissione && new Date(inv.data_emissione).getTime() <= end)
        }
        const q = invoiceSearch.toLowerCase()
        if (!q) return filtered
        return filtered.filter(inv =>
            (inv.nome_pdf && inv.nome_pdf.toLowerCase().includes(q)) ||
            (inv.importo && inv.importo.toString().includes(q)) ||
            (inv.numero_bolletta && inv.numero_bolletta.toLowerCase().includes(q))
        )
    }, [bills, invoiceSearch, fromDate, toDate, selectedUlm])

    const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / itemsPerPage))
    const currentInvoices = filteredInvoices.slice(
        (currentPage - 1) * itemsPerPage, currentPage * itemsPerPage
    )

    if (loading) return <div className="p-10 text-center text-[12px] text-slate-400 font-medium">Caricamento profilo…</div>
    if (!profile) return <div className="p-10 text-center text-[12px] text-rose-500 font-semibold">Utente non trovato</div>
    if (!analytics) return null

    const ulmValue = (profile.cif || userSupplies[0]?.cif || '').slice(-6)
    const fullAddress = [profile.address, profile.city].filter(Boolean).join(', ')

    return (
        <>


            <AdminPageHero
                title={profile.name || 'Utente non registrato'}
                backAction={
                    <button
                        onClick={() => router.back()}
                        className="group h-9 px-3.5 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-white/10 transition-all active:scale-[0.98]"
                        title="Torna indietro"
                    >
                        <div className="w-5 h-5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-[#1A1F2A] flex items-center justify-center transition-transform group-hover:-translate-x-0.5">
                            <ArrowLeft size={11} strokeWidth={3} />
                        </div>
                        <span className="text-[12px] font-semibold tracking-tight">Indietro</span>
                    </button>
                }
                topActions={
                    <div className="flex items-center gap-2.5">
                        {isEditing ? (
                            <div className="flex items-center rounded-full h-9 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 overflow-hidden">
                                <button
                                    onClick={handleSave}
                                    className="flex items-center gap-2.5 pl-3 pr-4 h-full hover:bg-slate-50 dark:hover:bg-white/10 transition-colors active:opacity-80"
                                >
                                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                        <Check size={11} strokeWidth={3} />
                                    </div>
                                    <span className="text-[12px] font-bold text-slate-700 dark:text-slate-200 tracking-tight">Salva</span>
                                </button>
                                <div className="w-px h-4 bg-slate-200 dark:bg-white/10" />
                                <button
                                    onClick={() => setIsEditing(false)}
                                    className="group/x w-10 h-full flex items-center justify-center transition-all active:opacity-80"
                                    title="Annulla"
                                >
                                    <X size={15} strokeWidth={2.5} className="text-slate-400 dark:text-slate-500 group-hover/x:text-red-500 group-hover/x:rotate-90 transition-all duration-300" />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="group h-9 px-3.5 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-white/10 transition-all active:scale-[0.98]"
                            >
                                <div className="w-5 h-5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-[#1A1F2A] flex items-center justify-center transition-transform">
                                    <Edit2 size={11} strokeWidth={3} />
                                </div>
                                <span className="text-[12px] font-semibold tracking-tight">Modifica</span>
                            </button>
                        )}

                        <button
                            onClick={handleResetPwd}
                            className="group h-9 px-3.5 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-white/10 transition-all active:scale-[0.98]"
                        >
                            <div className="w-5 h-5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-[#1A1F2A] flex items-center justify-center transition-transform group-hover:rotate-12">
                                <Key size={11} strokeWidth={3} />
                            </div>
                            <span className="text-[12px] font-semibold tracking-tight">Reset Pwd</span>
                        </button>
                    </div>
                }
                actions={
                    <div className="grid grid-cols-[1fr_320px] w-full items-end">
                        <div className="flex items-center justify-end gap-10 pr-8">
                            <div className="flex flex-col items-end">
                                <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-1">Totale</span>
                                <span className="text-[19px] font-bold text-slate-900 dark:text-white leading-none tabular-nums">
                                    {formatEuro(analytics.totalAmount)}
                                </span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-1">Bollette</span>
                                <span className="text-[19px] font-bold text-slate-900 dark:text-white leading-none tabular-nums">
                                    {analytics.totalInvoices}
                                </span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-1">Consumo Totale</span>
                                <span className="text-[19px] font-bold text-slate-900 dark:text-white leading-none tabular-nums">
                                    {analytics.totalConsumo} mc
                                </span>
                            </div>
                        </div>
                        <div className="w-[320px]" />
                    </div>
                }
            />

            <div className="h-full flex flex-col gap-3 min-h-0">
                {/* Body grid: main column + right rail */}
                <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-0">

                    {/* MAIN COLUMN */}
                    <div className="flex flex-col min-h-0 bg-white dark:bg-[#0F1115]">

                        {/* Edit form (inline, only when isEditing) */}
                        {isEditing && (
                            <div className="px-6 py-3 bg-slate-50/60 dark:bg-white/[0.02] border-t border-slate-200/70 dark:border-white/5 grid grid-cols-2 md:grid-cols-3 gap-3">
                                {[
                                    { key: 'name', label: 'Nome' },
                                    { key: 'email', label: 'Email' },
                                    { key: 'phone', label: 'Telefono' },
                                    { key: 'fiscalCode', label: 'CF / P.IVA' },
                                    { key: 'address', label: 'Indirizzo' },
                                    { key: 'city', label: 'Città' },
                                ].map(f => (
                                    <div key={f.key} className="flex flex-col gap-1">
                                        <label className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">{f.label}</label>
                                        <input
                                            value={(userData as any)[f.key] || ''}
                                            onChange={(e) => setUserData(d => ({ ...d, [f.key]: e.target.value }))}
                                            className="h-8 px-2 rounded-md bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[12px] text-slate-700 dark:text-slate-200 outline-none focus:border-slate-300 dark:focus:border-white/20"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Filter row above table */}
                        <div className="flex items-center gap-2 shrink-0 flex-wrap px-6 py-2 bg-white dark:bg-[#0F1115] border-t border-slate-200/70 dark:border-white/5">
                            <div ref={periodRef} className="relative">
                                <button
                                    onClick={() => setPeriodOpen(v => !v)}
                                    className={cn(
                                        "h-8 px-3 rounded-full text-[12px] font-medium flex items-center gap-2 transition-all",
                                        (fromDate || toDate)
                                            ? "bg-[#1A1F2A] text-white border border-transparent"
                                            : "bg-white dark:bg-white/5 border border-dashed border-slate-300 dark:border-white/20 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-white/40"
                                    )}
                                >
                                    <Calendar size={13} className={(fromDate || toDate) ? 'text-white/70' : 'text-slate-400'} />
                                    <span>
                                        {fromDate || toDate
                                            ? `${fromDate ? format(fromDate, 'dd/MM/yy') : '—'} → ${toDate ? format(toDate, 'dd/MM/yy') : '—'}`
                                            : 'Periodo'}
                                    </span>
                                    {(fromDate || toDate) ? (
                                        <span
                                            role="button"
                                            onClick={(e) => { e.stopPropagation(); setFromDate(null); setToDate(null); setCurrentPage(1) }}
                                            className="ml-1 -mr-1 h-4 w-4 rounded-full hover:bg-white/15 flex items-center justify-center"
                                            title="Cancella periodo"
                                        >
                                            <X size={11} />
                                        </span>
                                    ) : (
                                        <ChevronDown size={13} className="text-slate-400" />
                                    )}
                                </button>
                                {periodOpen && (
                                    <div className="absolute top-full left-0 mt-1 w-[300px] bg-white dark:bg-[#1A1D23] border border-slate-200 dark:border-white/10 rounded-lg shadow-xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100">
                                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-white/5">
                                            <div className="flex items-center gap-1.5 text-[11px]">
                                                <span className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">Dal</span>
                                                <span className="text-slate-700 dark:text-slate-200 font-mono font-semibold">
                                                    {fromDate ? format(fromDate, 'dd/MM/yy') : '—'}
                                                </span>
                                            </div>
                                            <ChevronRight size={12} className="text-slate-300" />
                                            <div className="flex items-center gap-1.5 text-[11px]">
                                                <span className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">Al</span>
                                                <span className="text-slate-700 dark:text-slate-200 font-mono font-semibold">
                                                    {toDate ? format(toDate, 'dd/MM/yy') : '—'}
                                                </span>
                                            </div>
                                        </div>
                                        <RangeCalendar
                                            from={fromDate}
                                            to={toDate}
                                            onChange={(f, t) => { setFromDate(f); setToDate(t); setCurrentPage(1) }}
                                        />
                                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-white/5">
                                            <button
                                                onClick={() => { setFromDate(null); setToDate(null); setCurrentPage(1) }}
                                                className="text-[11px] font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                                            >
                                                Pulisci
                                            </button>
                                            <button
                                                onClick={() => setPeriodOpen(false)}
                                                className="h-7 px-3 rounded-md bg-[#1A1F2A] text-white text-[11px] font-medium hover:bg-[#0A2540] transition-colors"
                                            >
                                                Fatto
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Supply / Fornitura filter */}
                            {uniqueUlms.length > 0 && (
                                <div ref={supplyRef} className="relative">
                                    <button
                                        onClick={() => setSupplyOpen(v => !v)}
                                        className={cn(
                                            "h-8 px-3 rounded-full text-[12px] font-medium flex items-center gap-2 transition-all",
                                            selectedUlm !== 'all'
                                                ? "bg-[#1A1F2A] text-white border border-transparent"
                                                : "bg-white dark:bg-white/5 border border-dashed border-slate-300 dark:border-white/20 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-white/40"
                                        )}
                                    >
                                        <FileText size={13} className={selectedUlm !== 'all' ? 'text-white/70' : 'text-slate-400'} />
                                        <span className="flex items-center gap-1">
                                            {selectedUlm !== 'all' ? (
                                                <>
                                                    <span className="opacity-70">ULM</span>
                                                    <span
                                                        role="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            navigator.clipboard.writeText(selectedUlm)
                                                            toast.success("ULM Copiato!")
                                                        }}
                                                        className="hover:underline underline-offset-4 hover:text-lime-400 cursor-pointer transition-colors"
                                                        title="Clicca per copiare"
                                                    >
                                                        {selectedUlm}
                                                    </span>
                                                </>
                                            ) : (
                                                'Fornitura'
                                            )}
                                        </span>
                                        {selectedUlm !== 'all' ? (
                                            <span
                                                role="button"
                                                onClick={(e) => { e.stopPropagation(); setSelectedUlm('all'); setCurrentPage(1) }}
                                                className="ml-1 -mr-1 h-5 w-5 rounded-full hover:bg-white/15 flex items-center justify-center transition-colors shrink-0"
                                                title="Mostra tutte"
                                            >
                                                <X size={11} />
                                            </span>
                                        ) : (
                                            <ChevronDown size={13} className="ml-1 text-slate-400 shrink-0" />
                                        )}
                                    </button>
                                    {supplyOpen && (
                                        <div className="absolute top-full left-0 mt-1 w-[240px] bg-white dark:bg-[#1A1D23] border border-slate-200 dark:border-white/10 rounded-lg shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                                            <button
                                                onClick={() => { setSelectedUlm('all'); setSupplyOpen(false); setCurrentPage(1) }}
                                                className={cn(
                                                    "w-full text-left px-4 py-2.5 text-[12px] font-medium flex items-center justify-between transition-colors",
                                                    selectedUlm === 'all'
                                                        ? "bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white"
                                                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
                                                )}
                                            >
                                                Tutte le forniture
                                                {selectedUlm === 'all' && <div className="w-1.5 h-1.5 rounded-full bg-[#1A1F2A] dark:bg-white" />}
                                            </button>
                                            {uniqueUlms.map(ulm => {
                                                const supply = userSupplies.find(s => s.ulm === ulm || (s.cif && s.cif.endsWith(ulm)))
                                                return (
                                                    <button
                                                        key={ulm}
                                                        onClick={() => { setSelectedUlm(ulm); setSupplyOpen(false); setCurrentPage(1) }}
                                                        className={cn(
                                                            "w-full text-left px-4 py-2.5 text-[12px] font-medium flex items-center justify-between transition-colors",
                                                            selectedUlm === ulm
                                                                ? "bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white"
                                                                : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
                                                        )}
                                                    >
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="font-mono text-[11px] truncate">{ulm}</span>
                                                            {supply?.address && (
                                                                <span className="text-[10px] text-slate-400 truncate">{supply.address}</span>
                                                            )}
                                                        </div>
                                                        {selectedUlm === ulm && <div className="w-1.5 h-1.5 rounded-full bg-[#1A1F2A] dark:bg-white shrink-0" />}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="ml-auto relative w-64">
                                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Cerca bolletta…"
                                    value={invoiceSearch}
                                    onChange={(e) => setInvoiceSearch(e.target.value)}
                                    className="w-full h-8 pl-8 pr-3 rounded-md bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[12px] text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-slate-300 dark:focus:border-white/20 transition-all"
                                />
                            </div>
                        </div>

                        {/* Table — grid based, list-page style */}
                        <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
                            <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_72px] gap-3 px-6 py-2 bg-white dark:bg-[#0F1115] text-[10px] font-semibold tracking-[0.12em] uppercase text-slate-400 dark:text-slate-500 border-t border-slate-200/70 dark:border-white/5">
                                <div>N° Bolletta</div>
                                <div>Emissione</div>
                                <div>Scadenza</div>
                                <div className="text-right">Consumo</div>
                                <div className="text-right">Importo</div>
                                <div className="text-right">Azioni</div>
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-white/5">
                                {currentInvoices.length === 0 ? (
                                    <div className="px-6 py-16 text-center text-[12px] text-slate-400">Nessuna bolletta trovata</div>
                                ) : currentInvoices.map((inv) => (
                                    <div
                                        key={inv.id}
                                        className="group grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_72px] gap-3 items-center px-6 py-3 hover:bg-slate-100/50 dark:hover:bg-white/[0.02] transition-colors"
                                    >
                                        <div className="text-[14px] font-medium text-slate-800 dark:text-white truncate font-mono">
                                            {inv.numero_bolletta || inv.nome_pdf?.replace('.pdf', '') || `#${inv.id}`}
                                        </div>
                                        <div className="text-[13px] text-slate-500 dark:text-slate-400">
                                            {inv.data_emissione ? format(new Date(inv.data_emissione), 'dd/MM/yyyy') : '—'}
                                        </div>
                                        <div className="text-[13px] text-slate-500 dark:text-slate-400">
                                            {inv.scadenza ? format(new Date(inv.scadenza), 'dd/MM/yyyy') : '—'}
                                        </div>
                                        <div className="text-[13px] font-semibold text-slate-700 dark:text-slate-200 text-right tabular-nums flex items-center justify-end gap-1.5">
                                            <Droplets size={14} className="text-sky-400 fill-sky-400/30" strokeWidth={2.5} />
                                            <span>{inv.consumo ?? 0}</span>
                                            <span className="text-slate-400 font-normal text-[11px]">mc</span>
                                        </div>
                                        <div className="text-[14px] font-semibold text-slate-900 dark:text-white text-right tabular-nums">
                                            {formatEuro(Number(inv.importo) || 0)}
                                        </div>
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => window.open(`/api/bills/${inv.id}/pdf`, '_blank')}
                                                className="h-7 w-7 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/10 flex items-center justify-center transition-colors"
                                                title="Visualizza"
                                            >
                                                <Eye size={13} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const link = document.createElement('a')
                                                    link.href = `/api/bills/${inv.id}/pdf`
                                                    link.download = inv.nome_pdf || `bolletta_${inv.id}.pdf`
                                                    link.click()
                                                }}
                                                className="h-7 w-7 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/10 flex items-center justify-center transition-colors"
                                                title="Scarica"
                                            >
                                                <Download size={13} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-between py-3 px-6 text-[12px] text-slate-500 dark:text-slate-400 shrink-0 border-t border-slate-200/70 dark:border-white/5">
                            <div className="flex items-center gap-2 pl-3">
                                <span className="font-medium text-slate-400 uppercase tracking-wider text-[10px]">Righe</span>
                                <select
                                    value={itemsPerPage}
                                    onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1) }}
                                    className="bg-transparent border border-slate-200 dark:border-white/10 rounded-md px-2 py-1 outline-none text-slate-700 dark:text-slate-200 text-[12px] font-semibold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                                >
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                                <span className="text-slate-300 dark:text-slate-700 mx-1">·</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">{filteredInvoices.length} totali</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span>Pagina {currentPage} di {totalPages}</span>
                                <button
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    className="w-7 h-7 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                                >
                                    <ChevronLeft size={14} />
                                </button>
                                <button
                                    disabled={currentPage >= totalPages}
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    className="w-7 h-7 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                                >
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT RAIL */}
                    <aside className="hidden xl:flex flex-col gap-3 min-h-0 overflow-auto custom-scrollbar pt-2 pr-6 pl-6">
                        {/* Account Details Card */}
                        <div className="bg-white dark:bg-[#1A1D23] rounded-xl border border-slate-200/70 dark:border-white/5 p-4">
                            <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-slate-400 mb-3">
                                Informazioni Account
                            </p>
                            <div className="flex flex-col gap-2.5">
                                {profile.codice_cliente && (
                                    <CodeBadge value={profile.codice_cliente} label="CODICE CLIENTE" copyable />
                                )}
                                {profile.cfpi && (
                                    <CodeBadge value={profile.cfpi} label={/^\d{11}$/.test(profile.cfpi) ? 'P.IVA' : 'CF'} copyable />
                                )}
                                {profile.email && (
                                    <CodeBadge value={profile.email} label="EMAIL" copyable mono={false} />
                                )}
                                {profile.phone && (
                                    <CodeBadge value={profile.phone} label="TEL" copyable />
                                )}
                                {profile.address && (
                                    <CodeBadge value={profile.address} label="IND" copyable mono={false} />
                                )}
                                {profile.city && (
                                    <CodeBadge value={profile.city} label="CIT" copyable mono={false} />
                                )}
                            </div>
                        </div>

                        {userSupplies.length > 0 && (
                            <div className="bg-white dark:bg-[#1A1D23] rounded-xl border border-slate-200/70 dark:border-white/5 p-4">
                                <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-slate-400 mb-3">
                                    Forniture <span className="text-slate-300 dark:text-slate-600">· {userSupplies.length}</span>
                                </p>
                                <div className="divide-y divide-slate-100 dark:divide-white/5 -mx-1">
                                    {userSupplies.map(s => (
                                        <div key={s.id} className="flex flex-col gap-1 px-1 py-2.5 first:pt-0 last:pb-0">
                                            <CodeBadge value={s.cif} label="CIF" copyable />
                                            {(s.address || s.city) && (
                                                <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate pl-0.5">
                                                    {[s.address, s.city].filter(Boolean).join(', ')}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}



                        <div className="bg-white dark:bg-[#1A1D23] rounded-xl border border-slate-200/70 dark:border-white/5 p-4">
                            <MiniSpendChart bills={bills} />
                        </div>
                    </aside>
                </div>
            </div>
        </>
    )
}
