import { createClient } from '@/lib/supabase/server'
import { DashboardRenderer } from "@/components/dashboard/dashboard-renderer"
import { DashboardLayout } from "@/components/admin/dashboard-builder"
import { headers } from "next/headers"
import { getCurrentUserRole } from "@/lib/auth"

export default async function DashboardPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const role = await getCurrentUserRole()

    let profile = null
    let bills: any[] = []

    if (user) {
        const [profileRes, billsRes] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', user.id).single(),
            supabase.from('bills').select('*').eq('user_id', user.id).order('data_emissione', { ascending: true })
        ])

        profile = profileRes.data
        bills = billsRes.data || []

        // MOCK DATA INJECTION for testing
        if (user.email === 'matteo.volterrani@valdelsahightech.com' && bills.length === 0) {
            console.log('[Dashboard] Injecting mock data for test user.');
            bills = [
                {
                    id: 20250001,
                    data_emissione: '2025-07-15',
                    scadenza: '2025-08-15',
                    importo: 48.50,
                    consumo: 18,
                    nome_pdf: '202507_Bolletta.pdf',
                    cif: profile?.cif || 'VOLMAT90A01H501Z',
                    codice_cliente: profile?.codice_cliente || '854125'
                },
                {
                    id: 20250002,
                    data_emissione: '2025-08-15',
                    scadenza: '2025-09-15',
                    importo: 52.30,
                    consumo: 21,
                    nome_pdf: '202508_Bolletta.pdf',
                    cif: profile?.cif || 'VOLMAT90A01H501Z',
                    codice_cliente: profile?.codice_cliente || '854125'
                },
                {
                    id: 20250003,
                    data_emissione: '2025-09-15',
                    scadenza: '2025-10-15',
                    importo: 65.10,
                    consumo: 24,
                    nome_pdf: '202509_Bolletta.pdf',
                    cif: profile?.cif || 'VOLMAT90A01H501Z',
                    codice_cliente: profile?.codice_cliente || '854125'
                },
                {
                    id: 20250004,
                    data_emissione: '2025-10-15',
                    scadenza: '2025-11-15',
                    importo: 89.90,
                    consumo: 32,
                    nome_pdf: '202510_Bolletta.pdf',
                    cif: profile?.cif || 'VOLMAT90A01H501Z',
                    codice_cliente: profile?.codice_cliente || '854125'
                },
                {
                    id: 20250005,
                    data_emissione: '2025-11-15',
                    scadenza: '2025-12-15',
                    importo: 112.45,
                    consumo: 38,
                    nome_pdf: '202511_Bolletta.pdf',
                    cif: profile?.cif || 'VOLMAT90A01H501Z',
                    codice_cliente: profile?.codice_cliente || '854125'
                },
                {
                    id: 20250006,
                    data_emissione: '2025-12-15',
                    scadenza: '2026-01-15',
                    importo: 95.80,
                    consumo: 35,
                    nome_pdf: '202512_Bolletta.pdf',
                    cif: profile?.cif || 'VOLMAT90A01H501Z',
                    codice_cliente: profile?.codice_cliente || '854125'
                }
            ];
        }

        // If not a customer profile, try admin profile
        if (!profile && (role === 'admin' || role === 'super_admin')) {
            const { data: adminData } = await supabase
                .from('tenant_admins')
                .select('full_name, email')
                .eq('id', user.id)
                .single()

            if (adminData) {
                profile = {
                    full_name: adminData.full_name,
                    email: adminData.email,
                    is_admin: true
                }
            } else if (user.user_metadata?.full_name || user.user_metadata?.display_name) {
                // Fallback to Auth metadata if not in tenant_admins
                profile = {
                    full_name: user.user_metadata.full_name || user.user_metadata.display_name,
                    email: user.email,
                    is_admin: true
                }
            } else if (role === 'super_admin') {
                // Last resort for super admins
                profile = {
                    full_name: 'Super Administrator',
                    email: user.email,
                    is_admin: true
                }
            }
        }
    }

    // Dynamic Data Helpers
    const fullName = (profile?.name && profile?.surname)
        ? `${profile.name} ${profile.surname}`
        : (profile?.denominazione || profile?.full_name || profile?.name || profile?.username || 'Utente')
    const firstName = profile?.name || profile?.first_name || fullName.split(' ')[0]
    const clientCode = profile?.codice_cliente || profile?.client_code || 'N/A'
    const fiscalCode = profile?.cif || profile?.cfpi || profile?.fiscal_code || 'N/A'
    const address = profile?.indirizzo || profile?.address || 'Nessun indirizzo'
    const email = profile?.email || 'N/A'

    // Calculate Consumption Stats
    let lastConsumption = 0
    let trendLabel = 'Dati insufficienti'
    let trendColor = 'text-slate-500 dark:text-slate-400'
    let percentageBadge = null

    if (bills.length > 0) {
        const sortedBills = [...bills].sort((a, b) => new Date(a.data_emissione).getTime() - new Date(b.data_emissione).getTime())
        const lastBill = sortedBills[sortedBills.length - 1]
        lastConsumption = Number(lastBill.consumo || 0)

        if (sortedBills.length >= 2) {
            const prevBill = sortedBills[sortedBills.length - 2]
            const prevConsumption = Number(prevBill.consumo || 0)
            const diff = prevConsumption > 0 ? ((lastConsumption - prevConsumption) / prevConsumption) * 100 : 0

            const isPositive = diff > 0
            percentageBadge = (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isPositive ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
                    {isPositive ? '+' : ''}{diff.toFixed(1)}%
                </span>
            )
        }
        trendLabel = 'Trend Stabile' // Placeholder calculation
    }

    // Admin Data
    let uploads: any[] = []
    let adminStats = {
        totalUsers: 0,
        totalBills: 0,
        storageUsed: '0 GB',
        activeSessions: 0
    }

    if (role === 'admin' || role === 'super_admin') {
        const { data: logs } = await supabase
            .from('import_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5)
        uploads = logs || []

        // Mock Stats for now (Real ones would require aggregate queries)
        adminStats = {
            totalUsers: 142,
            totalBills: 850,
            storageUsed: '2.4 GB',
            activeSessions: 12
        }
    }

    // 4. Fetch Tenant Layout from DB
    const headersList = await headers()
    const tenantSlug = headersList.get('x-tenant-slug') || 'default'

    const { data: tenantData } = await supabase
        .from('tenants')
        .select('dashboard_layout')
        .eq('slug', tenantSlug)
        .single()

    const rawLayout = tenantData?.dashboard_layout

    // Default Fallbacks
    const defaultAdminLayout: DashboardLayout = {
        left: ['user_widget', 'consumption_chart', 'expenses_chart'],
        right: ['recent_bills']
    }
    const defaultUserLayout: DashboardLayout = {
        left: ['user_widget', 'consumption_chart', 'expenses_chart'],
        right: ['recent_bills']
    }

    // Determine Logic
    const isPrivate = role === 'admin' || role === 'super_admin'
    const targetKey = isPrivate ? 'admin' : 'user'

    let finalLayout: DashboardLayout = isPrivate ? defaultAdminLayout : defaultUserLayout

    if (rawLayout) {
        // Handle Legacy (Single Layout)
        if ('left' in rawLayout) {
            finalLayout = rawLayout as DashboardLayout
        }
        // Handle Role-Based (Dual Layout)
        else if (targetKey in rawLayout) {
            finalLayout = rawLayout[targetKey] as DashboardLayout
        }
    }

    // 5. Render via Configuration Engine
    return (
        <DashboardRenderer
            layout={finalLayout}
            profile={profile}
            bills={bills}
            stats={{
                lastConsumption,
                percentageBadge,
                fullName,
                firstName,
                clientCode,
                fiscalCode,
                address,
                email
            }}
            adminStats={adminStats}
            uploads={uploads}
        />
    )
}
