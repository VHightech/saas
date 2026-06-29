'use client'

import { use, useMemo, useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
    ArrowLeft, Download, Eye, Edit2, Key, ChevronLeft, ChevronRight,
    Search, FileText, X, Check, Calendar, ChevronDown, Droplets, Trash2, RotateCcw
} from 'lucide-react'
import { Toaster, toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { format, startOfDay, endOfDay } from 'date-fns'
import { updateUser, deleteUser, deleteSupply, resetUserPassword, resetActivation } from '../actions'
import { AdminPageHero } from '@/components/admin/admin-page-hero'
import { CodeBadge } from '@/components/ui/CodeBadge'
import { MiniSpendChart } from '@/components/admin/users/MiniSpendChart'
import { InvoiceRangeCalendar } from '@/components/admin/users/InvoiceRangeCalendar'
import { formatEuro } from '@/lib/format'
import { getContractStatus, STATUS_TINT_CLASS } from '@/lib/contract-status'
import { paymentMethodLabel, formatPaymentMethod } from '@/lib/payment-methods'
import { billingTypeDisplay, BILLING_TONE_CLASS } from '@/lib/billing-type'
import { cn } from '@/lib/utils'

interface Profile {
    id: string
    name: string | null
    email: string | null
    phone: string | null
    codice_fiscale: string | null
    partita_iva: string | null
    pec: string | null
    cif: string | null
    address: string | null
    city: string | null
    codice_cliente: string | null
    stadio?: string | null
    stato_contratto?: string | null
    is_shadow?: boolean
}

interface UserSupply {
    id: string
    cif: string
    address: string | null
    city: string | null
    codice_cliente: string
    ulm?: string
    stadio?: string | null
    stato_contratto?: string | null
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
    cif: string | null
    numero_bolletta: string | null
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
    const [supplySearch, setSupplySearch] = useState('')
    const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
    const [canManage, setCanManage] = useState(false)
    const [suppliesActionsOpen, setSuppliesActionsOpen] = useState(false)

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

        // Fetch current user role
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            const { data: currProfile } = await supabase.from('profiles').select('role, can_manage_users').eq('auth_user_id', user.id).single()
            const role = currProfile?.role || null
            setCurrentUserRole(role)
            setCanManage(role === 'super_admin' || role === 'superadmin' || !!currProfile?.can_manage_users)
        }

        setLoading(false)
    }

    const [isEditing, setIsEditing] = useState(false)
    const [userData, setUserData] = useState({
        name: '', email: '', phone: '', codiceFiscale: '', partitaIva: '', pec: ''
    })

    useEffect(() => {
        if (profile) {
            setUserData({
                name: profile.name || '',
                email: profile.email || '',
                phone: profile.phone || '',
                codiceFiscale: profile.codice_fiscale || '',
                partitaIva: profile.partita_iva || '',
                pec: profile.pec || ''
            })
        }
    }, [profile])

    const handleSave = async () => {
        if (!userData.name.trim()) { toast.error("Il campo Anagrafica è obbligatorio."); return }
        toast.promise(
            updateUser(id, {
                name: userData.name, email: userData.email, phone: userData.phone,
                codice_fiscale: userData.codiceFiscale, partita_iva: userData.partitaIva,
                pec: userData.pec
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
        toast("Generare il link di reset password?", {
            description: `Per: ${email}`,
            action: {
                label: 'Genera',
                onClick: async () => {
                    const res = await resetUserPassword(id)
                    if (res.error) { toast.error("Errore: " + res.error); return }
                    toast.success("Email di reset password inviata all'utente.")
                }
            }
        })
    }

    const handleResetActivation = () => {
        toast("Ripristinare l'attivazione di questo utente?", {
            description: "L'account di accesso verrà rimosso e il profilo torna 'da attivare'. Bollette e forniture restano. Potrai inviare un nuovo link di registrazione.",
            action: {
                label: 'Ripristina',
                onClick: async () => {
                    const res = await resetActivation(id)
                    if (res.error) { toast.error('Errore: ' + res.error); return }
                    toast.success('Attivazione ripristinata. Ora puoi inviare un nuovo invito di registrazione.')
                    fetchData()
                }
            }
        })
    }

    const handleDeleteUser = async () => {
        if (!window.confirm("Sei sicuro di voler eliminare definitivamente questo profilo e tutti i suoi dati?")) return
        toast.promise(deleteUser(id), {
            loading: 'Eliminazione in corso...',
            success: (res) => {
                if (res.error) throw new Error(res.error)
                router.replace('/admin/users')
                return 'Utente eliminato'
            },
            error: (err) => `Errore: ${err.message}`
        })
    }

    const handleDeleteSupply = async (cif: string) => {
        if (!window.confirm(`Eliminare la fornitura ${cif}?`)) return
        toast.promise(deleteSupply(cif, id), {
            loading: 'Eliminazione in corso...',
            success: (res) => {
                if (res.error) throw new Error(res.error)
                fetchData()
                return 'Fornitura eliminata'
            },
            error: (err) => `Errore: ${err.message}`
        })
    }

    // Bills scoped to the currently selected fornitura (ULM). When 'all' is
    // selected this is every bill. KPIs and the right-bar chart reflect this.
    const scopedBills = useMemo(() => {
        if (selectedUlm === 'all') return bills
        return bills.filter(b => b.ulm === selectedUlm)
    }, [bills, selectedUlm])

    const analytics = useMemo(() => {
        if (!profile) return null
        const totalInvoices = scopedBills.length
        const totalAmount = scopedBills.reduce((s, i) => s + (Number(i.importo) || 0), 0)
        const totalConsumo = scopedBills.reduce((s, i) => s + (Number(i.consumo) || 0), 0)
        return { totalInvoices, totalAmount, totalConsumo }
    }, [profile, scopedBills])

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

    // How many bills belong to each fornitura (ULM), for the counter badges.
    const billCountByUlm = useMemo(() => {
        const counts: Record<string, number> = {}
        bills.forEach(b => { if (b.ulm) counts[b.ulm] = (counts[b.ulm] || 0) + 1 })
        return counts
    }, [bills])

    const filteredUniqueUlms = useMemo(() => {
        if (!supplySearch) return uniqueUlms
        const q = supplySearch.toLowerCase()
        return uniqueUlms.filter(ulm => {
            const supply = userSupplies.find(s => s.ulm === ulm || (s.cif && s.cif.endsWith(ulm)))
            return ulm.toLowerCase().includes(q) || 
                   (supply?.address?.toLowerCase().includes(q)) ||
                   (supply?.city?.toLowerCase().includes(q))
        })
    }, [uniqueUlms, supplySearch, userSupplies])

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

    return (
        <>


            <AdminPageHero
                title={
                    <div className="flex items-center gap-3">
                        <span>{profile.name || 'Utente non registrato'}</span>
                        {profile.stadio && (() => {
                            const status = getContractStatus(profile.stadio)
                            return (
                                <div className={cn(
                                    "px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider flex items-center gap-2",
                                    STATUS_TINT_CLASS[status.color]
                                )}>
                                    <span className="opacity-50 text-[8px] font-bold tracking-widest">Stato Contratto</span>
                                    <span>{status.label}</span>
                                </div>
                            )
                        })()}
                    </div>
                }
                backAction={
                    <button
                        onClick={() => router.back()}
                        className="group h-9 pl-2 pr-4 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-white/10 transition-all active:scale-[0.98]"
                        title="Torna indietro"
                    >
                        <div className="w-5 h-5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-[#1A1F2A] flex items-center justify-center transition-transform group-hover:-translate-x-0.5">
                            <ArrowLeft size={11} strokeWidth={3} />
                        </div>
                        <span className="text-[12px] font-semibold tracking-tight">Indietro</span>
                    </button>
                }
                topActions={
                    <div className="flex flex-col items-end gap-2.5">
                        {/* Row 1: Modifica + Reset Pwd — only for admins allowed to manage users */}
                        {canManage && (
                        <div className="flex items-center gap-2.5">
                            {isEditing ? (
                                <div className="flex items-center rounded-full h-9 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 overflow-hidden">
                                    <button
                                        onClick={handleSave}
                                        className="flex items-center gap-2 pl-2 pr-4 h-full hover:bg-slate-50 dark:hover:bg-white/10 transition-colors active:opacity-80"
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
                                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover/x:bg-rose-500 group-hover/x:text-white transition-all duration-300">
                                            <X size={14} strokeWidth={2.5} className="group-hover/x:rotate-90 transition-transform duration-300" />
                                        </div>
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="group h-9 pl-2 pr-4 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-white/10 transition-all active:scale-[0.98]"
                                >
                                    <div className="w-5 h-5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-[#1A1F2A] flex items-center justify-center transition-transform">
                                        <Edit2 size={11} strokeWidth={3} />
                                    </div>
                                    <span className="text-[12px] font-semibold tracking-tight">Modifica</span>
                                </button>
                            )}

                            <button
                                onClick={handleResetPwd}
                                className="group h-9 pl-2 pr-4 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-white/10 transition-all active:scale-[0.98]"
                            >
                                <div className="w-5 h-5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-[#1A1F2A] flex items-center justify-center transition-transform group-hover:rotate-12">
                                    <Key size={11} strokeWidth={3} />
                                </div>
                                <span className="text-[12px] font-semibold tracking-tight">Reset Pwd</span>
                            </button>
                        </div>
                        )}

                        {/* Row 2: super-admin actions (reset activation + delete) */}
                        {(currentUserRole === 'super_admin' || currentUserRole === 'superadmin') && (
                            <div className="flex items-center gap-2.5">
                                <button
                                    onClick={handleResetActivation}
                                    className="group h-9 pl-2 pr-4 rounded-full border border-amber-200 dark:border-amber-500/20 bg-white dark:bg-amber-500/5 text-amber-600 dark:text-amber-400 flex items-center gap-2 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-all active:scale-[0.98]"
                                    title="Rimuove l'account di accesso e riporta il profilo a 'da attivare'"
                                >
                                    <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center transition-transform group-hover:rotate-[-90deg]">
                                        <RotateCcw size={11} strokeWidth={3} />
                                    </div>
                                    <span className="text-[12px] font-semibold tracking-tight">Reset Attivazione</span>
                                </button>
                                <button
                                    onClick={handleDeleteUser}
                                    className="group h-9 pl-2 pr-4 rounded-full border border-rose-200 dark:border-rose-500/20 bg-white dark:bg-rose-500/5 text-rose-600 dark:text-rose-400 flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all active:scale-[0.98]"
                                >
                                    <div className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center transition-transform group-hover:scale-110">
                                        <Trash2 size={11} strokeWidth={3} />
                                    </div>
                                    <span className="text-[12px] font-semibold tracking-tight">Elimina Profilo</span>
                                </button>
                            </div>
                        )}
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
                                    { key: 'codiceFiscale', label: 'Codice Fiscale' },
                                    { key: 'partitaIva', label: 'P.IVA' },
                                    { key: 'pec', label: 'PEC' },
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
                                        "h-9 px-4 rounded-full text-[13px] font-medium flex items-center gap-2 transition-all",
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
                                    <ChevronDown 
                                        size={13} 
                                        className={cn("transition-transform duration-200", (fromDate || toDate) ? 'text-white/60' : 'text-slate-400')} 
                                    />
                                    {(fromDate || toDate) && (
                                        <div
                                            role="button"
                                            onClick={(e) => { e.stopPropagation(); setFromDate(null); setToDate(null); setCurrentPage(1) }}
                                            className="w-5 h-5 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:bg-rose-500 hover:border-rose-500 -mr-1 transition-all duration-200"
                                            title="Cancella periodo"
                                        >
                                            <X size={10} strokeWidth={3} />
                                        </div>
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
                                        <InvoiceRangeCalendar
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
                                <div ref={supplyRef} className="relative group">
                                    <button
                                        onClick={() => { setSupplyOpen(v => !v); setSupplySearch('') }}
                                        className={cn(
                                            "h-9 px-4 rounded-full text-[13px] font-medium flex items-center gap-2 transition-all",
                                            selectedUlm !== 'all'
                                                ? "bg-[#1A1F2A] text-white border border-transparent"
                                                : "bg-white dark:bg-white/5 border border-dashed border-slate-300 dark:border-white/20 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-white/40"
                                        )}
                                    >
                <FileText size={13} className={selectedUlm !== 'all' ? 'text-white/70' : 'text-slate-400'} />
                <span className="flex items-center gap-1.5">
                    <span>Fornitura</span>
                    {selectedUlm !== 'all' && (
                        <span className="text-white/60 font-mono text-[13px] font-bold ml-1.5 leading-none flex items-center">
                            {selectedUlm}
                        </span>
                    )}
                </span>
                
                {selectedUlm === 'all' && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-400">
                        {uniqueUlms.length}
                    </span>
                )}

                <ChevronDown 
                    size={14} 
                    className={cn("transition-transform duration-200", selectedUlm !== 'all' ? 'text-white/60' : 'text-slate-400', supplyOpen ? 'rotate-180' : '')} 
                />

                {selectedUlm !== 'all' && (
                    <div
                        role="button"
                        onClick={(e) => { e.stopPropagation(); setSelectedUlm('all'); setCurrentPage(1) }}
                        className="w-5 h-5 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:bg-rose-500 hover:border-rose-500 -mr-1 transition-all duration-200"
                        title="Tutte le forniture"
                    >
                        <X size={10} strokeWidth={3} />
                    </div>
                )}
            </button>
            
            {supplyOpen && (
                <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-[#1A1D23] border border-slate-200 dark:border-white/10 rounded-lg shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="p-2 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
                        <div className="relative">
                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Cerca ULM o indirizzo..."
                                value={supplySearch}
                                onChange={(e) => setSupplySearch(e.target.value)}
                                className="w-full h-8 pl-8 pr-3 rounded-md bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[12px] text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500/50 transition-all"
                            />
                        </div>
                    </div>
                    
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar py-1">
                        <button
                            onClick={() => { setSelectedUlm('all'); setSupplyOpen(false); setCurrentPage(1) }}
                            className={cn(
                                "w-full text-left px-3 py-2 text-[12px] hover:bg-slate-50 dark:hover:bg-white/5 flex items-center justify-between",
                                selectedUlm === 'all' ? "text-indigo-600 font-bold" : "text-slate-600 dark:text-slate-400"
                            )}
                        >
                            <span>Tutte le forniture</span>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                {selectedUlm === 'all' && (
                                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                                        <Check size={11} strokeWidth={3} />
                                    </span>
                                )}
                                <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/10" title={`${bills.length} bollette totali`}>
                                    <span className="text-[13px] font-medium tabular-nums text-slate-700 dark:text-slate-200">{bills.length}</span>
                                    <span className="text-[9px] font-medium uppercase tracking-tight text-slate-400">boll</span>
                                </span>
                            </div>
                        </button>
                        
                        <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/30 dark:bg-white/[0.01]">
                            Risultati ({filteredUniqueUlms.length})
                        </div>
                        
                        {filteredUniqueUlms.length === 0 ? (
                            <div className="px-3 py-4 text-center text-[11px] text-slate-400 italic">
                                Nessun risultato
                            </div>
                        ) : filteredUniqueUlms.map(ulm => {
                            const supply = userSupplies.find(s => s.ulm === ulm || (s.cif && s.cif.endsWith(ulm)))
                            return (
                                <button
                                    key={ulm}
                                    onClick={() => { setSelectedUlm(ulm); setSupplyOpen(false); setCurrentPage(1) }}
                                    className={cn(
                                        "w-full text-left px-3 py-2 text-[12px] hover:bg-slate-50 dark:hover:bg-white/5 flex items-center justify-between group/opt border-l-2",
                                        selectedUlm === ulm ? "border-indigo-600 bg-indigo-50/30 dark:bg-indigo-500/5 text-indigo-600 font-bold" : "border-transparent text-slate-600 dark:text-slate-400"
                                    )}
                                >
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-mono text-[11px] truncate">{ulm}</span>
                                        {supply?.address && (
                                            <span className="text-[10px] text-slate-400 truncate font-normal">{supply.address}</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 ml-2">
                                        {selectedUlm === ulm && (
                                            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                                                <Check size={11} strokeWidth={3} />
                                            </span>
                                        )}
                                        <span
                                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/10"
                                            title={`${billCountByUlm[ulm] || 0} bollette`}
                                        >
                                            <span className="text-[13px] font-medium tabular-nums text-slate-700 dark:text-slate-200">{billCountByUlm[ulm] || 0}</span>
                                            <span className="text-[9px] font-medium uppercase tracking-tight text-slate-400">boll</span>
                                        </span>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
                            )}

                            <div className="ml-auto relative w-64">
                                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Cerca..."
                                    value={invoiceSearch}
                                    onChange={(e) => setInvoiceSearch(e.target.value)}
                                    className="w-full h-9 pl-9 pr-4 rounded-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[13px] text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-slate-300 dark:focus:border-white/20 transition-all"
                                />
                            </div>
                        </div>

                        {/* Table — grid based, list-page style */}
                        <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
                            <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.95fr)_minmax(0,0.95fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.4fr)_minmax(0,0.55fr)_minmax(0,0.55fr)_minmax(0,0.7fr)_72px] gap-3 px-6 py-2 bg-white dark:bg-[#0F1115] text-[10px] font-semibold tracking-[0.12em] uppercase text-slate-400 dark:text-slate-500 border-t border-slate-200/70 dark:border-white/5">
                                <div>N° Bolletta</div>
                                <div>CIF</div>
                                <div>ULM</div>
                                <div>Emissione</div>
                                <div>Scadenza</div>
                                <div className="text-center">Tipo</div>
                                <div>Metodo</div>
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
                                        className="group grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.95fr)_minmax(0,0.95fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.4fr)_minmax(0,0.55fr)_minmax(0,0.55fr)_minmax(0,0.7fr)_72px] gap-3 items-center px-6 py-3 hover:bg-slate-100/50 dark:hover:bg-white/[0.02] transition-colors"
                                    >
                                        <div className="text-[14px] font-medium text-slate-800 dark:text-white truncate font-mono">
                                            {inv.numero_bolletta || inv.nome_pdf?.replace('.pdf', '') || `#${inv.id}`}
                                        </div>
                                        <div className="flex items-center min-w-0">
                                            {inv.cif ? (
                                                <CodeBadge value={inv.cif} label="CIF" copyable />
                                            ) : '—'}
                                        </div>
                                        <div className="flex items-center min-w-0">
                                            {inv.ulm ? (
                                                <CodeBadge value={inv.ulm} label="ULM" copyable />
                                            ) : '—'}
                                        </div>
                                        <div className="text-[13px] text-slate-500 dark:text-slate-400">
                                            {inv.data_emissione ? format(new Date(inv.data_emissione), 'dd/MM/yyyy') : '—'}
                                        </div>
                                        <div className="text-[13px] text-slate-500 dark:text-slate-400">
                                            {inv.scadenza ? format(new Date(inv.scadenza), 'dd/MM/yyyy') : '—'}
                                        </div>
                                        <div className="flex items-center justify-center min-w-0">
                                            {(() => {
                                                const t = billingTypeDisplay(inv.billing_type)
                                                if (!t) return <span className="text-slate-400">—</span>
                                                // Use the compact `short` label so the coloured pill always fits
                                                // this narrow column; the full label stays in the tooltip.
                                                return (
                                                    <span className={cn(
                                                        "px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap",
                                                        BILLING_TONE_CLASS[t.tone]
                                                    )} title={t.label}>
                                                        {t.short}
                                                    </span>
                                                )
                                            })()}
                                        </div>
                                        <div className="min-w-0" title={formatPaymentMethod(inv.expected_method)}>
                                            {inv.expected_method ? (
                                                <>
                                                    <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                                                        {inv.expected_method}
                                                    </span>
                                                    {paymentMethodLabel(inv.expected_method) && (
                                                        <span className="block text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate">
                                                            {paymentMethodLabel(inv.expected_method)}
                                                        </span>
                                                    )}
                                                </>
                                            ) : (
                                                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">—</span>
                                            )}
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
                                                onClick={() => window.open(`/api/bills/${inv.id}/pdf?download=1`, '_blank')}
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
                            <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-slate-400 mb-3">
                                Informazioni Account
                            </p>
                            <div className="flex flex-col gap-2.5">
                                {profile.codice_cliente && (
                                    <CodeBadge value={profile.codice_cliente} label="CODICE CLIENTE" copyable />
                                )}
                                {profile.codice_fiscale && (
                                    <CodeBadge value={profile.codice_fiscale} label="CF" copyable />
                                )}
                                {profile.partita_iva && (
                                    <CodeBadge value={profile.partita_iva} label="P.IVA" copyable />
                                )}
                                {profile.pec && (
                                    <CodeBadge value={profile.pec} label="PEC" copyable mono={false} />
                                )}
                                {profile.email && (
                                    <CodeBadge value={profile.email} label="EMAIL" copyable mono={false} />
                                )}
                                {profile.phone && (
                                    <CodeBadge value={profile.phone} label="TEL" copyable />
                                )}
                            </div>
                        </div>

                        {userSupplies.length > 0 && (
                            <div className="bg-white dark:bg-[#1A1D23] rounded-xl border border-slate-200/70 dark:border-white/5 p-4 flex flex-col">
                                {(() => {
                                    const distribution = userSupplies.reduce((acc, s) => {
                                        const status = s.stadio || 'unknown'
                                        acc[status] = (acc[status] || 0) + 1
                                        return acc
                                    }, {} as Record<string, number>)

                                    const sortedStatuses = Object.entries(distribution).sort((a, b) => b[1] - a[1])

                                    return (
                                        <div className="flex flex-col gap-2 mt-1">
                                            <p className="text-[9px] font-medium text-slate-400 uppercase tracking-widest mb-1 opacity-70">Stato Contratti</p>
                                            <div className="flex flex-wrap gap-2">
                                                {sortedStatuses.map(([stadio, count]) => {
                                                    const status = getContractStatus(stadio)
                                                    return (
                                                        <div
                                                            key={stadio}
                                                            className={cn(
                                                                "flex items-center gap-2 px-2 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-tight transition-all",
                                                                STATUS_TINT_CLASS[status.color]
                                                            )}
                                                        >
                                                            <span>{status.label}</span>
                                                            <span className="w-5 h-5 rounded-md bg-black/5 dark:bg-white/10 flex items-center justify-center font-mono text-[10px]">
                                                                {count}
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </div>

                                            {(currentUserRole === 'super_admin' || currentUserRole === 'superadmin') && (
                                                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
                                                    <div
                                                        onClick={userSupplies.length > 5 ? () => setSuppliesActionsOpen(o => !o) : undefined}
                                                        className={cn(
                                                            "w-full flex items-center justify-between mb-3 group/toggle",
                                                            userSupplies.length > 5 && "cursor-pointer"
                                                        )}
                                                        title={userSupplies.length > 5 ? (suppliesActionsOpen ? 'Comprimi' : 'Espandi') : undefined}
                                                    >
                                                        <span className="flex items-center gap-2">
                                                            <span className="text-[10px] font-medium tracking-[0.12em] uppercase text-slate-400">Forniture</span>
                                                            <span className="bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md font-mono text-[11px] font-bold">{userSupplies.length}</span>
                                                        </span>
                                                        {userSupplies.length > 5 && (
                                                            <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-400 group-hover/toggle:bg-slate-200 dark:group-hover/toggle:bg-white/20 transition-all shrink-0">
                                                                <ChevronDown size={14} className={cn("transition-transform duration-200", suppliesActionsOpen && "rotate-180")} />
                                                            </span>
                                                        )}
                                                    </div>
                                                    {(userSupplies.length <= 5 || suppliesActionsOpen) && (
                                                    <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
                                                        {userSupplies.map(s => (
                                                            <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 group/s shrink-0">
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-200">{s.ulm || s.cif.slice(-6)}</span>
                                                                    <span className="text-[9px] text-slate-400 truncate">{s.address}</span>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleDeleteSupply(s.cif)}
                                                                    className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-rose-500 hover:text-white transition-all shrink-0"
                                                                    title="Elimina fornitura"
                                                                >
                                                                    <Trash2 size={13} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })()}
                            </div>
                        )}



                        {scopedBills.length > 0 && (
                            <div className="bg-white dark:bg-[#1A1D23] rounded-xl border border-slate-200/70 dark:border-white/5 p-4">
                                <MiniSpendChart bills={scopedBills} />
                            </div>
                        )}
                    </aside>
                </div>
            </div>
        </>
    )
}
