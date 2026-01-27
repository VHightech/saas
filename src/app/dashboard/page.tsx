import { UserWidget } from '@/components/dashboard/widgets/UserWidget'
import { ConsumptionChart } from '@/components/dashboard/widgets/ConsumptionChart'
import { RecentBillsWidget } from '@/components/dashboard/widgets/RecentBillsWidget'
import { ExpensesTrendChart } from '@/components/dashboard/widgets/ExpensesTrendChart'
import { MobileCollapsibleCard } from '@/components/dashboard/MobileCollapsibleCard'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let profile = null
    let bills: any[] = []

    if (user) {
        const profileQuery = supabase.from('profiles').select('*').eq('id', user.id).single()
        const billsQuery = supabase.from('bills').select('consumo, data_emissione').eq('user_id', user.id).order('data_emissione', { ascending: true })

        const [profileRes, billsRes] = await Promise.all([profileQuery, billsQuery])
        profile = profileRes.data
        bills = billsRes.data || []
    }

    // Dynamic Data Helpers
    const fullName = (profile?.name && profile?.surname)
        ? `${profile.name} ${profile.surname}`
        : (profile?.full_name || profile?.user_name || 'Utente')
    const firstName = profile?.name || fullName.split(' ')[0]
    const clientCode = profile?.codice_cliente || profile?.client_code || 'N/A'

    // Calculate Consumption Stats
    let lastConsumption = 0
    let trendLabel = 'Dati insufficienti'
    let trendColor = 'text-slate-500 dark:text-slate-400'
    let percentageBadge = null

    if (bills.length > 0) {
        // Sort by date just to be safe (though query did it)
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
            ) // Invert colors? Higher consumption usually bad (Red), Lower good (Green). Original design had Green for +32%. Let's stick to generic or Context. 
            // Actually usually + Consumption is Red/Warning in util apps. But let's stick to design: green for now or as is.
            // Wait, previous design had +32% in Green. I will stick to Green for positive for now or Neutral.
            // Let's use the same logic as the component: + is usually 'In Aumento'.
        }

        // Trend Text
        trendLabel = 'Trend Stabile' // Placeholder calculation
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 fade-in-up">

            {/* Left Column Group (User, Consumption, Expenses) */}
            <div className="xl:col-span-2 space-y-6">
                {/* Top Row: User & Consumption */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="h-full">
                        <MobileCollapsibleCard
                            title={
                                <div className="flex flex-col items-start leading-tight">
                                    <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Bentornato,</span>
                                    <span className="text-slate-900 dark:text-white text-2xl font-bold">{firstName}!</span>
                                </div>
                            }
                            className="h-full"
                            defaultOpen={false}
                            headerContent={
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{fullName}</span>
                                    <span className="text-xs text-slate-400">•</span>
                                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{clientCode}</span>
                                </div>
                            }
                        >
                            <UserWidget />
                        </MobileCollapsibleCard>
                    </div>
                    <div className="h-full">
                        <MobileCollapsibleCard
                            title="Consumo Medio Mensile"
                            className="h-full"
                            headerContent={
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl font-bold text-slate-900 dark:text-white">{lastConsumption > 0 ? `${lastConsumption} Mc` : 'Nessun dato'}</span>
                                    {percentageBadge}
                                </div>
                            }
                        >
                            <ConsumptionChart />
                        </MobileCollapsibleCard>
                    </div>
                </div>

                {/* Bottom Row: Expenses Trend */}
                <div className="h-auto md:h-[300px]">
                    <MobileCollapsibleCard
                        title="Grafico Consumi"
                        className="h-full"
                        defaultOpen={false}
                        headerContent={
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Ultimi 5 Anni</span>
                                <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                                <span className="text-sm font-bold text-slate-600 dark:text-slate-400">{bills.length > 0 ? 'Vedi dettagli' : 'Nessun dato'}</span>
                            </div>
                        }
                    >
                        <ExpensesTrendChart />
                    </MobileCollapsibleCard>
                </div>
            </div>

            {/* Right Column Group (Recent Bills - Maximized Space) */}
            <div className="xl:col-span-2 h-[calc(100vh-140px)] max-h-[700px]">
                <RecentBillsWidget />
            </div>

        </div>
    )
}
