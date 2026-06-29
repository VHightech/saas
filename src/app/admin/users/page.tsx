'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import {
    Ghost, Search, ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal, X,
    Printer, Download, Check, Pencil, Edit2,
    TrendingUp, Calendar, User, Mail, Hash, MapPin, Map, CreditCard, Activity, Droplets, AlertCircle, Trash2
} from 'lucide-react'
import { deleteUser, updateUser, updateUserSupply } from './actions'
import { createClient } from '@/lib/supabase/client'
import { AdminPageHero } from '@/components/admin/admin-page-hero'
import { CodeBadge } from '@/components/ui/CodeBadge'
import { Checkbox, SelectionAction, FilterChip, MultiBadge } from '@/components/admin/users/list-widgets'
import { getContractStatus } from '@/lib/contract-status'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface UserProfile {
    id: string
    fullName: string
    email: string
    codiceFiscale: string
    partitaIva: string
    pec: string
    clientCode: string
    isShadow: boolean
    unpaidAmount?: number
    billsCount?: number
    suppliesCount?: number
    supplies?: string[]
    userSupplies?: any[]
    address?: string
    city?: string
    cif?: string
}

function initialsOf(name: string) {
    const parts = (name || 'U').trim().split(/\s+/)
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'U'
}


export default function AdminUsersPage() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const tableRef = useRef<HTMLDivElement>(null)

    const initialPage = Number(searchParams.get('page')) || 1
    const initialLimit = Number(searchParams.get('limit')) || 25
    const initialSearch = searchParams.get('q') || ''

    const [searchTerm, setSearchTerm] = useState(initialSearch)
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(initialSearch)
    const [currentPage, setCurrentPage] = useState(initialPage)
    const [itemsPerPage, setItemsPerPage] = useState(initialLimit)
    const [loading, setLoading] = useState(true)
    const [users, setUsers] = useState<UserProfile[]>([])
    const [totalResults, setTotalResults] = useState(0)
    const [shadowCount, setShadowCount] = useState(0)
    const [activeCount, setActiveCount] = useState(0)
    const [unpaidTotal] = useState(0)
    const [unpaidUsersCount] = useState(0)
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
    const [activeUserId, setActiveUserId] = useState<string | null>(null)
    const [editingUserId, setEditingUserId] = useState<string | null>(null)
    const [rowDrafts, setRowDrafts] = useState<Partial<UserProfile>>({})
    const [activeBills, setActiveBills] = useState<any[]>([])
    const [activeBillsLoading, setActiveBillsLoading] = useState(false)
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'shadow'>('all')
    const [contractStatusFilter, setContractStatusFilter] = useState<string>('all')
    const [sortBy, setSortBy] = useState<'created_at' | 'name' | 'user_supplies_count' | 'bills_count'>('created_at')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const handleDeleteUser = async (u: UserProfile) => {
        if (!window.confirm(`Sei sicuro di voler eliminare definitivamente l'utente ${u.fullName}?`)) return
        toast.promise(deleteUser(u.id), {
            loading: 'Eliminazione in corso...',
            success: (res) => {
                if (res.error) throw new Error(res.error)
                fetchUsers()
                return 'Utente eliminato'
            },
            error: (err) => `Errore: ${err.message}`
        })
    }
    const toggleSelectAll = () => {
        setSelected(prev => prev.size === users.length ? new Set() : new Set(users.map(u => u.id)))
    }
    const clearSelection = () => setSelected(new Set())
    type SortKey = 'created_at' | 'name' | 'user_supplies_count' | 'bills_count'
    const toggleSort = (key: SortKey) => {
        if (sortBy === key) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
        } else {
            setSortBy(key)
            setSortOrder('desc')
        }
        setCurrentPage(1)
    }

    const allSelected = users.length > 0 && selected.size === users.length

    const supabase = createClient()

    const updateUrl = useCallback((updates: { page?: number; limit?: number; q?: string }) => {
        const params = new URLSearchParams(searchParams.toString())
        if (updates.page !== undefined) params.set('page', updates.page.toString())
        if (updates.limit !== undefined) params.set('limit', updates.limit.toString())
        if (updates.q !== undefined) {
            if (updates.q) params.set('q', updates.q)
            else params.delete('q')
        }
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }, [pathname, router, searchParams])

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchTerm !== debouncedSearchTerm) {
                setDebouncedSearchTerm(searchTerm)
                setCurrentPage(1)
                updateUrl({ q: searchTerm, page: 1 })
            }
        }, 400)
        return () => clearTimeout(timer)
    }, [searchTerm, debouncedSearchTerm, updateUrl])

    const handlePageChange = (newPage: number) => {
        setCurrentPage(newPage)
        updateUrl({ page: newPage })
    }

    const handleLimitChange = (newLimit: number) => {
        setItemsPerPage(newLimit)
        setCurrentPage(1)
        updateUrl({ limit: newLimit, page: 1 })
    }

    useEffect(() => {
        fetchUsers()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearchTerm, currentPage, itemsPerPage, statusFilter, contractStatusFilter, sortBy, sortOrder])

    async function fetchUsers() {
        setLoading(true)
        try {
            // Single source of truth: search_users RPC. Works with empty search term
            // and supports server-side sort by bills_count / user_supplies_count.
            const { data, error } = await supabase.rpc('search_users', {
                search_term: debouncedSearchTerm ?? '',
                _limit: itemsPerPage,
                _offset: (currentPage - 1) * itemsPerPage,
                _status_filter: contractStatusFilter,
                _shadow_filter: statusFilter,           // 'all' | 'active' | 'shadow'
                _sort_by: sortBy,                        // created_at | name | bills_count | user_supplies_count
                _sort_order: sortOrder                   // asc | desc
            })

            if (error) {
                if (error.message?.includes('stato_contratto')) {
                    toast.error('Errore Database: La colonna "stato_contratto" non esiste. Esegui le migrazioni SQL.', { id: 'db-error' })
                } else {
                    console.error('Fetch error:', error)
                    toast.error(`Errore caricamento utenti: ${error.message}`, { id: 'db-error' })
                }
                throw error
            }

            if (data) {
                setUsers((data as any[]).map(adapt))
                const total = data[0]?.total_count ?? 0
                setTotalResults(total)

                if (contractStatusFilter !== 'all' && total === 0) {
                    toast.warning(`Nessun utente trovato con stato "${getContractStatus(contractStatusFilter).label}". Verifica i dati importati.`, { id: 'filter-empty' })
                }
            }

            // Fetch current user role
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: currProfile } = await supabase.from('profiles').select('role').eq('auth_user_id', user.id).maybeSingle()
                setCurrentUserRole(currProfile?.role || null)
            }

            // Aggregate stats (independent of pagination).
            // Use head:true count queries so we get exact counts without
            // hitting the PostgREST default 1000-row cap.
            const baseFilter = (q: any) =>
                q.not('role', 'in', '("admin","super_admin","superadmin")')

            const [{ count: totalCount }, { count: shadowDb }] = await Promise.all([
                baseFilter(
                    supabase.from('profiles').select('id', { count: 'exact', head: true })
                ),
                baseFilter(
                    supabase.from('profiles').select('id', { count: 'exact', head: true })
                ).eq('is_shadow', true)
            ])

            const total = totalCount ?? 0
            const shadow = shadowDb ?? 0
            setShadowCount(shadow)
            setActiveCount(Math.max(0, total - shadow))
        } catch (e: any) {
            console.error('Error fetching users:', e?.message || e)
        } finally {
            setLoading(false)
        }
    }

    const handleRowClick = (userId: string) => {
        if (editingUserId) return
        setActiveUserId(prev => prev === userId ? null : userId)
    }

    const startEditRow = (u: UserProfile) => {
        setEditingUserId(u.id)
        setRowDrafts(u)
    }

    const saveEditRow = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!editingUserId) return

        const toastId = toast.loading('Salvataggio in corso...')
        try {
            // Route through server actions (service-role): the browser/authenticated
            // role can only update name/address/city by column grant, so a direct
            // client update of email/CF/etc. returns 403.
            const res = await updateUser(editingUserId, {
                name: rowDrafts.fullName,
                email: rowDrafts.email,
                codice_fiscale: rowDrafts.codiceFiscale,
                partita_iva: rowDrafts.partitaIva,
                pec: rowDrafts.pec,
                codice_cliente: rowDrafts.clientCode,
            })
            if (res?.error) throw new Error(res.error)

            // Update supply addresses if changed (correct columns: address/city)
            if (rowDrafts.userSupplies && rowDrafts.userSupplies.length > 0) {
                for (const s of rowDrafts.userSupplies) {
                    if (s.cif) {
                        await updateUserSupply(s.cif, {
                            address: s.indirizzo_fornitura,
                            city: s.citta,
                        }, editingUserId)
                    }
                }
            }

            toast.success('Utente aggiornato con successo', { id: toastId })

            setUsers(users.map(u => u.id === editingUserId ? { ...u, ...rowDrafts } as UserProfile : u))
            setEditingUserId(null)
        } catch (error) {
            console.error('Error saving user:', error)
            toast.error('Errore durante il salvataggio', { id: toastId })
        }
    }

    const handleViewMore = () => {
        if (!activeUserId) return
        if (tableRef.current) {
            sessionStorage.setItem('usersListScroll', tableRef.current.scrollTop.toString())
        }
        router.push(`/admin/users/${activeUserId}`)
    }

    const activeUser = useMemo(
        () => users.find(u => u.id === activeUserId) || null,
        [users, activeUserId]
    )

    // Fetch bills for active user
    useEffect(() => {
        if (!activeUserId) { setActiveBills([]); return }
        let cancelled = false
        setActiveBillsLoading(true)
            ; (async () => {
                const { data, error } = await supabase
                    .from('bills')
                    .select('*')
                    .eq('user_id', activeUserId)
                    .order('data_emissione', { ascending: false })
                if (cancelled) return
                if (error) {
                    console.error('Bills fetch failed:', error.message)
                    setActiveBills([])
                } else {
                    setActiveBills(data || [])
                }
                setActiveBillsLoading(false)
            })()
        return () => { cancelled = true }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeUserId])

    const activeBillStats = useMemo(() => {
        const list = activeBills
        const total = list.length
        const paid = list.filter((b: any) => b.status === 'paid').length
        const unpaid = total - paid
        const totalAmount = list.reduce((a: number, b: any) => a + Number(b.importo || 0), 0)
        const unpaidAmount = list.filter((b: any) => b.status !== 'paid').reduce((a: number, b: any) => a + Number(b.importo || 0), 0)
        const totalConsumo = list.reduce((a: number, b: any) => a + Number(b.consumo || 0), 0)
        const last = list[0]
        return { total, paid, unpaid, totalAmount, unpaidAmount, totalConsumo, last }
    }, [activeBills])

    const updateActiveUserField = async (field: keyof UserProfile | string, value: string) => {
        if (!activeUserId) return
        // Optimistic update
        setUsers(prev => prev.map(u => u.id === activeUserId ? { ...u, [field]: value } : u))

        // Map page-side field name → DB column
        const dbColumn: Record<string, string> = {
            fullName: 'name',
            email: 'email',
            codiceFiscale: 'codice_fiscale',
            partitaIva: 'partita_iva',
            clientCode: 'codice_cliente'
        }
        const col = dbColumn[field as string]
        if (!col) return

        const { error } = await supabase
            .from('profiles')
            .update({ [col]: value })
            .eq('id', activeUserId)

        if (error) {
            console.error('Update failed:', error.message)
        }
    }

    const totalPages = Math.max(1, Math.ceil(totalResults / itemsPerPage))

    const stats = useMemo(() => ({
        total: totalResults,
        active: activeCount,
        shadow: shadowCount,
        unpaid: unpaidTotal,
        unpaidUsers: unpaidUsersCount,
    }), [totalResults, activeCount, shadowCount, unpaidTotal, unpaidUsersCount])

    const handleExportCSV = useCallback(() => {
        const selectedUsers = users.filter(u => selected.has(u.id))
        if (selectedUsers.length === 0) return

        const headers = ['Nome', 'Email', 'CF', 'P.IVA', 'PEC', 'Codice Cliente', 'Indirizzo', 'Città']
        const csvContent = [
            headers.join(','),
            ...selectedUsers.map(u => [
                `"${u.fullName}"`,
                `"${u.email}"`,
                `"${u.codiceFiscale}"`,
                `"${u.partitaIva}"`,
                `"${u.pec}"`,
                `"${u.clientCode}"`,
                `"${u.address}"`,
                `"${u.city}"`
            ].join(','))
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)
        link.setAttribute('href', url)
        link.setAttribute('download', `export_utenti_${new Date().toISOString().split('T')[0]}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }, [selected, users])

    const handlePrint = useCallback(async () => {
        if (selected.size === 0) return
        toast.loading('Generazione report in corso...', { id: 'print-job' })

        try {
            const selectedUsers = users.filter(u => selected.has(u.id))
            const { data: allBills, error: billsError } = await supabase
                .from('bills')
                .select('*')
                .in('user_id', selectedUsers.map(u => u.id))
                .order('data_emissione', { ascending: true })

            if (billsError) throw billsError

            // Hidden iframe — no new tab, no full-screen preview window
            const existing = document.getElementById('acq-print-frame')
            if (existing) existing.remove()
            const iframe = document.createElement('iframe')
            iframe.id = 'acq-print-frame'
            iframe.style.position = 'fixed'
            iframe.style.right = '0'
            iframe.style.bottom = '0'
            iframe.style.width = '0'
            iframe.style.height = '0'
            iframe.style.border = '0'
            iframe.setAttribute('aria-hidden', 'true')
            document.body.appendChild(iframe)

            const printDoc = iframe.contentWindow?.document
            if (!printDoc) {
                iframe.remove()
                toast.error('Impossibile preparare la stampa', { id: 'print-job' })
                return
            }

            const html = `
                <!DOCTYPE html>
                <html lang="it">
                <head>
                    <meta charset="UTF-8">
                    <title>Report Clienti - Acquambiente</title>
                    <style>
                        /* Print-friendly: minimal ink, system fonts, no heavy fills */
                        :root {
                            --ink: #111111;
                            --ink-2: #333333;
                            --ink-3: #555555;
                            --ink-4: #888888;
                            --rule: #c8c8c8;
                            --rule-soft: #e5e5e5;
                            --accent: #0A2540;
                        }

                        * { box-sizing: border-box; }
                        html, body {
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
                            margin: 0; padding: 0;
                            color: var(--ink);
                            background: white;
                            font-size: 10pt;
                            line-height: 1.4;
                            font-feature-settings: "tnum" 1;
                        }

                        @page { size: A4; margin: 14mm 14mm 12mm 14mm; }

                        .page {
                            width: 100%;
                            background: white;
                            position: relative;
                            page-break-after: always;
                        }
                        .page:last-child { page-break-after: auto; }

                        /* HEADER — flat, no fills */
                        .header {
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-end;
                            padding: 0 0 8px;
                            border-bottom: 1.5pt solid var(--ink);
                            margin-bottom: 14px;
                        }
                        .header .brand { font-size: 13pt; font-weight: 700; letter-spacing: 0.5px; color: var(--ink); }
                        .header .brand-sub { font-size: 7.5pt; font-weight: 500; color: var(--ink-3); text-transform: uppercase; letter-spacing: 1.2px; margin-top: 2px; }
                        .header .meta { text-align: right; }
                        .header .meta-date { font-size: 9pt; font-weight: 600; color: var(--ink-2); }
                        .header .meta-id { font-size: 7.5pt; font-weight: 500; color: var(--ink-4); letter-spacing: 0.5px; margin-top: 2px; font-family: "Courier New", monospace; }

                        /* TITLE BLOCK */
                        .title-block { margin-bottom: 12px; }
                        .title-eyebrow { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--ink-3); margin-bottom: 2px; }
                        .title-name { font-size: 18pt; font-weight: 700; color: var(--ink); letter-spacing: -0.3px; line-height: 1.15; }

                        /* INFO GRID & PILLS */
                        .info-grid { display: grid; grid-template-columns: 1.2fr 1.8fr; gap: 16px; margin-bottom: 18px; }
                        .info-item { display: flex; flex-direction: column; }
                        .info-label { font-size: 7pt; font-weight: 700; text-transform: uppercase; color: var(--ink-4); letter-spacing: 1px; margin-bottom: 4px; }
                        .info-value { font-size: 11pt; font-weight: 700; color: var(--ink); line-height: 1.2; }
                        .info-sub { font-size: 9pt; color: var(--ink-3); margin-top: 1px; }
                        
                        .pill-group { display: flex; flex-wrap: wrap; gap: 5px; }
                        .pill { 
                            display: inline-flex; align-items: center; 
                            background: #f1f5f9; padding: 3px 8px; border-radius: 4px;
                            border: 0.5pt solid #e2e8f0;
                        }
                        .pill-label { font-size: 6pt; font-weight: 800; text-transform: uppercase; color: #64748b; margin-right: 6px; }
                        .pill-value { font-size: 8pt; font-weight: 700; color: #1e293b; }
                        .pill-value.mono { font-family: "Courier New", monospace; font-size: 8.5pt; }

                        /* KPI ROW — clean cards */
                        .kpi-row {
                            display: grid;
                            grid-template-columns: repeat(3, 1fr);
                            gap: 12px;
                            margin-bottom: 18px;
                        }
                        .kpi {
                            padding: 10px 12px;
                            background: #f8fafc;
                            border: 0.5pt solid #e2e8f0;
                            border-radius: 6px;
                        }
                        .kpi .kpi-label { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--ink-4); margin-bottom: 4px; }
                        .kpi .kpi-value { font-size: 15pt; font-weight: 700; color: var(--ink); line-height: 1; letter-spacing: -0.4px; }
                        .kpi .kpi-value.alert { color: #b91c1c; }
                        .kpi .kpi-unit { font-size: 9pt; font-weight: 500; color: var(--ink-4); margin-left: 2px; }
                        .kpi .kpi-foot { font-size: 7pt; font-weight: 500; color: var(--ink-3); margin-top: 5px; border-top: 0.4pt solid #e2e8f0; padding-top: 4px; }

                        /* SECTION HEADER */
                        .section-title {
                            font-size: 8.5pt; font-weight: 700;
                            text-transform: uppercase; letter-spacing: 1.5px;
                            color: var(--ink-2);
                            margin: 4px 0 8px;
                            padding-bottom: 3px;
                            border-bottom: 0.5pt solid var(--rule);
                        }

                        /* CHART — minimal, no card */
                        .chart-card {
                            margin-bottom: 14px;
                            page-break-inside: avoid;
                        }
                        .chart-legend { display: flex; gap: 14px; margin-bottom: 4px; }
                        .legend-item { display: inline-flex; align-items: center; gap: 5px; font-size: 7.5pt; font-weight: 600; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.8px; }
                        .legend-swatch { width: 9px; height: 9px; display: inline-block; }

                        /* TABLE */
                        .table-card { border: 0.75pt solid var(--rule); page-break-inside: auto; }
                        table { width: 100%; border-collapse: collapse; font-size: 9pt; }
                        thead { display: table-header-group; }
                        thead tr { border-bottom: 0.75pt solid var(--ink-2); }
                        th {
                            text-align: left; padding: 6px 10px;
                            color: var(--ink-3); font-weight: 700;
                            text-transform: uppercase; font-size: 7pt; letter-spacing: 1px;
                        }
                        td { padding: 6px 10px; border-bottom: 0.5pt solid var(--rule-soft); color: var(--ink-2); }
                        tbody tr:last-child td { border-bottom: none; }
                        tbody tr { page-break-inside: avoid; }

                        .mono { font-family: "Courier New", monospace; font-size: 8.5pt; color: var(--ink-3); }
                        .amount { font-weight: 700; text-align: right; color: var(--ink); font-size: 9.5pt; }
                        .status {
                            display: inline-block;
                            font-size: 7pt; font-weight: 700;
                            text-transform: uppercase; letter-spacing: 0.6px;
                            padding: 2px 6px;
                            border: 0.5pt solid var(--ink-3);
                        }
                        .status.paid { color: var(--ink); border-color: var(--ink-2); }
                        .status.unpaid { color: var(--ink); border-color: var(--ink); border-width: 1pt; font-weight: 800; }
                        .status.unpaid::before { content: '✕ '; }
                        .status.paid::before { content: '✓ '; }

                        /* FOOTER */
                        .footer {
                            position: fixed;
                            bottom: 6mm; left: 14mm; right: 14mm;
                            font-size: 7pt; color: var(--ink-4);
                            display: flex; justify-content: space-between;
                            border-top: 0.5pt solid var(--rule-soft);
                            padding-top: 4px;
                            letter-spacing: 0.3px;
                        }
                        .footer .conf { text-transform: uppercase; font-weight: 600; letter-spacing: 1.2px; }

                        /* SVG — pure b/w with one accent */
                        .grid-line { stroke: var(--rule-soft); stroke-width: 0.4; }
                        .axis-line { stroke: var(--ink-3); stroke-width: 0.6; }
                        .bar { fill: #d4d4d4; stroke: var(--ink-4); stroke-width: 0.3; }
                        .line { fill: none; stroke: var(--ink); stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; }
                        .area { fill: var(--ink); fill-opacity: 0.06; }
                        .dot { fill: white; stroke: var(--ink); stroke-width: 1.2; }
                        .axis-txt { font-size: 7pt; font-weight: 600; fill: var(--ink-3); font-family: -apple-system, "Segoe UI", Helvetica, sans-serif; }
                        .x-txt { font-size: 7pt; font-weight: 500; fill: var(--ink-3); font-family: -apple-system, "Segoe UI", Helvetica, sans-serif; }
                    </style>
                </head>
                <body>
                    ${selectedUsers.map((u, pageIdx) => {
                const userBills = allBills?.filter(b => b.user_id === u.id) || []
                const sortedBills = [...userBills].sort((a, b) => new Date(a.data_emissione).getTime() - new Date(b.data_emissione).getTime())

                // KPI calculations
                const totalAmount = userBills.reduce((s, b) => s + (Number(b.importo) || 0), 0)
                const totalConsumo = userBills.reduce((s, b) => s + (Number(b.consumo) || 0), 0)
                const unpaidCount = userBills.filter(b => b.status !== 'paid').length
                const unpaidAmount = userBills.filter(b => b.status !== 'paid').reduce((s, b) => s + (Number(b.importo) || 0), 0)

                // Chart geometry
                const chartWidth = 720
                const chartHeight = 200
                const padL = 38, padR = 16, padT = 18, padB = 28
                const dataPoints = sortedBills.slice(-12)
                const innerW = chartWidth - padL - padR
                const innerH = chartHeight - padT - padB

                const maxImporto = Math.max(...dataPoints.map(b => Number(b.importo) || 0), 50)
                const maxConsumo = Math.max(...dataPoints.map(b => Number(b.consumo) || 0), 10)
                const niceMax = (v: number) => { const e = Math.pow(10, Math.floor(Math.log10(v))); return Math.ceil(v / e) * e }
                const yMax = niceMax(maxImporto * 1.15)

                const n = dataPoints.length
                const stepX = n > 1 ? innerW / (n - 1) : 0
                const getX = (i: number) => padL + (n > 1 ? i * stepX : innerW / 2)
                const getYImp = (v: number) => padT + innerH - (v * innerH / yMax)
                const getYCon = (v: number) => padT + innerH - (v * innerH / Math.max(maxConsumo, 1))

                const linePts = dataPoints.map((b, i) => `${getX(i)},${getYImp(Number(b.importo) || 0)}`).join(' ')
                const areaPts = n > 0
                    ? `${getX(0)},${padT + innerH} ${linePts} ${getX(n - 1)},${padT + innerH}`
                    : ''
                const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({ y: padT + innerH - t * innerH, val: yMax * t }))
                const barW = Math.min(20, stepX * 0.5)

                return `
                        <div class="page">
                            <div class="header">
                                <div>
                                    <div class="brand">ACQUAMBIENTE</div>
                                    <div class="brand-sub">Report Cliente · Riepilogo Anagrafico</div>
                                </div>
                                <div class="meta">
                                    <div class="meta-date">${new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                                    <div class="meta-id">DOC #${u.id.slice(0, 8).toUpperCase()} · PG ${pageIdx + 1}/${selectedUsers.length}</div>
                                </div>
                            </div>

                            <div class="title-block">
                                <div class="title-eyebrow">Titolare contratto</div>
                                <div class="title-name">${u.fullName || '—'}</div>
                            </div>

                            <div class="info-grid">
                                <div class="info-item">
                                    <div class="info-label">Indirizzo di fornitura</div>
                                    <div class="info-value">${u.address || '—'}</div>
                                    <div class="info-sub">${u.city || ''}</div>
                                </div>
                                <div class="info-item">
                                    <div class="pill-group">
                                        <div class="pill">
                                            <span class="pill-label">Codice Cliente</span>
                                            <span class="pill-value mono">${u.clientCode || '—'}</span>
                                        </div>
                                        <div class="pill">
                                            <span class="pill-label">Fiscale</span>
                                            <span class="pill-value mono">${u.codiceFiscale || u.partitaIva || u.cif || '—'}</span>
                                        </div>
                                        <div class="pill">
                                            <span class="pill-label">Email</span>
                                            <span class="pill-value">${u.email || '—'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="kpi-row">
                                <div class="kpi">
                                    <div class="kpi-label">Fatturato Totale</div>
                                    <div class="kpi-value">€ ${totalAmount.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</div>
                                    <div class="kpi-foot">${userBills.length} document${userBills.length === 1 ? 'o' : 'i'}</div>
                                </div>
                                <div class="kpi">
                                    <div class="kpi-label">Consumo Totale</div>
                                    <div class="kpi-value">${totalConsumo.toLocaleString('it-IT', { maximumFractionDigits: 0 })} <span class="kpi-unit">mc</span></div>
                                    <div class="kpi-foot">media ${userBills.length ? (totalConsumo / userBills.length).toFixed(1) : '0'} mc/bolletta</div>
                                </div>
                                <div class="kpi">
                                    <div class="kpi-label">Insoluti</div>
                                    <div class="kpi-value ${unpaidAmount > 0 ? 'alert' : ''}">€ ${unpaidAmount.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</div>
                                    <div class="kpi-foot">${unpaidCount} pendenze</div>
                                </div>
                            </div>
                                    <div class="kpi-value">${unpaidCount}</div>
                                    <div class="kpi-foot">€ ${unpaidAmount.toLocaleString('it-IT', { maximumFractionDigits: 2 })} da incassare</div>
                                </div>
                            </div>

                            <div class="section-title">Andamento ultimi ${dataPoints.length} document${dataPoints.length === 1 ? 'o' : 'i'}</div>
                            <div class="chart-card">
                                <div class="chart-legend">
                                    <span class="legend-item"><span class="legend-swatch" style="background: var(--ink);"></span>Importo (€)</span>
                                    <span class="legend-item"><span class="legend-swatch" style="background: #d4d4d4; border: 0.3pt solid var(--ink-4);"></span>Consumo (mc)</span>
                                </div>
                                <svg width="100%" viewBox="0 0 ${chartWidth} ${chartHeight}" preserveAspectRatio="xMidYMid meet" style="display: block;">
                                    ${yTicks.map(t => `
                                        <line class="grid-line" x1="${padL}" y1="${t.y}" x2="${chartWidth - padR}" y2="${t.y}" />
                                        <text class="axis-txt" x="${padL - 6}" y="${t.y + 3}" text-anchor="end">€${t.val.toFixed(0)}</text>
                                    `).join('')}
                                    <line class="axis-line" x1="${padL}" y1="${padT + innerH}" x2="${chartWidth - padR}" y2="${padT + innerH}" />

                                    ${dataPoints.map((b, i) => {
                    const x = getX(i)
                    const y = getYCon(Number(b.consumo) || 0)
                    const h = (padT + innerH) - y
                    return `<rect class="bar" x="${x - barW / 2}" y="${y}" width="${barW}" height="${h}" rx="2" />`
                }).join('')}

                                    ${areaPts ? `<polygon class="area" points="${areaPts}" />` : ''}
                                    <polyline class="line" points="${linePts}" />

                                    ${dataPoints.map((b, i) => {
                    const x = getX(i)
                    const y = getYImp(Number(b.importo) || 0)
                    return `<circle class="dot" cx="${x}" cy="${y}" r="3.5" />`
                }).join('')}

                                    ${dataPoints.map((b, i) => {
                    const x = getX(i)
                    return `<text class="x-txt" x="${x}" y="${chartHeight - 8}" text-anchor="middle">${new Date(b.data_emissione).toLocaleDateString('it-IT', { month: 'short', year: '2-digit' }).replace('.', '')}</text>`
                }).join('')}
                                </svg>
                            </div>

                            <div class="section-title">Registro Documenti</div>
                            <div class="table-card">
                                <table>
                                    <thead>
                                        <tr>
                                            <th style="width: 22%;">Cod. Bolletta</th>
                                            <th style="width: 18%;">Emissione</th>
                                            <th style="width: 16%;">Consumo</th>
                                            <th style="width: 18%;">Stato</th>
                                            <th style="text-align: right; width: 26%;">Importo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${sortedBills.slice(-12).reverse().map(b => `
                                            <tr>
                                                <td class="mono">${b.numero_bolletta || b.idboll || '—'}</td>
                                                <td>${new Date(b.data_emissione).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                                <td>${b.consumo || 0} <span style="color: var(--slate-400); font-size: 9px;">mc</span></td>
                                                <td><span class="status ${b.status === 'paid' ? 'paid' : 'unpaid'}">${b.status === 'paid' ? 'Pagata' : 'Insoluta'}</span></td>
                                                <td class="amount">€ ${Number(b.importo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td>
                                            </tr>
                                        `).join('') || '<tr><td colspan="5" style="text-align: center; padding: 24px; color: var(--slate-400);">Nessun documento disponibile</td></tr>'}
                                    </tbody>
                                </table>
                            </div>

                            <div class="footer">
                                <div>© ${new Date().getFullYear()} Acquambiente S.r.l.</div>
                                <div class="conf">Documento Riservato · Uso Interno</div>
                                <div>Pag. ${pageIdx + 1} di ${selectedUsers.length}</div>
                            </div>
                        </div>
                        `
            }).join('')}
                </body>
                </html>
            `
            printDoc.open()
            printDoc.write(html)
            printDoc.close()

            const printWin = iframe.contentWindow
            if (!printWin) {
                iframe.remove()
                toast.error('Impossibile preparare la stampa', { id: 'print-job' })
                return
            }

            const triggerPrint = () => {
                try {
                    printWin.focus()
                    printWin.print()
                } catch (e) {
                    console.error('Print invocation failed:', e)
                }
                // Cleanup after the print dialog closes
                const cleanup = () => { setTimeout(() => iframe.remove(), 500) }
                printWin.onafterprint = cleanup
                // Fallback cleanup in case onafterprint doesn't fire
                setTimeout(cleanup, 60000)
            }

            // Wait for fonts/layout before printing
            if (printDoc.readyState === 'complete') {
                setTimeout(triggerPrint, 200)
            } else {
                printWin.addEventListener('load', () => setTimeout(triggerPrint, 200), { once: true })
            }
            toast.success('Report pronto per la stampa', { id: 'print-job' })
        } catch (err) {
            console.error('Print error:', err)
            toast.error('Errore durante la generazione del report', { id: 'print-job' })
        }
    }, [selected, users, supabase])

    return (
        <>
            <AdminPageHero
                title="Anagrafica clienti"
                actions={
                    <div className="flex items-center justify-end w-full animate-in fade-in slide-in-from-right-4 duration-700">
                        <div className="flex items-center gap-10">
                            <div className="flex flex-col items-end">
                                <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-1">Utenti Totali</span>
                                <span className="text-[19px] font-bold text-slate-900 dark:text-white leading-none tabular-nums">
                                    {stats.total}
                                </span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-1">Registrati</span>
                                <span className="text-[19px] font-bold text-slate-900 dark:text-white leading-none tabular-nums">
                                    {stats.active}
                                </span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-1">Non Registrati</span>
                                <span className="text-[19px] font-bold text-slate-900 dark:text-white leading-none tabular-nums">
                                    {stats.shadow}
                                </span>
                            </div>
                        </div>
                    </div>
                }
            />

            <div className="h-full flex flex-col gap-3 min-h-0 px-0">
                {/* Body grid: table + right rail */}
                <div className="flex-1 min-h-0 flex flex-col gap-0">
                    {/* Main content column */}
                    <div className="flex flex-col min-h-0">
                        {/* Filter chips moved inside the grid for perfect alignment with table/footer */}
                        <div className="flex items-center gap-2 shrink-0 flex-wrap px-6 py-2 bg-white dark:bg-[#0F1115]">
                            <div className="relative group">
                                <FilterChip
                                    label={`Utenza${statusFilter !== 'all' ? `: ${statusFilter === 'active' ? 'Registrato' : 'Non registrato'}` : ''}`}
                                    active={statusFilter !== 'all'}
                                    onClear={() => { setStatusFilter('all'); setCurrentPage(1) }}
                                />
                                <div className="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-[#1A1D23] border border-slate-200 dark:border-white/10 rounded-lg py-1 hidden group-hover:block z-50 animate-in fade-in zoom-in-95 duration-100">
                                    {(['all', 'active', 'shadow'] as const).map(s => (
                                        <button
                                            key={s}
                                            onClick={() => { setStatusFilter(s); setCurrentPage(1) }}
                                            className={cn(
                                                "w-full text-left px-3 py-2 text-[12px] hover:bg-slate-50 dark:hover:bg-white/5",
                                                statusFilter === s ? "text-indigo-600 font-bold" : "text-slate-600 dark:text-slate-400"
                                            )}
                                        >
                                            {s === 'all' ? 'Tutte le utenze' : s === 'active' ? 'Registrato' : 'Non registrato'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="relative group">
                                <FilterChip
                                    label={`Contratto${contractStatusFilter !== 'all' ? `: ${getContractStatus(contractStatusFilter).label}` : ''}`}
                                    active={contractStatusFilter !== 'all'}
                                    onClear={() => { setContractStatusFilter('all'); setCurrentPage(1) }}
                                />
                                <div className="absolute top-full left-0 mt-1 w-44 bg-white dark:bg-[#1A1D23] border border-slate-200 dark:border-white/10 rounded-lg py-1 hidden group-hover:block z-50 animate-in fade-in zoom-in-95 duration-100">
                                    <button
                                        onClick={() => { setContractStatusFilter('all'); setCurrentPage(1) }}
                                        className={cn(
                                            "w-full text-left px-3 py-2 text-[12px] hover:bg-slate-50 dark:hover:bg-white/5",
                                            contractStatusFilter === 'all' ? "text-indigo-600 font-bold" : "text-slate-600 dark:text-slate-400"
                                        )}
                                    >
                                        Tutti i contratti
                                    </button>
                                    {(['03', '04', '05', '08'] as const).map(s => {
                                        const st = getContractStatus(s)
                                        return (
                                            <button
                                                key={s}
                                                onClick={() => { setContractStatusFilter(s); setCurrentPage(1) }}
                                                className={cn(
                                                    "w-full text-left px-3 py-2 text-[12px] hover:bg-slate-50 dark:hover:bg-white/5 flex items-center justify-between",
                                                    contractStatusFilter === s ? "text-indigo-600 font-bold" : "text-slate-600 dark:text-slate-400"
                                                )}
                                            >
                                                <span>{st.label}</span>
                                                <span className="text-[9px] opacity-40 font-mono">{s}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="relative group">
                                <FilterChip
                                    label={`Ordina per: ${sortBy === 'created_at' ? 'Data' :
                                        sortBy === 'name' ? 'Nome' :
                                            sortBy === 'user_supplies_count' ? 'Forniture' :
                                                'Bollette'
                                        }`}
                                    active={sortBy !== 'created_at'}
                                    onClear={() => { setSortBy('created_at'); setSortOrder('desc'); setCurrentPage(1) }}
                                />
                                <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-[#1A1D23] border border-slate-200 dark:border-white/10 rounded-lg py-1 hidden group-hover:block z-50">
                                    <button
                                        onClick={() => { setSortBy('created_at'); setSortOrder('desc'); setCurrentPage(1) }}
                                        className={cn(
                                            "w-full text-left px-3 py-2 text-[12px] hover:bg-slate-50 dark:hover:bg-white/5",
                                            sortBy === 'created_at' ? "text-indigo-600 font-bold" : "text-slate-600 dark:text-slate-400"
                                        )}
                                    >
                                        Più recenti
                                    </button>
                                    <button
                                        onClick={() => { setSortBy('name'); setSortOrder('asc'); setCurrentPage(1) }}
                                        className={cn(
                                            "w-full text-left px-3 py-2 text-[12px] hover:bg-slate-50 dark:hover:bg-white/5",
                                            sortBy === 'name' ? "text-indigo-600 font-bold" : "text-slate-600 dark:text-slate-400"
                                        )}
                                    >
                                        Nome (A-Z)
                                    </button>
                                    <button
                                        onClick={() => { setSortBy('user_supplies_count'); setSortOrder('desc'); setCurrentPage(1) }}
                                        className={cn(
                                            "w-full text-left px-3 py-2 text-[12px] hover:bg-slate-50 dark:hover:bg-white/5",
                                            sortBy === 'user_supplies_count' ? "text-indigo-600 font-bold" : "text-slate-600 dark:text-slate-400"
                                        )}
                                    >
                                        Numero Forniture
                                    </button>
                                    <button
                                        onClick={() => { setSortBy('bills_count'); setSortOrder('desc'); setCurrentPage(1) }}
                                        className={cn(
                                            "w-full text-left px-3 py-2 text-[12px] hover:bg-slate-50 dark:hover:bg-white/5",
                                            sortBy === 'bills_count' ? "text-indigo-600 font-bold" : "text-slate-600 dark:text-slate-400"
                                        )}
                                    >
                                        Numero Bollette
                                    </button>
                                </div>
                            </div>

                            <div className="ml-auto relative w-64">
                                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Cerca..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full h-9 pl-9 pr-4 rounded-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[13px] text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-slate-300 dark:focus:border-white/20 transition-all"
                                />
                            </div>
                        </div>

                        <div ref={tableRef} className="flex-1 min-h-0 overflow-auto custom-scrollbar">
                            {/* Header */}
                            <div className="sticky top-0 z-10 grid grid-cols-[48px_1.5fr_1.5fr_1fr_2.2fr_0.6fr_0.6fr_160px] gap-4 px-6 py-2 bg-white dark:bg-[#0F1115] text-[10px] font-semibold tracking-[0.12em] uppercase text-slate-400 dark:text-slate-500 border-t border-slate-200/70 dark:border-white/5">
                                <div className="flex items-center justify-center">
                                    <Checkbox checked={allSelected} indeterminate={!allSelected && selected.size > 0} onChange={toggleSelectAll} />
                                </div>
                                <div className="flex items-center gap-1">Anagrafica</div>
                                <div>Identificativi</div>
                                <div>Fornitura</div>
                                <div>Indirizzo Fornitura</div>
                                <div
                                    className="text-center flex items-center justify-center gap-1 cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 transition-colors group/h"
                                    onClick={() => toggleSort('user_supplies_count')}
                                >
                                    Contratti
                                    <ChevronDown
                                        size={11}
                                        className={cn(
                                            "transition-all duration-300",
                                            sortBy === 'user_supplies_count'
                                                ? "text-indigo-500 dark:text-indigo-400 opacity-100"
                                                : "text-slate-300 dark:text-slate-600 opacity-40 group-hover/h:opacity-100",
                                            sortBy === 'user_supplies_count' && sortOrder === 'asc' && "rotate-180"
                                        )}
                                    />
                                </div>
                                <div
                                    className="text-center flex items-center justify-center gap-1 cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 transition-colors group/h"
                                    onClick={() => toggleSort('bills_count')}
                                >
                                    Boll.
                                    <ChevronDown
                                        size={11}
                                        className={cn(
                                            "transition-all duration-300",
                                            sortBy === 'bills_count'
                                                ? "text-indigo-500 dark:text-indigo-400 opacity-100"
                                                : "text-slate-300 dark:text-slate-600 opacity-40 group-hover/h:opacity-100",
                                            sortBy === 'bills_count' && sortOrder === 'asc' && "rotate-180"
                                        )}
                                    />
                                </div>
                                <div />
                            </div>

                            {/* Rows */}
                            <div className="divide-y divide-slate-100 dark:divide-white/5">
                                {loading ? (
                                    <div className="px-6 py-16 text-center text-[12px] text-slate-400">Caricamento…</div>
                                ) : users.length === 0 ? (
                                    <div className="px-6 py-16 text-center text-[12px] text-slate-400">Nessun utente trovato</div>
                                ) : users.map((u) => {
                                    const isSel = selected.has(u.id)
                                    const isActive = activeUserId === u.id
                                    return (
                                        <div
                                            key={u.id}
                                            onClick={() => { if (editingUserId !== u.id) router.push(`/admin/users/${u.id}`); }}
                                            className={cn(
                                                'group grid grid-cols-[48px_1.5fr_1.5fr_1fr_2.2fr_0.6fr_0.6fr_160px] gap-4 items-center px-6 py-3 cursor-pointer transition-colors relative border-l-2',
                                                editingUserId === u.id
                                                    ? 'bg-slate-50 dark:bg-white/[0.04] border-indigo-500'
                                                    : isActive
                                                        ? 'bg-slate-100 dark:bg-white/[0.06] border-transparent'
                                                        : isSel
                                                            ? 'bg-slate-100/70 dark:bg-white/[0.04] border-transparent'
                                                            : 'hover:bg-slate-100/50 dark:hover:bg-white/[0.02] border-transparent'
                                            )}
                                        >
                                            {/* Checkbox */}
                                            <div
                                                className="flex items-center justify-center"
                                                onClick={(e) => { e.stopPropagation(); toggleSelect(u.id) }}
                                            >
                                                <Checkbox checked={isSel} onChange={() => toggleSelect(u.id)} />
                                            </div>

                                            {/* Client */}
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className={cn(
                                                    'w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors duration-300 border border-current opacity-80',
                                                    u.isShadow
                                                        ? 'bg-sky-50 text-sky-500 dark:bg-sky-500/10 dark:text-sky-400'
                                                        : 'bg-[#0A2540] text-white dark:bg-white dark:text-[#0A2540]'
                                                )}>
                                                    {u.isShadow ? <Ghost size={13} strokeWidth={2.5} /> : initialsOf(u.fullName)}
                                                </div>
                                                <div className="flex flex-col min-w-0 w-full gap-1">
                                                    {editingUserId === u.id ? (
                                                        <>
                                                            <input
                                                                className="h-6 px-2 text-[12px] font-bold border border-indigo-200 dark:border-indigo-500/30 rounded bg-white dark:bg-[#1A1F2A] outline-none"
                                                                value={rowDrafts.fullName || ''}
                                                                onChange={e => setRowDrafts({ ...rowDrafts, fullName: e.target.value })}
                                                                placeholder="Nome"
                                                                onClick={e => e.stopPropagation()}
                                                            />
                                                            <input
                                                                className="h-6 px-2 text-[11px] font-mono border border-indigo-200 dark:border-indigo-500/30 rounded bg-white dark:bg-[#1A1F2A] outline-none"
                                                                value={rowDrafts.clientCode || ''}
                                                                onChange={e => setRowDrafts({ ...rowDrafts, clientCode: e.target.value })}
                                                                placeholder="Codice Cliente"
                                                                onClick={e => e.stopPropagation()}
                                                            />
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className={cn(
                                                                'text-[13px] truncate font-medium',
                                                                u.isShadow ? 'text-slate-500 dark:text-slate-400' : 'text-slate-800 dark:text-white'
                                                            )}>
                                                                {u.fullName}
                                                            </span>
                                                            {u.clientCode && (
                                                                <div className="mt-0.5">
                                                                    <CodeBadge value={u.clientCode} label="CODICE CLIENTE" copyable />
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Identificativi (copy-able) / Editable fields */}
                                            <div className="flex flex-col gap-2 min-w-0">
                                                {editingUserId === u.id ? (
                                                    <>
                                                        <input
                                                            className="h-6 px-2 text-[11px] font-mono border border-indigo-200 dark:border-indigo-500/30 rounded bg-white dark:bg-[#1A1F2A] outline-none"
                                                            value={rowDrafts.codiceFiscale || ''}
                                                            onChange={e => setRowDrafts({ ...rowDrafts, codiceFiscale: e.target.value })}
                                                            placeholder="Codice Fiscale"
                                                            onClick={e => e.stopPropagation()}
                                                        />
                                                        <input
                                                            className="h-6 px-2 text-[11px] font-mono border border-indigo-200 dark:border-indigo-500/30 rounded bg-white dark:bg-[#1A1F2A] outline-none"
                                                            value={rowDrafts.partitaIva || ''}
                                                            onChange={e => setRowDrafts({ ...rowDrafts, partitaIva: e.target.value })}
                                                            placeholder="P.IVA"
                                                            onClick={e => e.stopPropagation()}
                                                        />
                                                        <input
                                                            className="h-6 px-2 text-[11px] border border-indigo-200 dark:border-indigo-500/30 rounded bg-white dark:bg-[#1A1F2A] outline-none"
                                                            value={rowDrafts.pec || ''}
                                                            onChange={e => setRowDrafts({ ...rowDrafts, pec: e.target.value })}
                                                            placeholder="PEC"
                                                            onClick={e => e.stopPropagation()}
                                                        />
                                                        <input
                                                            className="h-6 px-2 text-[11px] border border-indigo-200 dark:border-indigo-500/30 rounded bg-white dark:bg-[#1A1F2A] outline-none"
                                                            value={rowDrafts.email || ''}
                                                            onChange={e => setRowDrafts({ ...rowDrafts, email: e.target.value })}
                                                            placeholder="Email"
                                                            onClick={e => e.stopPropagation()}
                                                        />
                                                    </>
                                                ) : (
                                                    <div className="flex flex-col gap-2">
                                                        {u.codiceFiscale && (
                                                            <div className="h-6 flex items-center">
                                                                <CodeBadge value={u.codiceFiscale} label="CF" copyable />
                                                            </div>
                                                        )}
                                                        {u.partitaIva && (
                                                            <div className="h-6 flex items-center">
                                                                <CodeBadge value={u.partitaIva} label="P.IVA" copyable />
                                                            </div>
                                                        )}
                                                        {u.pec && (
                                                            <div className="h-6 flex items-center">
                                                                <CodeBadge value={u.pec} label="PEC" copyable mono={false} />
                                                            </div>
                                                        )}
                                                        {u.email && (
                                                            <div className="h-6 flex items-center">
                                                                <CodeBadge value={u.email} label="EMAIL" copyable mono={false} />
                                                            </div>
                                                        )}
                                                        {!u.codiceFiscale && !u.partitaIva && !u.pec && !u.email && (
                                                            <span className="text-[12px] text-slate-300 dark:text-slate-600">—</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Dettagli Fornitura (CIFs) */}
                                            <div className="flex flex-col gap-2 min-w-0">
                                                {u.supplies && u.supplies.length > 1 ? (
                                                    <div className="h-6 flex items-center">
                                                        <MultiBadge count={u.supplies.length} />
                                                    </div>
                                                ) : u.supplies && u.supplies.length === 1 ? (
                                                    <div className="h-6 flex items-center">
                                                        <CodeBadge value={u.supplies[0]} label="CIF" copyable />
                                                    </div>
                                                ) : (
                                                    <span className="text-[12px] text-slate-300 dark:text-slate-600">—</span>
                                                )}
                                            </div>

                                            {/* Address per Fornitura */}
                                            <div className="flex flex-col gap-2 min-w-0">
                                                {u.supplies && u.supplies.length > 1 ? (
                                                    <div className="h-6 flex items-center gap-1.5 text-[10px] font-normal text-slate-400 dark:text-slate-500 uppercase tracking-widest italic">
                                                        <MapPin size={12} className="text-slate-400 dark:text-slate-500" />
                                                        Indirizzi Multipli
                                                    </div>
                                                ) : u.supplies && u.supplies.length === 1 ? (
                                                    (() => {
                                                        const cif = u.supplies[0];
                                                        const s = u.userSupplies?.find((us: any) => us.cif === cif);
                                                        const addr = s?.indirizzo_fornitura || s?.address;
                                                        const cty = s?.citta || s?.city;

                                                        if (editingUserId === u.id) {
                                                            const draftSup = rowDrafts.userSupplies?.find((ds: any) => ds.cif === cif) || s;
                                                            return (
                                                                <div className="h-6 flex items-center gap-1.5 text-[11px] w-full">
                                                                    <input
                                                                        className="flex-[2] min-w-0 h-6 px-1.5 border border-indigo-200 dark:border-indigo-500/30 rounded bg-white dark:bg-[#1A1F2A] outline-none"
                                                                        value={draftSup?.indirizzo_fornitura || addr || ''}
                                                                        onChange={e => {
                                                                            const newSups = [...(rowDrafts.userSupplies || u.userSupplies || [])];
                                                                            const supIdx = newSups.findIndex(ns => ns.cif === cif);
                                                                            if (supIdx > -1) newSups[supIdx] = { ...newSups[supIdx], indirizzo_fornitura: e.target.value };
                                                                            else newSups.push({ cif, indirizzo_fornitura: e.target.value });
                                                                            setRowDrafts({ ...rowDrafts, userSupplies: newSups });
                                                                        }}
                                                                        placeholder="Indirizzo"
                                                                        onClick={e => e.stopPropagation()}
                                                                    />
                                                                </div>
                                                            );
                                                        }

                                                        return (
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="text-[12px] text-slate-700 dark:text-slate-300 truncate">
                                                                    {addr || '—'}
                                                                </span>
                                                                {cty && <span className="text-[10px] text-slate-400 truncate">{cty}</span>}
                                                            </div>
                                                        );
                                                    })()
                                                ) : (
                                                    <span className="text-[12px] text-slate-300 dark:text-slate-600">—</span>
                                                )}
                                            </div>

                                            {/* Contratti Count */}
                                            <div className="flex flex-col items-center justify-center min-w-0">
                                                <span className="text-[13px] font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                                                    {u.suppliesCount || 0}
                                                </span>
                                            </div>

                                            {/* Boll. Count */}
                                            <div className="flex flex-col items-center justify-center min-w-0">
                                                <span className="text-[13px] font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                                                    {u.billsCount || 0}
                                                </span>
                                            </div>

                                            {/* Actions */}
                                            <div className={cn(
                                                "flex items-center justify-end pr-2 gap-1.5 transition-all duration-200",
                                                editingUserId === u.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                            )}>
                                                {editingUserId === u.id ? (
                                                    <div className="flex items-center rounded-full h-9 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 overflow-hidden">
                                                        <button
                                                            onClick={saveEditRow}
                                                            className="flex items-center gap-2 pl-2 pr-4 h-full hover:bg-slate-50 dark:hover:bg-white/10 transition-colors active:opacity-80"
                                                            title="Salva"
                                                        >
                                                            <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                                                <Check size={11} strokeWidth={3} />
                                                            </div>
                                                            <span className="text-[12px] font-bold text-slate-700 dark:text-slate-200 tracking-tight">Salva</span>
                                                        </button>
                                                        <div className="w-px h-4 bg-slate-200 dark:bg-white/10" />
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setEditingUserId(null); }}
                                                            className="group/x w-10 h-full flex items-center justify-center transition-all active:opacity-80"
                                                            title="Annulla"
                                                        >
                                                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover/x:bg-rose-500 group-hover/x:text-white transition-all duration-300">
                                                                <X size={14} strokeWidth={2.5} className="group-hover/x:rotate-90 transition-transform duration-300" />
                                                            </div>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-end gap-2">
                                                        {(currentUserRole === 'super_admin' || currentUserRole === 'superadmin') && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteUser(u); }}
                                                                className="w-9 h-9 flex items-center justify-center rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white transition-all active:scale-90"
                                                                title="Elimina utente"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); startEditRow(u); }}
                                                            className="group h-9 pl-2 pr-4 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-white/10 transition-all active:scale-[0.98]"
                                                        >
                                                            <div className="w-5 h-5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-[#1A1F2A] flex items-center justify-center transition-transform">
                                                                <Edit2 size={11} strokeWidth={3} />
                                                            </div>
                                                            <span className="text-[12px] font-semibold tracking-tight">Modifica</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="flex items-center justify-between py-3 px-6 text-[12px] text-slate-500 dark:text-slate-400 shrink-0 border-t border-slate-200/70 dark:border-white/5">
                            <div className="flex items-center gap-2 pl-3">
                                <span className="font-medium text-slate-400 uppercase tracking-wider text-[10px]">Righe</span>
                                <select
                                    value={itemsPerPage}
                                    onChange={(e) => handleLimitChange(Number(e.target.value))}
                                    className="bg-transparent border border-slate-200 dark:border-white/10 rounded-md px-2 py-1 outline-none text-slate-700 dark:text-slate-200 text-[12px] font-semibold hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                                >
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                                <span className="text-slate-300 dark:text-slate-700 mx-1">·</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">{totalResults} totali</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span>Pagina {currentPage} di {totalPages}</span>
                                <button
                                    disabled={currentPage === 1 || loading}
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    className="w-7 h-7 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                                >
                                    <ChevronLeft size={14} />
                                </button>
                                <button
                                    disabled={currentPage >= totalPages || loading}
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    className="w-7 h-7 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                                >
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>

                    </div>

                </div>
            </div>

            {/* Floating selection bar */}
            {selected.size > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    {/* Independent Close Button */}
                    <button
                        onClick={clearSelection}
                        className="w-10 h-10 flex items-center justify-center bg-[#1A1F2A] dark:bg-white dark:text-[#1A1F2A] hover:bg-red-500/20 dark:hover:bg-red-500 hover:text-red-400 dark:hover:text-white text-white rounded-xl border border-white/10 dark:border-transparent transition-all group"
                        title="Annulla selezione"
                    >
                        <X size={18} className="transition-transform group-hover:rotate-90" />
                    </button>

                    {/* Main Actions Bar */}
                    <div className="bg-[#1A1F2A] dark:bg-white text-white dark:text-[#1A1F2A] rounded-xl border border-white/10 dark:border-transparent flex items-stretch overflow-hidden divide-x divide-white/10 dark:divide-slate-200 h-10">
                        <div className="px-4 flex items-center text-[12px] whitespace-nowrap border-r border-white/10 dark:border-slate-200">
                            <span className="text-white/60 dark:text-[#1A1F2A]/50 font-medium uppercase tracking-wider text-[9px]">Selezionati</span>
                            <span className="text-white dark:text-[#1A1F2A] font-bold ml-2 bg-white/10 dark:bg-[#1A1F2A]/10 px-1.5 py-0.5 rounded text-[11px] min-w-[20px] text-center">{selected.size}</span>
                        </div>
                        <SelectionAction
                            icon={<Download size={14} />}
                            label="Esporta CSV"
                            onClick={handleExportCSV}
                        />
                        <SelectionAction
                            icon={<Printer size={14} />}
                            label="Stampa riepilogo"
                            onClick={handlePrint}
                        />
                    </div>
                </div>
            )}
        </>
    )
}

function adapt(p: any): UserProfile {
    const userSupplies = p.user_supplies || []
    const firstSup = userSupplies[0]
    return {
        id: p.id,
        fullName: p.name || 'Utente non registrato',
        email: p.email || '',
        codiceFiscale: p.codice_fiscale || '',
        partitaIva: p.partita_iva || '',
        pec: p.pec || '',
        clientCode: p.codice_cliente || '',
        isShadow: p.is_shadow || !p.email || !p.name,
        billsCount: typeof p.bills_count === 'number' ? p.bills_count : (Array.isArray(p.bills) ? p.bills.length : 0),
        suppliesCount: typeof p.user_supplies_count === 'number' ? p.user_supplies_count : userSupplies.length,
        userSupplies: userSupplies,
        cif: p.cif || firstSup?.cif || '',
        address: firstSup?.indirizzo_fornitura || firstSup?.address || '',
        city: firstSup?.citta || firstSup?.city || '',
        supplies: (() => {
            const set = new Set<string>()
            p.bills?.forEach((b: any) => {
                if (b.cif) set.add(b.cif)
            })
            userSupplies.forEach((s: any) => {
                if (s.cif) set.add(s.cif)
            })
            return Array.from(set).sort()
        })()
    }
}

interface BillStats {
    total: number
    paid: number
    unpaid: number
    totalAmount: number
    unpaidAmount: number
    totalConsumo: number
    last: any
}

