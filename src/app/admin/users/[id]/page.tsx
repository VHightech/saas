'use client'

import { use, useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Download, ShieldAlert, TrendingUp, TrendingDown, CheckCircle, Smartphone, Mail, MapPin, Calendar, FileText, Search, AlertCircle, Clock, Save, Edit2, Key, ChevronLeft, ChevronRight, Zap, Ghost, Droplets, Eye, Trash2, Inbox, User } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { deleteUser, updateUser } from '../actions'
import { ExpensesTrendChart } from '@/components/dashboard/widgets/ExpensesTrendChart'

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
    legacy_id: number | null
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
}

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const [invoiceSearch, setInvoiceSearch] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)
    const [loading, setLoading] = useState(true)

    // Data State
    const [profile, setProfile] = useState<Profile | null>(null)
    const [bills, setBills] = useState<Bill[]>([])

    const supabase = createClient()

    useEffect(() => {
        fetchData()
    }, [id])

    async function fetchData() {
        setLoading(true)

        // 1. Fetch Profile
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', id)
            .single()

        if (profileError) {
            console.error('Error fetching profile:', profileError)
            setLoading(false)
            return
        }

        setProfile(profileData)

        // 2. Fetch Bills
        const { data: billsData, error: billsError } = await supabase
            .from('bills')
            .select('*')
            .eq('user_id', id)
            .order('data_emissione', { ascending: false })

        if (billsError) {
            console.error('Error fetching bills:', billsError)
        } else {
            setBills(billsData || [])
        }

        setLoading(false)
    }

    // Edit Mode State (Visual only for now)
    const [isEditing, setIsEditing] = useState(false)
    const [userData, setUserData] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        fiscalCode: '',
        cif: ''
    })

    // Sync state for edit mode form
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
        // Validation
        if (!userData.name.trim()) {
            toast.error("Il campo Anagrafica è obbligatorio.")
            return
        }

        if (userData.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            if (!emailRegex.test(userData.email)) {
                toast.error("L'indirizzo email inserito non è valido.")
                return
            }
        }

        toast.promise(
            updateUser(id, {
                name: userData.name,
                email: userData.email,
                phone: userData.phone,
                address: userData.address,
                city: userData.city,
                cfpi: userData.fiscalCode,
                cif: userData.cif
            }),
            {
                loading: 'Salvataggio in corso...',
                success: (res) => {
                    if (res.error) throw new Error(res.error)
                    setIsEditing(false)
                    fetchData()
                    return 'Modifiche salvate con successo'
                },
                error: (err) => `Errore: ${err.message}`
            }
        )
    }

    const handleResetPwd = () => {
        const email = isEditing ? userData.email : profile?.email
        if (!email) {
            toast.error("Nessuna email presente per inviare il reset.")
            return
        }

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

    const handleDelete = () => {
        toast("Eliminare definitivamente l'utente?", {
            description: "Questa azione è irreversibile.",
            action: {
                label: 'Elimina',
                onClick: async () => {
                    const res = await deleteUser(id)
                    if (res.error) toast.error(res.error)
                    else {
                        toast.success("Utente eliminato")
                        router.push('/admin/users')
                    }
                }
            }
        })
    }

    const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setItemsPerPage(Number(e.target.value))
        setCurrentPage(1)
    }

    // ANALYTICS CALCULATION
    const analytics = useMemo(() => {
        if (!profile || !bills) return null

        const totalInvoices = bills.length

        // Logic: specific status column doesn't exist.
        // We assume unpaid unless we add a payments table later.
        // Overdue logic: scadenza < today
        const today = new Date()

        const overdueInvoices = bills.filter(i => {
            if (!i.scadenza) return false
            return new Date(i.scadenza) < today
        }).length

        // For now, assume nothing is explicitly "paid" in the DB, so Paid = Total - Unpaid is tricky.
        // Let's just say Paid = 0 for this migration view until we import payments.
        const paidInvoices = 0

        const unpaidAmount = bills.reduce((sum, i) => sum + (Number(i.importo) || 0), 0)

        // Score Calculation (Mock Logic adapted)
        let score = 'A'
        let scoreColor = 'text-emerald-700 bg-emerald-100 border-emerald-200'

        if (overdueInvoices > 0) {
            score = 'C'
            scoreColor = 'text-amber-700 bg-amber-100 border-amber-200'
        }
        if (overdueInvoices > 5) {
            score = 'D'
            scoreColor = 'text-red-700 bg-red-100 border-red-200'
        }

        const hasAnomaly = overdueInvoices > 2

        // Deterministic Trend (Random visual for now)
        const trend = 'up'
        const trendValue = 12

        return { totalInvoices, paidInvoices, overdueInvoices, unpaidAmount, score, scoreColor, hasAnomaly, trend, trendValue }
    }, [profile, bills])


    // FILTER & PAGINATION FOR BILLS
    const filteredInvoices = useMemo(() => {
        if (!bills) return []
        return bills.filter(inv =>
            (inv.nome_pdf && inv.nome_pdf.toLowerCase().includes(invoiceSearch.toLowerCase())) ||
            (inv.importo && inv.importo.toString().includes(invoiceSearch))
        )
    }, [bills, invoiceSearch])

    const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage)
    const currentInvoices = filteredInvoices.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    )

    if (loading) return <div className="p-10 text-center font-bold text-slate-400">Caricamento profilo...</div>
    if (!profile) return <div className="p-10 text-center text-red-500 font-bold">Utente non trovato</div>
    if (!analytics) return null

    const isShadow = profile.legacy_id && profile.legacy_id < 0

    return (
        <div className="flex flex-col h-full overflow-hidden gap-6">

            {/* --- HEADER --- */}
            <div className="bg-white/70 dark:bg-[#1e1e1e] backdrop-blur-2xl rounded-2xl p-6 border border-slate-200 dark:border-[#333333] flex-shrink-0 animate-in fade-in slide-in-from-top-4 duration-500 shadow-sm">
                <div className="flex flex-col md:flex-row gap-6 justify-between items-start">

                    {/* Left: Name & Back */}
                    <div className="flex gap-4 min-w-[300px]">
                        <button
                            onClick={() => router.back()}
                            className="h-10 w-10 flex-shrink-0 rounded-xl transition-all shadow-sm cursor-pointer btn-glass btn-glass-neutral relative group/back"
                        >
                            <ArrowLeft size={18} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-300 group-hover:scale-110 transition-transform" />
                        </button>
                        <div>
                            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">
                                Anagrafica Cliente
                            </p>
                            <div className="flex items-center gap-2 w-full">
                                {isEditing ? (
                                    <div className="flex gap-2 w-full">
                                        <input
                                            className="bg-white/50 dark:bg-black/20 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 font-bold text-lg w-full outline-none focus:border-sky-500"
                                            value={userData.name}
                                            onChange={e => setUserData({ ...userData, name: e.target.value })}
                                            placeholder="Nome / Ragione Sociale"
                                        />
                                    </div>
                                ) : (
                                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                                        {profile.name || "Utente non registrato"}
                                    </h1>
                                )}
                                {isShadow && (
                                    <span className="btn-glass btn-glass-neutral !p-0.5 !px-1.5 rounded text-[10px] text-slate-600 dark:text-slate-300 font-black uppercase tracking-wider flex items-center gap-1">
                                        <Ghost size={12} /> Shadow
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                {profile.codice_cliente && (
                                    <span className="font-mono bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 px-2 py-0.5 rounded text-sm font-bold shadow-sm backdrop-blur-md">
                                        {profile.codice_cliente}
                                    </span>
                                )}
                                {profile.cif && (
                                    <span className="font-mono bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded text-sm font-bold shadow-sm backdrop-blur-md flex items-center gap-1">
                                        <span className="opacity-50 text-[10px]">CIF:</span> {profile.cif}
                                    </span>
                                )}
                            </div>


                        </div>
                    </div>


                    {/* Center: Contact Grid */}
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 w-full">
                        {/* Email */}
                        <div className="bg-slate-50/80 dark:bg-[#2a2a2a] p-3 rounded-xl border border-slate-200/60 dark:border-[#333333] hover:border-sky-300 dark:hover:border-sky-700 transition-colors group">
                            <div className="flex items-center gap-2 mb-1">
                                <Mail size={14} className="text-sky-500 group-hover:scale-110 transition-transform" />
                                <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-400">Email</span>
                            </div>
                            {isEditing ? (
                                <input
                                    className="bg-white/50 dark:bg-black/20 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 w-full text-sm font-bold text-slate-700 dark:text-slate-100 outline-none focus:border-sky-500"
                                    value={userData.email}
                                    onChange={e => setUserData({ ...userData, email: e.target.value })}
                                />
                            ) : (
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-100 truncate" title={profile.email || '-'}>
                                    {profile.email || '-'}
                                </p>
                            )}
                        </div>
                        {/* Phone */}
                        <div className="bg-slate-50/80 dark:bg-[#2a2a2a] p-3 rounded-xl border border-slate-200/60 dark:border-[#333333] hover:border-sky-300 dark:hover:border-sky-700 transition-colors group">
                            <div className="flex items-center gap-2 mb-1">
                                <Smartphone size={14} className="text-sky-500 group-hover:scale-110 transition-transform" />
                                <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-400">Telefono</span>
                            </div>
                            {isEditing ? (
                                <input
                                    className="bg-white/50 dark:bg-black/20 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 w-full text-sm font-bold text-slate-700 dark:text-slate-100 outline-none focus:border-sky-500"
                                    value={userData.phone}
                                    onChange={e => setUserData({ ...userData, phone: e.target.value })}
                                    placeholder="-"
                                />
                            ) : (
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-100">{profile.phone || '-'}</p>
                            )}
                        </div>


                        {/* Fiscal Code */}
                        <div className="bg-slate-50/80 dark:bg-[#2a2a2a] p-3 rounded-xl border border-slate-200/60 dark:border-[#333333] hover:border-sky-300 dark:hover:border-sky-700 transition-colors group">
                            <div className="flex items-center gap-2 mb-1">
                                <FileText size={14} className="text-sky-500 group-hover:scale-110 transition-transform" />
                                <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-400">Codice Fiscale / P.IVA</span>
                            </div>
                            {isEditing ? (
                                <input
                                    className="bg-white/50 dark:bg-black/20 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 w-full text-sm font-bold text-slate-700 dark:text-slate-100 outline-none focus:border-sky-500"
                                    value={userData.fiscalCode}
                                    onChange={e => setUserData({ ...userData, fiscalCode: e.target.value })}
                                />
                            ) : (
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-100">{userData.fiscalCode || '-'}</p>
                            )}
                        </div>
                        {/* Address */}
                        <div className="bg-slate-50/80 dark:bg-[#2a2a2a] p-3 rounded-xl border border-slate-200/60 dark:border-[#333333] hover:border-sky-300 dark:hover:border-sky-700 transition-colors group">
                            <div className="flex items-center gap-2 mb-1">
                                <MapPin size={14} className="text-sky-500 group-hover:scale-110 transition-transform" />
                                <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-400">Indirizzo Fornitura</span>
                            </div>
                            {isEditing ? (
                                <div className="flex flex-col gap-2">
                                    <input
                                        className="bg-white/50 dark:bg-black/20 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 w-full text-sm font-bold text-slate-700 dark:text-slate-100 outline-none focus:border-sky-500"
                                        value={userData.address}
                                        onChange={e => setUserData({ ...userData, address: e.target.value })}
                                        placeholder="Via/Piazza"
                                    />
                                    <input
                                        className="bg-white/50 dark:bg-black/20 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 w-full text-sm font-bold text-slate-700 dark:text-slate-100 outline-none focus:border-sky-500"
                                        value={userData.city}
                                        onChange={e => setUserData({ ...userData, city: e.target.value })}
                                        placeholder="Città"
                                    />
                                </div>
                            ) : (
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-100 truncate">{[userData.address, userData.city].filter(Boolean).join(', ') || '-'}</p>
                            )}
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-col gap-2 min-w-[140px]">
                        {isEditing ? (
                            <button
                                onClick={handleSave}
                                className="w-full py-2 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 shadow-sm text-sm cursor-pointer btn-glass btn-glass-emerald"
                            >
                                <Save size={16} /> Salva
                            </button>
                        ) : (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="w-full py-2 rounded-xl font-bold transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 text-sm cursor-pointer btn-glass btn-glass-amber"
                            >
                                <Edit2 size={16} /> Modifica
                            </button>
                        )}
                        <button
                            onClick={handleResetPwd}
                            className="w-full py-2 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 text-sm shadow-sm cursor-pointer bg-violet-50 text-violet-600 border border-violet-200 hover:bg-violet-100 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800"
                        >
                            <Key size={16} /> Reset Pwd
                        </button>

                        {isEditing && (
                            <button
                                onClick={handleDelete}
                                className="w-full py-2 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 text-sm shadow-sm cursor-pointer btn-glass btn-glass-red animate-in fade-in slide-in-from-top-2"
                            >
                                <Trash2 size={16} /> Elimina Utenza
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* --- BODY --- */}
            {bills.length === 0 ? (
                <div className="flex-1 min-h-0 flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="w-24 h-24 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                        <Inbox size={48} className="text-slate-300 dark:text-slate-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Nessuna fattura trovata</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Non ci sono documenti contabili collegati a questa utenza.</p>
                </div>
            ) : (
                <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100 p-1">

                    {/* LEFT COL: Analytics */}
                    <div className="lg:col-span-1 space-y-4 overflow-y-auto custom-scrollbar pr-2">

                        {/* Anomaly */}
                        {analytics.hasAnomaly && (
                            <div className="bg-red-50/90 backdrop-blur-xl rounded-2xl p-5 border border-red-200 flex items-center gap-4 animate-pulse">
                                <div className="p-3 bg-red-100 text-red-600 rounded-xl">
                                    <ShieldAlert size={24} />
                                </div>
                                <div>
                                    <h3 className="text-red-900 font-black text-xs uppercase tracking-wide">Attenzione</h3>
                                    <p className="text-red-700 text-[10px] font-semibold leading-tight mt-0.5">{analytics.overdueInvoices} fatture scadute.</p>
                                </div>
                            </div>
                        )}

                        {/* Reliability - DISABLED (No Data) */}
                        {/*
                    <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/60 shadow-sm flex items-center justify-between relative overflow-hidden">
                        <div className="relative z-10">
                            <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest mb-1">Rating Pagamenti</p>
                            <h3 className="text-xl font-bold text-slate-700">Affidabilità</h3>
                        </div>
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-bold border-4 ${analytics.scoreColor} relative z-10 shadow-inner`}>
                            {analytics.score}
                        </div>
                    </div>
                    */}

                        {/* Summary */}

                        <div className="h-[250px] w-full mb-4">
                            <ExpensesTrendChart bills={bills} className="!p-4 !rounded-2xl !bg-white/30 dark:!bg-[#1e1e1e] !border-white/50 dark:!border-[#333333]" />
                        </div>

                        <div className="bg-white/30 dark:bg-[#1e1e1e] backdrop-blur-2xl rounded-2xl p-6 border border-white/50 dark:border-[#333333]">
                            <h3 className="font-bold text-slate-800 dark:text-white mb-5 text-xs uppercase tracking-widest flex items-center gap-2">
                                <FileText size={14} className="text-sky-500 dark:text-white" />
                                Riepilogo Contabile
                            </h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-xs p-3 bg-slate-100 dark:bg-[#2a2a2a] rounded-lg border border-slate-200 dark:border-transparent">
                                    <span className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">Totale Fatture</span>
                                    <span className="font-bold text-slate-800 dark:text-white text-sm">{analytics.totalInvoices}</span>
                                </div>
                                {/* Disabled Overdue Summary 
                            <div className="flex justify-between items-center text-xs p-3 bg-red-50/50 rounded-lg">
                                <span className="text-red-700 font-bold">Scadute</span>
                                <span className="font-bold text-red-600">{analytics.overdueInvoices}</span>
                            </div>
                            */}
                                <div className="pt-4 mt-2 border-t border-slate-100 dark:border-[#333333] flex justify-between items-center">
                                    <span className="text-slate-900 dark:text-white font-bold text-sm uppercase">Totale Emesso</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xl tracking-tight">€ {analytics.unpaidAmount.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COL: Invoice Table */}
                    <div className="lg:col-span-3 h-fit flex flex-col bg-white/70 dark:bg-[#1e1e1e] backdrop-blur-2xl rounded-2xl border border-slate-200 dark:border-[#333333] overflow-hidden shadow-sm">

                        {/* Header */}
                        <div className="p-5 border-b border-slate-100 dark:border-[#333333] flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-100 dark:bg-white/5 text-sky-500 dark:text-sky-400 rounded-lg border border-slate-200 dark:border-white/10">
                                    <FileText size={18} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">Archivio Fatture</h2>
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wide">Storico importato</p>
                                </div>
                            </div>
                            <div className="relative w-64 group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-500 transition-colors" size={16} />
                                <input
                                    type="text"
                                    placeholder="Cerca importo o nome..."
                                    value={invoiceSearch}
                                    onChange={(e) => { setInvoiceSearch(e.target.value); setCurrentPage(1); }}
                                    className="w-full bg-white dark:bg-[#2a2a2a] border-2 border-slate-100 dark:border-[#333333] rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium focus:border-sky-500 focus:ring-4 ring-sky-500/10 outline-none transition-all dark:text-slate-100 dark:placeholder:text-slate-500"
                                />
                            </div>
                        </div>

                        {/* Table */}
                        <div className="flex-1 overflow-auto custom-scrollbar relative">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-10">
                                    <tr className="border-b border-slate-200 dark:border-[#333333] text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/95 dark:bg-[#1e1e1e] backdrop-blur-sm">
                                        <th className="p-3 pl-6">Documento (PDF)</th>
                                        <th className="p-3">Emissione</th>
                                        <th className="p-3">Scadenza</th>
                                        <th className="p-3">Consumo</th>
                                        <th className="p-3 text-right">Importo</th>
                                        <th className="p-3 pr-6 text-right">Azioni</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm divide-y divide-slate-100 dark:divide-[#333333]">
                                    {currentInvoices.map(inv => {
                                        const isOverdue = inv.scadenza && new Date(inv.scadenza) < new Date()

                                        return (
                                            <tr key={inv.id} className="hover:bg-sky-50 dark:hover:bg-sky-900/10 transition-all group border-l-4 border-l-transparent hover:border-l-sky-500 hover:shadow-md">
                                                <td className="p-3 pl-6 font-black text-slate-700 dark:text-slate-300 group-hover:text-sky-700 dark:group-hover:text-sky-400 transition-colors">
                                                    {inv.nome_pdf || 'N/A'}
                                                </td>
                                                <td className="p-3 text-slate-500 font-medium">
                                                    <div className="btn-glass btn-glass-sky inline-flex items-center gap-1.5 !p-1 !px-2 rounded-lg text-[10px] font-bold w-fit">
                                                        <Calendar size={11} className="opacity-70" />
                                                        {inv.data_emissione ? format(new Date(inv.data_emissione), 'dd/MM/yyyy') : '-'}
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    {isOverdue ? (
                                                        <span
                                                            title="Documento Scaduto"
                                                            className="btn-glass btn-glass-red inline-flex items-center gap-1.5 !p-1 !px-2 rounded-lg text-[10px] font-black uppercase tracking-wide cursor-help w-fit"
                                                        >
                                                            <AlertCircle size={10} strokeWidth={3} /> {inv.scadenza ? format(new Date(inv.scadenza), 'dd/MM/yyyy') : 'Scaduta'}
                                                        </span>
                                                    ) : (
                                                        <span
                                                            title="In Scadenza"
                                                            className="btn-glass btn-glass-amber inline-flex items-center gap-1.5 !p-1 !px-2 rounded-lg text-[10px] font-black uppercase tracking-wide cursor-help w-fit"
                                                        >
                                                            <Clock size={10} strokeWidth={3} /> {inv.scadenza ? format(new Date(inv.scadenza), 'dd/MM/yyyy') : 'Attesa'}
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="p-3">
                                                    <div className="flex items-center gap-1.5 font-black text-slate-700 dark:text-slate-300 text-xs bg-slate-100/50 dark:bg-white/5 px-2.5 py-1.5 rounded-lg border border-slate-200/50 dark:border-white/5 whitespace-nowrap w-fit">
                                                        {inv.tipo_servizio?.toLowerCase().includes('acqua') ? (
                                                            <Droplets size={14} className="text-sky-500 fill-sky-500" />
                                                        ) : (
                                                            <Zap size={14} className="text-amber-500 fill-amber-500" />
                                                        )}
                                                        {inv.consumo || 0} <span className="text-slate-400 text-[10px] font-bold uppercase">{inv.tipo_servizio?.toLowerCase().includes('acqua') ? 'mc' : 'kWh'}</span>
                                                    </div>
                                                </td>

                                                <td className="p-3 text-right font-bold text-slate-700 dark:text-slate-200">€ {Number(inv.importo || 0).toFixed(2)}</td>
                                                <td className="p-3 pr-6 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => inv.pdf_url ? window.open(inv.pdf_url, '_blank') : alert('PDF non disponibile')}
                                                            className={`p-2 rounded-xl transition-all shadow-sm btn-glass ${inv.pdf_url ? 'btn-glass-sky cursor-pointer' : 'btn-glass-neutral opacity-50 cursor-not-allowed'}`}
                                                            title={inv.pdf_url ? "Vedi PDF" : "PDF non presente"}
                                                        >
                                                            <Eye size={16} strokeWidth={2.5} />
                                                        </button>
                                                        <button
                                                            onClick={() => inv.pdf_url ? window.open(inv.pdf_url, '_blank') : alert('PDF non disponibile')}
                                                            className={`p-2 rounded-xl transition-all shadow-sm btn-glass ${inv.pdf_url ? 'btn-glass-emerald cursor-pointer' : 'btn-glass-neutral opacity-50 cursor-not-allowed'}`}
                                                            title={inv.pdf_url ? "Scarica PDF" : "PDF non presente"}
                                                        >
                                                            <Download size={16} strokeWidth={2.5} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="p-4 border-t border-slate-100 dark:border-[#333333] bg-white/60 dark:bg-[#1e1e1e] flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                            <div className="flex items-center gap-4 pl-4">
                                <span>
                                    Mostra
                                    <select
                                        value={itemsPerPage}
                                        onChange={handlePageSizeChange}
                                        className="mx-2 bg-white dark:bg-[#2a2a2a] border border-slate-200 dark:border-[#444444] rounded-lg px-2 py-1 outline-none focus:border-sky-500 focus:ring-2 ring-sky-500/10 cursor-pointer text-slate-700 dark:text-slate-200 font-bold"
                                    >
                                        <option value={8}>8</option>
                                        <option value={10}>10</option>
                                        <option value={20}>20</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                        <option value={1000}>Tutti</option>
                                    </select>
                                    fatture
                                </span>

                                {totalPages > 1 && (
                                    <span className="text-slate-400">|</span>
                                )}
                                {totalPages > 1 && (
                                    <span>
                                        Visualizzazione <span className="font-bold text-slate-900 dark:text-white">{currentPage}</span> di {totalPages}
                                    </span>
                                )}
                            </div>

                            {totalPages > 1 && (
                                <div className="flex gap-2">
                                    <button
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        className="p-2 rounded-xl bg-white dark:bg-[#2a2a2a] border border-slate-200 dark:border-[#444444] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#333333] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all hover:scale-105 active:scale-95"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <button
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        className="p-2 rounded-xl bg-white dark:bg-[#2a2a2a] border border-slate-200 dark:border-[#444444] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#333333] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all hover:scale-105 active:scale-95"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div >
    )
}
