'use client'

import { use, useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Download, ShieldAlert, TrendingUp, TrendingDown, CheckCircle, Smartphone, Mail, MapPin, Calendar, FileText, AlertCircle, Clock, Save, Edit2, Key, ChevronLeft, ChevronRight, ChevronDown, Zap, Ghost, Droplets, Eye, Trash2, Inbox, User, X, Home } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { format, startOfDay, endOfDay } from 'date-fns'
import { deleteUser, updateUser } from '../actions'
import { ExpensesTrendChart } from '@/components/dashboard/widgets/ExpensesTrendChart'
import { SearchBar } from '@/components/ui/search-bar'
import { DatePicker } from '@/components/ui/date-picker'

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
}

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const [invoiceSearch, setInvoiceSearch] = useState('')
    const [fromDate, setFromDate] = useState<Date | null>(null)
    const [toDate, setToDate] = useState<Date | null>(null)
    const [currentPage, setCurrentPage] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(10)
    const [isSupplyDropdownOpen, setIsSupplyDropdownOpen] = useState(false)
    const [loading, setLoading] = useState(true)

    // Data State
    const [profile, setProfile] = useState<Profile | null>(null)
    const [userSupplies, setUserSupplies] = useState<UserSupply[]>([])
    const [selectedSupplyId, setSelectedSupplyId] = useState<string | null>(null)
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

        // 2. Fetch User Supplies
        const { data: suppliesData, error: suppliesError } = await supabase
            .from('user_supplies')
            .select('*')
            .eq('user_id', id)
            .order('created_at', { ascending: true })

        if (suppliesError) {
            console.error('Error fetching user_supplies')
        }

        if (suppliesData) {
            setUserSupplies(suppliesData)
        }

        // 3. Fetch Bills
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
        let filtered = bills

        // 1. Filter by Selected Supply
        if (selectedSupplyId) {
            const supply = userSupplies.find(s => s.id === selectedSupplyId)
            if (supply && supply.cif) {
                // Filter where bill.ulm is either exactly supply.cif OR supply.cif contains bill.ulm (often ULM is just the last 6 digits of CIF)
                const safeSupplyCif = supply.cif.trim().toLowerCase()
                filtered = filtered.filter(b => {
                    if (!b.ulm) return false
                    const safeBillUlm = b.ulm.trim().toLowerCase()
                    return safeSupplyCif === safeBillUlm || safeSupplyCif.includes(safeBillUlm) || safeBillUlm.includes(safeSupplyCif)
                })
            }
        }

        if (fromDate) {
            const start = startOfDay(fromDate).getTime()
            filtered = filtered.filter(inv => {
                if (!inv.data_emissione) return false
                return new Date(inv.data_emissione).getTime() >= start
            })
        }

        if (toDate) {
            const end = endOfDay(toDate).getTime()
            filtered = filtered.filter(inv => {
                if (!inv.data_emissione) return false
                return new Date(inv.data_emissione).getTime() <= end
            })
        }

        return filtered.filter(inv =>
            (inv.nome_pdf && inv.nome_pdf.toLowerCase().includes(invoiceSearch.toLowerCase())) ||
            (inv.importo && inv.importo.toString().includes(invoiceSearch))
        )
    }, [bills, invoiceSearch, fromDate, toDate, selectedSupplyId, userSupplies])

    const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage)
    const currentInvoices = filteredInvoices.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    )

    if (loading) return <div className="p-10 text-center font-bold text-slate-400">Caricamento profilo...</div>
    if (!profile) return <div className="p-10 text-center text-red-500 font-bold">Utente non trovato</div>
    if (!analytics) return null

    const isShadow = profile.is_shadow === true

    return (
        <div className="flex flex-col h-full overflow-hidden gap-6">

            {/* --- HEADER --- */}
            <div className="relative z-50 bg-white/70 dark:bg-[#1e1e1e] backdrop-blur-2xl rounded-2xl p-6 border border-slate-200 dark:border-[#333333] flex-shrink-0 animate-in fade-in slide-in-from-top-4 duration-500 shadow-sm">
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
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {profile.codice_cliente && (
                                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                                        <span className="font-mono bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 px-2 py-0.5 rounded text-sm font-bold shadow-sm backdrop-blur-md flex items-center shrink-0">
                                            <span className="opacity-50 text-[10px] mr-1.5 uppercase tracking-wider">Cod-Cliente:</span>
                                            {profile.codice_cliente}
                                        </span>
                                        {/* ULM DISPLAY */}
                                        {userSupplies && userSupplies.length > 0 && (
                                            <span className="font-mono bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded text-sm font-bold shadow-sm backdrop-blur-md flex items-center gap-1 animate-in fade-in slide-in-from-left-2 overflow-hidden shrink min-w-0 max-w-[300px]">
                                                <span className="opacity-50 text-[10px] uppercase tracking-wider mr-1 shrink-0">ULM:</span>
                                                <span className="truncate">
                                                    {selectedSupplyId
                                                        ? userSupplies.find(s => s.id === selectedSupplyId)?.cif?.slice(-6) || 'N/A'
                                                        : userSupplies.length <= 3
                                                            ? userSupplies.map(s => s.cif?.slice(-6)).filter(Boolean).join(' - ')
                                                            : `${userSupplies.slice(0, 3).map(s => s.cif?.slice(-6)).filter(Boolean).join(' - ')} +${userSupplies.length - 3}`
                                                    }
                                                </span>
                                            </span>
                                        )}
                                    </div>
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
                        <div className={`bg-slate-50/80 dark:bg-[#2a2a2a] p-3 rounded-xl border transition-colors group ${userSupplies && userSupplies.length > 1 && !isEditing
                            ? 'border-sky-200 dark:border-sky-900/30 bg-sky-50/30 dark:bg-sky-900/10'
                            : 'border-slate-200/60 dark:border-[#333333] hover:border-sky-300 dark:hover:border-sky-700'
                            }`}>
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <MapPin size={14} className="text-sky-500 group-hover:scale-110 transition-transform" />
                                    <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-400">Indirizzo Fornitura</span>
                                </div>
                                {userSupplies && userSupplies.length > 1 && !isEditing && (
                                    <span className="text-[9px] bg-sky-100 text-sky-700 px-1.5 rounded-full font-bold">
                                        {userSupplies.length} Utenze
                                    </span>
                                )}
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
                                <div className="relative">
                                    {userSupplies && userSupplies.length > 1 ? (
                                        // MULTIPLE SUPPLIES SELECTOR (CUSTOM DROPDOWN)
                                        <div className="relative">
                                            {/* TRIGGER */}
                                            <button
                                                onClick={() => setIsSupplyDropdownOpen(!isSupplyDropdownOpen)}
                                                onBlur={() => setTimeout(() => setIsSupplyDropdownOpen(false), 200)} // Delay to allow click on option
                                                className="w-full text-left flex items-center justify-between bg-transparent text-sm font-bold text-slate-700 dark:text-slate-100 outline-none cursor-pointer py-1 group/trigger"
                                            >
                                                <div className="truncate pr-2">
                                                    {!selectedSupplyId ? (
                                                        <span className="text-slate-500 font-normal">Tutte le Utenze (Riepilogo)</span>
                                                    ) : (
                                                        <span className="truncate">
                                                            {userSupplies.find(s => s.id === selectedSupplyId)?.address}
                                                            <span className="opacity-50 mx-1">-</span>
                                                            {userSupplies.find(s => s.id === selectedSupplyId)?.city}
                                                        </span>
                                                    )}
                                                </div>
                                                <ChevronDown size={14} className={`text-sky-500 transition-transform duration-200 ${isSupplyDropdownOpen ? 'rotate-180' : ''}`} />
                                            </button>

                                            {/* DROPDOWN MENU */}
                                            {isSupplyDropdownOpen && (
                                                <div className="absolute top-full left-0 w-[calc(100%+24px)] -ml-3 mt-2 bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#444444] rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                                                    {/* Option: ALL */}
                                                    <button
                                                        onClick={() => {
                                                            setSelectedSupplyId(null)
                                                            setIsSupplyDropdownOpen(false)
                                                        }}
                                                        className={`w-full text-left px-4 py-3 text-xs border-b border-slate-100 dark:border-[#333333] hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center gap-3 ${selectedSupplyId === null ? 'bg-sky-50/50 dark:bg-sky-900/10' : ''}`}
                                                    >
                                                        <div className={`p-1.5 rounded-lg ${selectedSupplyId === null ? 'bg-sky-100 text-sky-600' : 'bg-slate-100 text-slate-400 dark:bg-white/10'}`}>
                                                            <Zap size={14} />
                                                        </div>
                                                        <div>
                                                            <div className={`font-bold ${selectedSupplyId === null ? 'text-sky-700 dark:text-sky-400' : 'text-slate-700 dark:text-slate-200'}`}>Tutte le Utenze</div>
                                                            <div className="text-[10px] text-slate-400">Riepilogo globale</div>
                                                        </div>
                                                        {selectedSupplyId === null && <CheckCircle size={14} className="ml-auto text-sky-500" />}
                                                    </button>

                                                    {/* Option: List */}
                                                    <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                                        {userSupplies.map(supply => {
                                                            const ulm = supply.cif && supply.cif.length > 6 ? supply.cif.slice(-6) : supply.cif
                                                            const isSelected = selectedSupplyId === supply.id
                                                            return (
                                                                <button
                                                                    key={supply.id}
                                                                    onClick={() => {
                                                                        setSelectedSupplyId(supply.id)
                                                                        setIsSupplyDropdownOpen(false)
                                                                    }}
                                                                    className={`w-full text-left px-4 py-3 text-xs border-b last:border-0 border-slate-100 dark:border-[#333333] hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center gap-3 ${isSelected ? 'bg-sky-50/50 dark:bg-sky-900/10' : ''}`}
                                                                >
                                                                    <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-sky-100 text-sky-600' : 'bg-slate-100 text-slate-400 dark:bg-white/10'}`}>
                                                                        <Home size={14} />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <div className={`font-bold truncate max-w-[180px] ${isSelected ? 'text-sky-700 dark:text-sky-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                                                            {supply.address}
                                                                        </div>
                                                                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                                            {supply.city} • {ulm}
                                                                        </div>
                                                                    </div>
                                                                    {isSelected && <CheckCircle size={14} className="ml-auto text-sky-500 flex-shrink-0" />}
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Subtext for selected supply */}
                                            {selectedSupplyId && (() => {
                                                const s = userSupplies.find(x => x.id === selectedSupplyId)
                                                if (s) return <p className="text-[10px] text-slate-400 mt-0.5">{s.city} • {s.cif?.slice(-6)}</p>
                                            })()}
                                            {!selectedSupplyId && <p className="text-[10px] text-slate-400 mt-0.5">Visualizza tutto</p>}
                                        </div>
                                    ) : (
                                        // SINGLE SUPPLY DISPLAY
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-100 truncate">
                                            {userSupplies && userSupplies.length === 1
                                                ? [userSupplies[0].address, userSupplies[0].city].filter(Boolean).join(', ') || '-'
                                                : [userData.address, userData.city].filter(Boolean).join(', ') || '-'
                                            }
                                        </p>
                                    )}
                                </div>
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
            {/* Supply Selector REMOVED - Integrated into Header */}

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
                            <ExpensesTrendChart bills={bills.filter(b => Number(b.importo) > 0)} className="!p-4 !rounded-2xl !bg-white/30 dark:!bg-[#1e1e1e] !border-white/50 dark:!border-[#333333]" />
                        </div>

                        <div className="bg-white/30 dark:bg-[#1e1e1e] backdrop-blur-2xl rounded-2xl p-6 border border-white/50 dark:border-[#333333]">
                            <h3 className="font-bold text-slate-800 dark:text-white mb-5 text-xs uppercase tracking-widest flex items-center gap-2">
                                <FileText size={14} className="text-sky-500 dark:text-white" />
                                Riepilogo Contabile
                            </h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-xs p-3 bg-slate-100 dark:bg-[#2a2a2a] rounded-lg border border-slate-200 dark:border-transparent">
                                    <span className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">Fatture</span>
                                    <span className="font-bold text-slate-800 dark:text-white text-sm">{analytics.totalInvoices}</span>
                                </div>
                                {/* Disabled Overdue Summary 
                            <div className="flex justify-between items-center text-xs p-3 bg-red-50/50 rounded-lg">
                                <span className="text-red-700 font-bold">Scadute</span>
                                <span className="font-bold text-red-600">{analytics.overdueInvoices}</span>
                            </div>
                            */}
                                <div className="pt-4 mt-2 border-t border-slate-100 dark:border-[#333333] flex justify-between items-center">
                                    <span className="text-slate-900 dark:text-white font-bold text-sm uppercase">Totale</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xl tracking-tight">€ {analytics.unpaidAmount.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COL: Invoice Table */}
                    <div className="lg:col-span-3 h-full min-h-0 flex flex-col gap-4">

                        <div className="flex-1 min-h-0 flex flex-col bg-white/70 dark:bg-[#1e1e1e] backdrop-blur-2xl rounded-2xl border border-slate-200 dark:border-[#333333] overflow-hidden shadow-sm">

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
                                <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                                    <div className="flex items-center gap-2 w-full md:w-auto">
                                        <div className="w-full md:w-40">
                                            <DatePicker
                                                value={fromDate}
                                                onChange={(date) => {
                                                    setFromDate(date)
                                                    setCurrentPage(1)
                                                }}
                                                placeholder="Dal..."
                                            />
                                        </div>
                                        <div className="w-full md:w-40">
                                            <DatePicker
                                                value={toDate}
                                                onChange={(date) => {
                                                    setToDate(date)
                                                    setCurrentPage(1)
                                                }}
                                                placeholder="Al..."
                                            />
                                        </div>
                                        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${fromDate || toDate ? 'max-w-[100px] opacity-100 ml-2' : 'max-w-0 opacity-0 ml-0'}`}>
                                            <button
                                                onClick={() => {
                                                    setFromDate(null)
                                                    setToDate(null)
                                                    setCurrentPage(1)
                                                }}
                                                className="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 btn-glass btn-glass-red transition-all shadow-sm cursor-pointer whitespace-nowrap"
                                            >
                                                <X size={12} strokeWidth={3} /> Reset
                                            </button>
                                        </div>
                                    </div>
                                    <div className="w-full md:w-64">
                                        <SearchBar
                                            placeholder="Cerca..."
                                            value={invoiceSearch}
                                            onChange={(val) => { setInvoiceSearch(val); setCurrentPage(1); }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="flex-1 overflow-auto custom-scrollbar relative">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 z-10">
                                        <tr className="border-b border-slate-200 dark:border-[#333333] text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50/95 dark:bg-[#1e1e1e] backdrop-blur-sm">
                                            <th className="p-3 pl-6">Bolletta n°</th>
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
                                                        {inv.nome_pdf?.replace('.pdf', '') || 'N/A'}
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
                                                        ) : inv.scadenza ? (
                                                            <span
                                                                title="In Scadenza"
                                                                className="btn-glass btn-glass-amber inline-flex items-center gap-1.5 !p-1 !px-2 rounded-lg text-[10px] font-black uppercase tracking-wide cursor-help w-fit"
                                                            >
                                                                <Clock size={10} strokeWidth={3} /> {format(new Date(inv.scadenza), 'dd/MM/yyyy')}
                                                            </span>
                                                        ) : null}
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

                                                    <td className="p-3 text-right font-bold text-slate-700 dark:text-slate-200">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {(() => {
                                                                if (!inv.billing_type) return null;
                                                                const type = inv.billing_type.trim().toUpperCase();
                                                                const isSaldo = type.startsWith('S');
                                                                const isAcconto = type.startsWith('A');

                                                                if (!isSaldo && !isAcconto) {
                                                                    // Fallback for debugging: show raw chars or '?'
                                                                    return (
                                                                        <span className="text-[10px] uppercase bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 px-1 rounded" title={inv.billing_type}>
                                                                            RAW: "{inv.billing_type}"
                                                                        </span>
                                                                    );
                                                                }

                                                                return (
                                                                    <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black uppercase ${isSaldo
                                                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                                        : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                                                                        }`}>
                                                                        {isSaldo ? 'S' : 'A'}
                                                                    </span>
                                                                );
                                                            })()}
                                                            <span>€ {Number(inv.importo || 0).toFixed(2)}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 pr-6 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => inv.pdf_url ? window.open(`/api/bills/${inv.id}/pdf`, '_blank') : alert('PDF non disponibile')}
                                                                className={`p-2 rounded-xl transition-all shadow-sm btn-glass ${inv.pdf_url ? 'btn-glass-sky cursor-pointer' : 'btn-glass-neutral opacity-50 cursor-not-allowed'}`}
                                                                title={inv.pdf_url ? "Vedi PDF" : "PDF non presente"}
                                                            >
                                                                <Eye size={16} strokeWidth={2.5} />
                                                            </button>
                                                            <button
                                                                onClick={() => inv.pdf_url ? window.open(`/api/bills/${inv.id}/pdf`, '_blank') : alert('PDF non disponibile')}
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
                </div>
            )}
        </div >
    )
}
