'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { 
    Ghost, Search, ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal, X, 
    Printer, Download, Check, Pencil, Key, Copy,
    TrendingUp, Calendar, User, Mail, Hash, MapPin, Map, CreditCard, Activity 
} from 'lucide-react'
import { resetUserPassword } from './actions'
import { createClient } from '@/lib/supabase/client'
import { AdminPageHero } from '@/components/admin/admin-page-hero'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface UserProfile {
    id: string
    fullName: string
    email: string
    cfpi: string
    clientCode: string
    isShadow: boolean
    cif: string
    address: string
    city: string
    unpaidAmount?: number
    billsCount?: number
    suppliesCount?: number
}

function initialsOf(name: string) {
    const parts = (name || 'U').trim().split(/\s+/)
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'U'
}

function formatEuro(n: number) {
    return `${n.toFixed(2).replace('.', ',')} €`
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
    const [activeUserId, setActiveUserId] = useState<string | null>(null)
    const [activeBills, setActiveBills] = useState<any[]>([])
    const [activeBillsLoading, setActiveBillsLoading] = useState(false)
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'shadow'>('all')
    const [sortBy, setSortBy] = useState<'created_at' | 'name'>('created_at')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }
    const toggleSelectAll = () => {
        setSelected(prev => prev.size === users.length ? new Set() : new Set(users.map(u => u.id)))
    }
    const clearSelection = () => setSelected(new Set())
    const toggleSort = (key: string) => {
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
    }, [debouncedSearchTerm, currentPage, itemsPerPage, statusFilter, sortBy, sortOrder])

    async function fetchUsers() {
        setLoading(true)
        try {
            if (debouncedSearchTerm) {
                const { data, error } = await supabase.rpc('search_users', {
                    search_term: debouncedSearchTerm,
                    _limit: itemsPerPage,
                    _offset: (currentPage - 1) * itemsPerPage,
                })
                if (error) throw error
                if (data) {
                    const filtered = data.filter((p: any) => !['admin', 'super_admin', 'superadmin'].includes(p.role))
                    setUsers(filtered.map(adapt))
                    setTotalResults(filtered[0]?.total_count || 0)
                }
            } else {
                let query = supabase
                    .from('profiles')
                    .select('*, bills(count), user_supplies(count)', { count: 'exact' })
                    .not('role', 'in', '("admin","super_admin","superadmin")')

                if (statusFilter === 'active') query = query.eq('is_shadow', false)
                if (statusFilter === 'shadow') query = query.eq('is_shadow', true)

                const { data, count, error } = await (
                    ['name', 'created_at'].includes(sortBy)
                        ? query.order(sortBy, { ascending: sortOrder === 'asc' })
                        : query
                ).range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1)

                if (error) throw error
                if (data) {
                    let adapted = data.map(adapt)
                    // If we sorted by count, we'll do it locally for the current page for now
                    if (!['name', 'created_at'].includes(sortBy)) {
                        adapted = adapted.sort((a, b) => {
                            const valA = sortBy === 'user_supplies_count' ? (a.suppliesCount || 0) : (a.billsCount || 0)
                            const valB = sortBy === 'user_supplies_count' ? (b.suppliesCount || 0) : (b.billsCount || 0)
                            return sortOrder === 'asc' ? valA - valB : valB - valA
                        })
                    }
                    setUsers(adapted)
                    setTotalResults(count || 0)
                }
            }

            // Aggregate stats (independent of pagination)
            const { data: allProfiles } = await supabase
                .from('profiles')
                .select('id, name, email, is_shadow, role')
                .not('role', 'in', '("admin","super_admin","superadmin")')

            if (allProfiles) {
                const shadow = allProfiles.filter((p: any) => p.is_shadow || !p.email || !p.name).length
                setShadowCount(shadow)
                setActiveCount(allProfiles.length - shadow)
            }
        } catch (e: any) {
            console.error('Error fetching users:', e?.message || e)
        } finally {
            setLoading(false)
        }
    }

    const handleRowClick = (userId: string) => {
        setActiveUserId(prev => prev === userId ? null : userId)
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
        ;(async () => {
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
            cfpi: 'cfpi',
            cif: 'cif',
            clientCode: 'codice_cliente',
            address: 'address',
            city: 'city',
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
        
        const headers = ['Nome', 'Email', 'CF/PIVA', 'Codice Cliente', 'Indirizzo', 'Città']
        const csvContent = [
            headers.join(','),
            ...selectedUsers.map(u => [
                `"${u.fullName}"`,
                `"${u.email}"`,
                `"${u.cfpi}"`,
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
                        const niceMax = (v) => { const e = Math.pow(10, Math.floor(Math.log10(v))); return Math.ceil(v / e) * e }
                        const yMax = niceMax(maxImporto * 1.15)

                        const n = dataPoints.length
                        const stepX = n > 1 ? innerW / (n - 1) : 0
                        const getX = (i) => padL + (n > 1 ? i * stepX : innerW / 2)
                        const getYImp = (v) => padT + innerH - (v * innerH / yMax)
                        const getYCon = (v) => padT + innerH - (v * innerH / Math.max(maxConsumo, 1))

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
                                            <span class="pill-value mono">${u.cfpi || u.cif || '—'}</span>
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
                subtitle={`${stats.total} clienti${stats.shadow > 0 ? ` · ${stats.shadow} utenze fantasma` : ''}`}
            />

            <div className="h-full flex flex-col gap-3 min-h-0 px-0">
                {/* Body grid: table + right rail */}
                <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-0">
                    {/* Main content column */}
                    <div className="flex flex-col min-h-0">
                        {/* Filter chips moved inside the grid for perfect alignment with table/footer */}
                        <div className="flex items-center gap-2 shrink-0 flex-wrap px-6 py-2 bg-white dark:bg-[#0F1115]">
                            <div className="relative group">
                                <FilterChip 
                                    label={`Stato${statusFilter !== 'all' ? `: ${statusFilter === 'active' ? 'Attivo' : 'Fantasma'}` : ''}`} 
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
                                            {s === 'all' ? 'Tutti' : s === 'active' ? 'Attivi' : 'Fantasma'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="relative group">
                                <FilterChip 
                                    label={`Ordina per: ${
                                        sortBy === 'created_at' ? 'Data' : 
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
                                    placeholder="Cerca per nome o codice fiscale…"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full h-8 pl-8 pr-3 rounded-md bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[12px] text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-slate-300 dark:focus:border-white/20 transition-all"
                                />
                            </div>
                        </div>

                        <div ref={tableRef} className="flex-1 min-h-0 overflow-auto custom-scrollbar">
                            {/* Header */}
                            <div className="sticky top-0 z-10 grid grid-cols-[48px_minmax(0,1.6fr)_minmax(0,2fr)_minmax(0,1.4fr)_64px_64px_28px] gap-3 px-6 py-2 bg-white dark:bg-[#0F1115] text-[10px] font-semibold tracking-[0.12em] uppercase text-slate-400 dark:text-slate-500 border-t border-slate-200/70 dark:border-white/5">
                                <div className="flex items-center justify-center">
                                    <Checkbox checked={allSelected} indeterminate={!allSelected && selected.size > 0} onChange={toggleSelectAll} />
                                </div>
                                <div className="flex items-center gap-1">Cliente</div>
                                <div>Identificativi</div>
                                <div>Indirizzo</div>
                                <div 
                                    className="text-center flex items-center justify-center gap-1 cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 transition-colors group/h"
                                    onClick={() => toggleSort('user_supplies_count')}
                                >
                                    Forn.
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
                                            onClick={() => handleRowClick(u.id)}
                                            onDoubleClick={() => router.push(`/admin/users/${u.id}`)}
                                            className={cn(
                                                'group grid grid-cols-[48px_minmax(0,1.6fr)_minmax(0,2fr)_minmax(0,1.4fr)_64px_64px_28px] gap-3 items-center px-6 py-3 cursor-pointer transition-colors',
                                                isActive
                                                    ? 'bg-slate-100 dark:bg-white/[0.06]'
                                                    : isSel
                                                        ? 'bg-slate-100/70 dark:bg-white/[0.04]'
                                                        : 'hover:bg-slate-100/50 dark:hover:bg-white/[0.02]'
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
                                                <div
                                                    className={cn(
                                                        'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0',
                                                        u.isShadow
                                                            ? 'bg-sky-100 dark:bg-sky-500/15 text-sky-500 dark:text-sky-300'
                                                            : 'bg-[#0A2540] text-white'
                                                    )}
                                                >
                                                    {u.isShadow ? <Ghost size={13} strokeWidth={2} /> : initialsOf(u.fullName)}
                                                </div>
                                                <span className={cn(
                                                    'text-[13px] truncate font-medium',
                                                    u.isShadow ? 'text-slate-500 dark:text-slate-400' : 'text-slate-800 dark:text-white'
                                                )}>
                                                    {u.fullName}
                                                </span>
                                            </div>

                                            {/* Identificativi (copy-able) */}
                                            <div className="flex flex-wrap gap-1 min-w-0">
                                                {(u.cif || u.cfpi) && (
                                                    <CodeBadge value={u.cif || u.cfpi} label={u.cif ? 'CIF' : (/^\d{11}$/.test(u.cfpi) ? 'P.IVA' : 'CF')} copyable />
                                                )}
                                                {u.email && (
                                                    <CodeBadge value={u.email} label="EMAIL" copyable />
                                                )}
                                                {u.clientCode && (
                                                    <CodeBadge value={u.clientCode} label="CODICE CLIENTE" copyable />
                                                )}
                                                {!u.cif && !u.cfpi && !u.email && !u.clientCode && (
                                                    <span className="text-[12px] text-slate-300 dark:text-slate-600">—</span>
                                                )}
                                            </div>

                                            {/* Address */}
                                            <div className="text-[12px] text-slate-500 dark:text-slate-400 truncate">
                                                {[u.address, u.city].filter(Boolean).join(', ') || '—'}
                                            </div>

                                            {/* Supplies */}
                                            <div className="text-center text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                                                {u.suppliesCount ?? 0}
                                            </div>

                                            {/* Bills */}
                                            <div className="text-center text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                                                {u.billsCount ?? 0}
                                            </div>


                                            {/* Row spacing placeholder */}
                                            <div />
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

                    {/* Right rail — stats by default; user detail when row is selected */}
                    <aside className="hidden xl:flex flex-col gap-3 min-h-0 overflow-auto custom-scrollbar pr-1">
                        {activeUser ? (
                            <UserDetailPanel
                                user={activeUser}
                                billStats={activeBillStats}
                                billsLoading={activeBillsLoading}
                                onClose={() => setActiveUserId(null)}
                                onViewMore={handleViewMore}
                                onSave={updateActiveUserField}
                            />
                        ) : (
                            <>
                            <div className="space-y-6">
                                {/* Insoluto Card */}
                                <div className="bg-white dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-2xl p-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-slate-400">Insoluto totale</p>
                                    </div>
                                    <p className={cn(
                                        "text-[26px] font-bold tracking-tight leading-none",
                                        stats.unpaid > 0 ? "text-rose-600 dark:text-rose-500" : "text-slate-900 dark:text-white"
                                    )}>
                                        {stats.unpaid > 0 ? formatEuro(stats.unpaid) : '—'}
                                    </p>
                                    <p className="text-[11px] text-slate-400 font-medium mt-2">
                                        {stats.unpaidUsers > 0 ? `${stats.unpaidUsers} clienti in arretrato` : 'Nessuna pendenza'}
                                    </p>
                                </div>

                                {/* Status Card */}
                                <div className="bg-white dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-2xl p-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-slate-400">Distribuzione Clienti</p>
                                    </div>
                                    <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-100 dark:bg-white/5 mb-4">
                                        <div style={{ width: `${(stats.active / (stats.total || 1)) * 100}%` }} className="bg-emerald-500" />
                                        <div style={{ width: `${(stats.shadow / (stats.total || 1)) * 100}%` }} className="bg-amber-500" />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-[12px]">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                <span className="text-slate-600 dark:text-slate-400 font-medium">Attivi</span>
                                            </div>
                                            <span className="text-slate-900 dark:text-white font-bold">{stats.active}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-[12px]">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                                <span className="text-slate-600 dark:text-slate-400 font-medium">Fantasmi</span>
                                            </div>
                                            <span className="text-slate-900 dark:text-white font-bold">{stats.shadow}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Summary Card */}
                                <div className="bg-white dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-2xl p-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-slate-400">Panoramica Global</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                        <div>
                                            <p className="text-[18px] font-bold text-slate-900 dark:text-white">{stats.total}</p>
                                            <p className="text-[9px] font-bold uppercase text-slate-400 mt-0.5">Totale</p>
                                        </div>
                                        <div>
                                            <p className="text-[18px] font-bold text-indigo-600 dark:text-indigo-400">100%</p>
                                            <p className="text-[9px] font-bold uppercase text-slate-400 mt-0.5">Compliance</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            </>
                        )}
                    </aside>
                </div>
            </div>

            {/* Floating selection bar */}
            {selected.size > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    {/* Independent Close Button */}
                    <button
                        onClick={clearSelection}
                        className="w-10 h-10 flex items-center justify-center bg-[#1A1F2A] hover:bg-red-500/20 hover:text-red-400 text-white rounded-xl shadow-2xl border border-white/10 transition-all group"
                        title="Annulla selezione"
                    >
                        <X size={18} className="transition-transform group-hover:rotate-90" />
                    </button>

                    {/* Main Actions Bar */}
                    <div className="bg-[#1A1F2A] text-white rounded-xl shadow-2xl border border-white/10 flex items-stretch overflow-hidden divide-x divide-white/10 h-10">
                        <div className="px-4 flex items-center text-[12px] whitespace-nowrap border-r border-white/10">
                            <span className="text-white/60 font-medium uppercase tracking-wider text-[9px]">Selezionati</span>
                            <span className="text-white font-bold ml-2 bg-white/10 px-1.5 py-0.5 rounded text-[11px] min-w-[20px] text-center">{selected.size}</span>
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
    return {
        id: p.id,
        fullName: p.name || 'Utente non registrato',
        email: p.email || '',
        cfpi: p.cfpi || '',
        address: p.address || '',
        city: p.city || '',
        clientCode: p.codice_cliente || '',
        isShadow: p.is_shadow || !p.email || !p.name,
        cif: p.cif || '',
        billsCount: typeof p.bills_count === 'number' ? p.bills_count : (p.bills?.[0]?.count || 0),
        suppliesCount: typeof p.user_supplies_count === 'number' ? p.user_supplies_count : (p.user_supplies?.[0]?.count || 0),
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

function DetailMetric({ value, label, icon: Icon, colorClass }: { value: string; label: string; icon?: any; colorClass?: string }) {
    return (
        <div className="flex flex-col p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5">
            <div className="flex items-center justify-between mb-2">
                {Icon && <Icon size={14} className="text-slate-400" />}
            </div>
            <div className={cn("text-[15px] font-bold tracking-tight text-slate-900 dark:text-white leading-none", colorClass)}>
                {value}
            </div>
            <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400 mt-2">
                {label}
            </div>
        </div>
    )
}

function DetailField({ label, value, icon: Icon, editing, onChange, type = 'text', mono }: { label: string; value: string; icon: any; editing: boolean; onChange: (v: string) => void; type?: string; mono?: boolean }) {
    return (
        <div className="flex flex-col gap-1.5 px-1">
            <div className="flex items-center gap-2">
                {Icon && <Icon size={12} className="text-slate-400" />}
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
            </div>
            {editing ? (
                <input
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full h-8 px-3 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[12px] text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500/50 transition-all"
                />
            ) : (
                <div className={cn(
                    "text-[13px] font-semibold text-slate-700 dark:text-slate-200 pl-5",
                    mono && "font-mono"
                )}>
                    {value || '—'}
                </div>
            )}
        </div>
    )
}

const PROFILE_FIELDS = [
    { key: 'fullName', label: 'Nome completo', placeholder: '' },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'clientCode', label: 'Codice cliente', mono: true },
    { key: 'address', label: 'Indirizzo' },
    { key: 'city', label: 'Città' },
] as const

function UserDetailPanel({
    user,
    billStats,
    billsLoading,
    onClose,
    onViewMore,
    onSave,
}: {
    user: UserProfile
    billStats: BillStats
    billsLoading: boolean
    onClose: () => void
    onViewMore: () => void
    onSave: (field: string, value: string) => Promise<void> | void
}) {
    const [editing, setEditing] = useState(false)
    const [drafts, setDrafts] = useState<Record<string, string>>({})
    const [saving, setSaving] = useState(false)

    // Reset drafts when user or edit mode changes
    useEffect(() => {
        setDrafts({})
        setEditing(false)
    }, [user.id])

    const getValue = (key: string) => {
        if (editing && drafts[key] !== undefined) return drafts[key]
        const v = (user as any)[key]
        if (key === 'fullName' && v === 'Utente non registrato') return ''
        return v ?? ''
    }

    const setDraft = (key: string, v: string) => {
        setDrafts(prev => ({ ...prev, [key]: v }))
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            for (const [key, value] of Object.entries(drafts)) {
                if (value !== (user as any)[key]) {
                    await onSave(key, value)
                }
            }
            setDrafts({})
            setEditing(false)
            toast.success('Profilo aggiornato')
        } catch (err: any) {
            console.error('Error saving profile:', err)
            toast.error('Errore durante il salvataggio')
        } finally {
            setSaving(false)
        }
    }

    const cancelEdit = () => {
        setDrafts({})
        setEditing(false)
    }

    const fmt = (n: number) => {
        try {
            return `${(n || 0).toFixed(2).replace('.', ',')} €`
        } catch {
            return '0,00 €'
        }
    }

    const [lastDate, setLastDate] = useState('—')
    useEffect(() => {
        if (billStats.last?.data_emissione) {
            try {
                const d = new Date(billStats.last.data_emissione)
                if (!isNaN(d.getTime())) {
                    setLastDate(d.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' }))
                }
            } catch (e) {
                console.error('Date formatting error:', e)
            }
        } else {
            setLastDate('—')
        }
    }, [billStats.last])

    return (
        <div className="bg-white dark:bg-[#1A1D23] rounded-xl border border-slate-200/70 dark:border-white/5 flex flex-col">
            {/* Header / Identity */}
            <div className="px-6 py-6 border-b border-slate-100 dark:border-white/5 flex flex-col items-center text-center bg-slate-50/30 dark:bg-white/[0.01]">
                <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-xl font-bold mb-4 border border-indigo-100/50 dark:border-indigo-500/20">
                    {initialsOf(user.fullName)}
                </div>
                <h3 className="text-[18px] font-bold tracking-tight text-slate-900 dark:text-white leading-tight mb-1">
                    {user.fullName}
                </h3>
                <div className="flex items-center gap-2">
                    <span className={cn(
                        "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                        user.isShadow 
                            ? "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400 border border-sky-100 dark:border-sky-500/20"
                            : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20"
                    )}>
                        {user.isShadow ? 'Fantasma' : 'Attivo'}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                        ID: <span className="font-mono text-slate-600 dark:text-slate-300">{user.clientCode}</span>
                    </span>
                </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar p-6 space-y-8">
                {/* Profile Data */}
                <section className="space-y-6">
                    <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-slate-400 mb-2 flex items-center gap-2">
                        <User size={12} className="text-indigo-500" />
                        Dettagli Anagrafici
                    </p>
                    <div className="space-y-5">
                        {PROFILE_FIELDS.map((f) => {
                            let icon = User
                            if (f.key === 'email') icon = Mail
                            if (f.key === 'address') icon = MapPin
                            if (f.key === 'city') icon = Map
                            if (f.key === 'codice_cliente') icon = Hash

                            return (
                                <DetailField
                                    key={f.key}
                                    label={f.label}
                                    value={getValue(f.key)}
                                    icon={icon}
                                    editing={editing}
                                    onChange={(v) => setDraft(f.key, v)}
                                    type={(f as any).type}
                                    mono={(f as any).mono}
                                />
                            )
                        })}
                        <DetailField
                            label={user.cif ? 'P.IVA / CIF' : 'Codice Fiscale'}
                            value={editing && drafts.__cf !== undefined ? drafts.__cf : (user.cif || user.cfpi)}
                            icon={CreditCard}
                            editing={editing}
                            onChange={(v) => setDraft(user.cif ? 'cif' : 'cfpi', v)}
                            mono
                        />
                    </div>
                </section>
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01]">
                {editing ? (
                    <div className="h-10 flex items-center bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 h-full flex items-center justify-center gap-2.5 px-4 hover:bg-slate-50 dark:hover:bg-white/10 transition-all text-slate-900 dark:text-white disabled:opacity-50"
                        >
                            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                {saving ? (
                                    <div className="w-3 h-3 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                                ) : (
                                    <Check size={12} strokeWidth={3} />
                                )}
                            </div>
                            <span className="text-[13px] font-bold tracking-tight">Salva modifiche</span>
                        </button>
                        <div className="w-px h-5 bg-slate-200 dark:bg-white/10" />
                        <button
                            onClick={cancelEdit}
                            disabled={saving}
                            className="group/x w-12 h-full flex items-center justify-center transition-all text-slate-400 dark:text-slate-500 disabled:opacity-50"
                            title="Annulla"
                        >
                            <X size={16} strokeWidth={2.5} className="group-hover/x:text-red-500 group-hover/x:rotate-90 transition-all duration-300" />
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setEditing(true)}
                            className="h-10 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 text-[13px] font-bold flex items-center justify-center gap-2.5 hover:bg-slate-50 dark:hover:bg-white/10 transition-all active:scale-[0.98]"
                        >
                            <div className="w-6 h-6 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shadow-sm">
                                <Pencil size={11} strokeWidth={3} />
                            </div>
                            Modifica
                        </button>
                        <button
                            onClick={() => onViewMore()}
                            className="h-10 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 text-[13px] font-bold flex items-center justify-center hover:bg-slate-50 dark:hover:bg-white/10 transition-all active:scale-[0.98]"
                        >
                            Vai a scheda
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
function FieldRow({
    label,
    value,
    editing,
    type = 'text',
    mono,
    icon,
    onChange,
}: {
    label: string
    value: string
    editing: boolean
    type?: string
    mono?: boolean
    icon?: React.ReactNode
    onChange: (v: string) => void
}) {
    return (
        <div className="group/field">
            <div className="flex items-center gap-1.5 mb-0.5">
                <div className="text-slate-300 dark:text-slate-600">
                    {icon}
                </div>
                <p className="text-[9px] font-bold tracking-widest uppercase text-slate-400">{label}</p>
            </div>
            {editing ? (
                <input
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={cn(
                        'w-full h-7 px-2 rounded-md bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[12px] text-slate-800 dark:text-white outline-none focus:border-indigo-500 transition-all',
                        mono && 'font-mono'
                    )}
                />
            ) : (
                <div className={cn(
                    'min-h-[28px] px-2 py-1 rounded-md bg-slate-50/30 dark:bg-white/[0.01] flex items-center',
                    !value && 'opacity-60'
                )}>
                    <p className={cn(
                        'text-[12px] text-slate-700 dark:text-slate-200 font-medium truncate',
                        mono && 'font-mono text-[11px] tracking-tight',
                        !value && 'italic text-slate-400'
                    )}>
                        {value || '—'}
                    </p>
                </div>
            )}
        </div>
    )
}

function Checkbox({ checked, indeterminate, onChange }: { checked: boolean; indeterminate?: boolean; onChange: () => void }) {
    return (
        <button
            onClick={(e) => { e.stopPropagation(); onChange() }}
            className={cn(
                'w-4 h-4 rounded border flex items-center justify-center transition-colors',
                checked || indeterminate
                    ? 'bg-[#0A2540] border-[#0A2540] text-white'
                    : 'bg-white dark:bg-white/5 border-slate-300 dark:border-white/15 hover:border-slate-400'
            )}
        >
            {indeterminate ? (
                <span className="w-2 h-0.5 bg-white" />
            ) : checked ? (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            ) : null}
        </button>
    )
}







function SelectionAction({ icon, label, onClick }: { icon: React.ReactNode; label?: string | null; onClick?: () => void }) {
    return (
        <button 
            onClick={onClick}
            className="h-10 px-3 hover:bg-white/5 flex items-center gap-1.5 text-[12px] text-white/80 hover:text-white transition-colors whitespace-nowrap"
        >
            {icon}
            {label}
        </button>
    )
}

function FilterChip({ label, badge, active, onClear }: { label: string; badge?: number | null; active?: boolean; onClear?: () => void }) {
    return (
        <button
            className={cn(
                'h-8 px-4 rounded-full text-[13px] font-medium flex items-center gap-2 transition-all duration-200 group/f',
                active
                    ? 'bg-black text-white border-transparent'
                    : 'bg-white dark:bg-white/5 border border-dashed border-slate-300 dark:border-white/20 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-white/40'
            )}
        >
            <span className="flex items-center gap-1.5">
                {label}
                {active && onClear && (
                    <div 
                        role="button"
                        onClick={(e) => { e.stopPropagation(); onClear() }}
                        className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-white/20 -mr-1 transition-colors"
                    >
                        <X size={11} />
                    </div>
                )}
            </span>
            {badge != null && (
                <span className={cn(
                    'text-[11px] ml-0.5 font-bold',
                    active ? 'text-slate-400' : 'text-slate-400'
                )}>
                    {badge}
                </span>
            )}
            <ChevronDown 
                size={14} 
                className={cn(
                    'transition-transform duration-200',
                    active ? 'text-white/60' : 'text-slate-400'
                )} 
            />
        </button>
    )
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


