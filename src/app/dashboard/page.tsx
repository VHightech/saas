import { createClient } from '@/lib/supabase/server'
import { getUserDashboardData } from '@/actions/user-data'
import { DashboardRenderer } from "@/components/dashboard/dashboard-renderer"
import { DashboardLayout } from "@/components/admin/dashboard-builder"
import { headers } from "next/headers"
import { getCurrentUserRole } from "@/lib/auth"

export default async function DashboardPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const role = await getCurrentUserRole()


    const { profile, bills, error } = await getUserDashboardData()

    if (error) {
        console.error('Error loading dashboard data:', error)
    }

    // MOCK DATA INJECTION for testing - FORCED FOR DEMO
    if (bills && bills.length === 0) {
        console.log('[Dashboard] Injecting mock data for test user.');

        // Supply 1: Home (ULM: H501Z)
        const cif1 = 'VOLMAT90A01H501Z'
        const ulm1 = 'H501Z' // Last 6 chars

        // Supply 2: Office (ULM: X999Y) 
        const cif2 = 'VOLMAT90A01X999Y'
        const ulm2 = 'X999Y'

        bills.push(
            // --- SUPPLY 1 (Home) ---
            {
                id: 2024001,
                data_emissione: '2024-01-15',
                scadenza: '2024-02-15',
                importo: 145.50,
                consumo: 120,
                nome_pdf: '20260010194',
                cif: cif1,
                codice_cliente: '854125',
                ulm: ulm1,
                billing_type: 'S'
            },
            {
                id: 2024002,
                data_emissione: '2024-03-15',
                scadenza: '2024-04-15',
                importo: 132.20,
                consumo: 110,
                nome_pdf: '20260010195',
                cif: cif1,
                codice_cliente: '854125',
                ulm: ulm1,
                billing_type: 'A'
            },
            {
                id: 2024003,
                data_emissione: '2024-05-15',
                scadenza: '2024-06-15',
                importo: 98.40,
                consumo: 85,
                nome_pdf: '20260010196',
                cif: cif1,
                codice_cliente: '854125',
                ulm: ulm1,
                billing_type: 'S'
            },
            {
                id: 2024004,
                data_emissione: '2024-07-15',
                scadenza: '2024-08-15',
                importo: 210.80,
                consumo: 180, // High summer usage
                nome_pdf: '20260010197',
                cif: cif1,
                codice_cliente: '854125',
                ulm: ulm1,
                billing_type: 'A'
            },
            {
                id: 2024005,
                data_emissione: '2024-09-15',
                scadenza: '2024-10-15',
                importo: 155.30,
                consumo: 130,
                nome_pdf: '20260010198',
                cif: cif1,
                codice_cliente: '854125',
                ulm: ulm1,
                billing_type: 'S'
            },
            {
                id: 2024006,
                data_emissione: '2024-11-15',
                scadenza: '2024-12-15',
                importo: 142.10,
                consumo: 118,
                nome_pdf: '20260010199',
                cif: cif1,
                codice_cliente: '854125',
                ulm: ulm1,
                billing_type: 'A'
            },

            // --- SUPPLY 2 (Office - Lower consumption) ---
            {
                id: 2024007,
                data_emissione: '2024-02-10',
                scadenza: '2024-03-10',
                importo: 45.20,
                consumo: 12,
                nome_pdf: '20260020150',
                cif: cif2,
                codice_cliente: '854125',
                ulm: ulm2,
                billing_type: 'S'
            },
            {
                id: 2024008,
                data_emissione: '2024-04-10',
                scadenza: '2024-05-10',
                importo: 48.90,
                consumo: 15,
                nome_pdf: '20260020151',
                cif: cif2,
                codice_cliente: '854125',
                ulm: ulm2,
                billing_type: 'A'
            },
            {
                id: 2024009,
                data_emissione: '2024-06-10',
                scadenza: '2024-07-10',
                importo: 42.50,
                consumo: 10,
                nome_pdf: '20260020152',
                cif: cif2,
                codice_cliente: '854125',
                ulm: ulm2,
                billing_type: 'S'
            },
            {
                id: 2024010,
                data_emissione: '2024-08-10',
                scadenza: '2024-09-10',
                importo: 38.00,
                consumo: 5, // Closed in August
                nome_pdf: '20260020153',
                cif: cif2,
                codice_cliente: '854125',
                ulm: ulm2,
                billing_type: 'A'
            },
            {
                id: 2024011,
                data_emissione: '2024-10-10',
                scadenza: '2024-11-10',
                importo: 52.10,
                consumo: 18,
                nome_pdf: '20260020154',
                cif: cif2,
                codice_cliente: '854125',
                ulm: ulm2,
                billing_type: 'S'
            },
            {
                id: 2024012,
                data_emissione: '2024-12-10',
                scadenza: '2025-01-10',
                importo: 55.40,
                consumo: 20,
                nome_pdf: '20260020155',
                cif: cif2,
                codice_cliente: '854125',
                ulm: ulm2,
                billing_type: 'S'
            }
        );
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

    if (bills && bills.length > 0) {
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

    if (role === 'admin') {
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

    // 4. Manual Layout (Single Tenant)
    const rawLayout = null // No longer fetching from DB

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
    const isPrivate = role === 'admin'
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
            bills={bills || []}
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
