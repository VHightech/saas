'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Search, Filter, Mail, Phone, CheckCircle, AlertCircle, Clock, ChevronLeft, ChevronRight, ChevronDown, User, Ghost, FileText, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface UserProfile {
    id: string
    fullName: string
    email: string
    cfpi: string // Renamed from phone
    clientCode: string
    isShadow: boolean
    invoices: any[]
    cif: string
    address: string
    city: string
}

export default function AdminUsersPage() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const tableContainerRef = useRef<HTMLDivElement>(null)

    // Initialize state from URL Params or defaults
    const initialPage = Number(searchParams.get('page')) || 1
    const initialLimit = Number(searchParams.get('limit')) || 10
    const initialSearch = searchParams.get('q') || ''

    const [searchTerm, setSearchTerm] = useState(initialSearch)
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(initialSearch) // Debounce
    const [currentPage, setCurrentPage] = useState(initialPage)
    const [itemsPerPage, setItemsPerPage] = useState(initialLimit)
    const [loading, setLoading] = useState(true)
    const [users, setUsers] = useState<UserProfile[]>([])
    const [totalResults, setTotalResults] = useState(0) // For server-side pagination

    const supabase = createClient()

    // Helper to update URL without reloading
    const updateUrl = useCallback((updates: { page?: number, limit?: number, q?: string }) => {
        const params = new URLSearchParams(searchParams.toString())

        if (updates.page !== undefined) params.set('page', updates.page.toString())
        if (updates.limit !== undefined) params.set('limit', updates.limit.toString())

        if (updates.q !== undefined) {
            if (updates.q) params.set('q', updates.q)
            else params.delete('q')
        }

        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }, [pathname, router, searchParams])


    // 1. Debounce Effect & URL Sync for Search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchTerm !== debouncedSearchTerm) {
                setDebouncedSearchTerm(searchTerm)
                setCurrentPage(1) // Reset page on search change
                updateUrl({ q: searchTerm, page: 1 })
            }
        }, 500)
        return () => clearTimeout(timer)
    }, [searchTerm, debouncedSearchTerm, updateUrl])

    // Update URL when page/limit changes (triggered by UI)
    const handlePageChange = (newPage: number) => {
        setCurrentPage(newPage)
        updateUrl({ page: newPage })
    }

    const handleLimitChange = (newLimit: number) => {
        setItemsPerPage(newLimit)
        setCurrentPage(1)
        updateUrl({ limit: newLimit, page: 1 })
    }

    // 2. Fetch Users Effect
    useEffect(() => {
        fetchUsers()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearchTerm, currentPage, itemsPerPage])

    async function fetchUsers() {
        setLoading(true)

        try {
            let query = supabase
                .from('profiles')
                .select('*', { count: 'exact' })

            // Search Filter
            if (debouncedSearchTerm) {
                // Using .or() with ilike for multiple fields
                const term = `%${debouncedSearchTerm}%`
                // Fix: Do not quote the term inside the filter string for Supabase .or()
                // Removed surname as it was deleted from DB
                query = query.or(`name.ilike.${term},email.ilike.${term},cif.ilike.${term},codice_cliente.ilike.${term},cfpi.ilike.${term}`)
            }

            // Pagination
            const from = (currentPage - 1) * itemsPerPage
            const to = from + itemsPerPage - 1

            const { data, count, error } = await query
                .order('created_at', { ascending: false }) // Show newest first? Or legacy? Let's use created_at or legacy_id
                .range(from, to)

            if (error) throw error

            if (data) {
                const adapted = data.map((p: any) => {
                    const displayName = p.name || "Utente non registrato"

                    return {
                        id: p.id,
                        fullName: displayName,
                        email: p.email || '',
                        cfpi: p.cfpi || '',
                        address: p.address || '',
                        city: p.city || '',
                        clientCode: p.codice_cliente || '',
                        isShadow: p.is_shadow || (p.legacy_id && p.legacy_id < 0) || !p.email || !p.name,
                        invoices: [],
                        cif: p.cif || ''
                    }
                })
                setUsers(adapted)
                setTotalResults(count || 0)
            }
        } catch (error: any) {
            console.error('Error fetching users:', error.message || error, JSON.stringify(error))
        } finally {
            setLoading(false)
        }
    }

    // 3. Restore Scroll Position
    useEffect(() => {
        if (!loading && tableContainerRef.current) {
            const savedScroll = sessionStorage.getItem('usersListScroll')
            if (savedScroll) {
                // Small timeout to ensure DOM render
                setTimeout(() => {
                    if (tableContainerRef.current) {
                        tableContainerRef.current.scrollTop = parseInt(savedScroll)
                    }
                }, 50)
            }
        }
    }, [loading])

    const handleRowClick = (userId: string) => {
        // Save scroll position before navigating
        if (tableContainerRef.current) {
            sessionStorage.setItem('usersListScroll', tableContainerRef.current.scrollTop.toString())
        }
        router.push(`/admin/users/${userId}`)
    }

    // Pagination Calculation
    const totalPages = Math.ceil(totalResults / itemsPerPage)

    const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const size = Number(e.target.value)
        handleLimitChange(size)
    }

    const copyToClipboard = (text: string, e: React.MouseEvent) => {
        e.stopPropagation()
        navigator.clipboard.writeText(text)
        // could add toast here
    }

    return (
        <div className="h-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out max-w-[1600px] mx-auto w-full">

            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/70 dark:bg-[#1e1e1e] backdrop-blur-2xl p-6 rounded-2xl border border-slate-200 dark:border-[#333333] flex-shrink-0 shadow-sm">
                <div>
                    <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Ricerca Utenti</h1>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative group w-full md:w-96">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-400 group-focus-within:bg-sky-500 group-focus-within:text-white transition-all duration-300">
                            <Search size={14} strokeWidth={2.5} />
                        </div>
                        <input
                            type="text"
                            placeholder="Cerca utente per nome, email o CF..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white dark:bg-[#2a2a2a] border border-slate-200 dark:border-[#333333] rounded-full py-2.5 pl-12 pr-4 text-xs font-bold focus:border-sky-500 dark:focus:border-sky-500 focus:ring-4 ring-sky-500/10 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-stone-500 dark:text-slate-100 shadow-sm hover:shadow-md hover:border-sky-200 dark:hover:border-sky-800"
                        />
                    </div>
                </div>
            </div>

            {/* TABLE CARD */}
            <div ref={tableContainerRef} className="flex-1 bg-white/70 dark:bg-[#1e1e1e] backdrop-blur-2xl rounded-2xl border border-slate-200 dark:border-[#333333] flex flex-col min-h-0 overflow-hidden shadow-sm">
                <div className="flex-1 overflow-auto custom-scrollbar relative">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10">
                            <tr className="border-b border-slate-100 dark:border-[#333333] bg-slate-50/95 dark:bg-[#1e1e1e] backdrop-blur-md">
                                <th className="p-3 pl-6 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Utente</th>
                                <th className="p-3 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Dati Fatturazione</th>
                                <th className="p-3 pr-6 text-right text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Stato</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-[#333333]">
                            {loading ? (
                                <tr>
                                    <td colSpan={3} className="p-10 text-center text-slate-400 font-medium">
                                        <div className="flex justify-center items-center gap-2">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-400"></div>
                                            Ricerca in corso...
                                        </div>
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="p-10 text-center text-slate-400 font-medium h-40">
                                        Nessun utente trovato.
                                    </td>
                                </tr>
                            ) : users.map((user) => (
                                <tr
                                    key={user.id}
                                    onClick={() => handleRowClick(user.id)}
                                    className="hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-all group border-l-4 border-l-transparent hover:border-l-sky-500 hover:shadow-md cursor-pointer"
                                >
                                    {/* Avatar & Name */}
                                    <td className="p-3 pl-6">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-sm group-hover:scale-110 transition-transform ${user.isShadow ? 'bg-slate-400' : 'bg-gradient-to-br from-sky-400 to-sky-600'}`}>
                                                {user.isShadow ? <Ghost size={18} /> : (user.fullName.substring(0, 2).toUpperCase())}
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm text-slate-800 dark:text-slate-100 group-hover:text-sky-700 dark:group-hover:text-sky-400 transition-colors flex items-center gap-2">
                                                    {user.fullName}
                                                </div>
                                                <div className="flex flex-col gap-1 mt-1">
                                                    {user.clientCode && (
                                                        <span className="bg-slate-100 dark:bg-[#2a2a2a] px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-[#444444] text-[10px] font-bold w-fit">
                                                            {user.clientCode}
                                                        </span>
                                                    )}
                                                    {(user.address || user.city) && (
                                                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                                            <MapPin size={12} className="text-slate-400" />
                                                            <span className="truncate max-w-[250px]">{[user.address, user.city].filter(Boolean).join(', ')}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Contact & Fiscal */}
                                    <td className="p-3">
                                        <div className="space-y-1">
                                            <div className="flex flex-col gap-1 mt-1">
                                                {user.cif && (
                                                    <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase w-8">CIF</span>
                                                        <span className="font-mono bg-slate-50 dark:bg-slate-800 px-1.5 rounded select-all">{user.cif}</span>
                                                    </div>
                                                )}
                                                {user.cfpi && (
                                                    <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase w-8">CFPI</span>
                                                        <span className="font-mono bg-slate-50 dark:bg-slate-800 px-1.5 rounded select-all">{user.cfpi}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>

                                    {/* Status Badge */}
                                    <td className="p-3 pr-6 text-right">
                                        <div className="flex justify-end">
                                            {user.isShadow ? (
                                                <span className="btn-glass btn-glass-amber inline-flex items-center gap-1.5 !p-1 !px-2 rounded-lg text-[10px] font-black uppercase tracking-wide w-fit">
                                                    <Clock size={12} strokeWidth={3} /> Non registrato
                                                </span>
                                            ) : (
                                                <span className="btn-glass btn-glass-emerald inline-flex items-center gap-1.5 !p-1 !px-2 rounded-lg text-[10px] font-black uppercase tracking-wide w-fit">
                                                    <CheckCircle size={12} strokeWidth={3} /> Attivo
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* PAGINATION FOOTER */}
                <div className="p-4 border-t border-slate-100 dark:border-[#333333] bg-white/60 dark:bg-[#1e1e1e] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium flex-shrink-0">
                    <div className="flex items-center gap-4 pl-4">
                        <span>
                            Mostra
                            <select
                                value={itemsPerPage}
                                onChange={handlePageSizeChange}
                                className="mx-2 bg-white dark:bg-[#2a2a2a] border border-slate-200 dark:border-[#444444] rounded-lg px-2 py-1 outline-none focus:border-sky-500 focus:ring-2 ring-sky-500/10 cursor-pointer text-slate-700 dark:text-slate-200 font-bold"
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                            record per pagina
                        </span>

                        <span className="text-slate-400 dark:text-slate-600">|</span>

                        <span>
                            Totale: <span className="font-bold text-slate-900 dark:text-white">{totalResults}</span> utenti
                        </span>

                        {totalPages > 1 && (
                            <>
                                <span className="text-slate-400 dark:text-slate-600">|</span>
                                <span>
                                    Pagina <span className="font-bold text-slate-900 dark:text-white">{currentPage}</span> di {totalPages}
                                </span>
                            </>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="flex gap-2 pr-4">
                        <button
                            disabled={currentPage === 1 || loading}
                            onClick={() => handlePageChange(currentPage - 1)}
                            className="p-2 rounded-xl bg-white dark:bg-[#2a2a2a] border border-slate-200 dark:border-[#444444] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#333333] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all hover:scale-105 active:scale-95"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            disabled={currentPage >= totalPages || loading}
                            onClick={() => handlePageChange(currentPage + 1)}
                            className="p-2 rounded-xl bg-white dark:bg-[#2a2a2a] border border-slate-200 dark:border-[#444444] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#333333] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all hover:scale-105 active:scale-95"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
