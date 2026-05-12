'use client'

import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, YAxis, CartesianGrid } from 'recharts'
import { useState, useEffect } from 'react'
import { TrendingUp, ChevronDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useTheme } from 'next-themes'

import { createClient } from '@/lib/supabase/client'

interface ConsumptionChartProps {
    settings?: Record<string, any>
    initialData?: any[]
}

export function ConsumptionChart({ settings = {}, initialData = [] }: ConsumptionChartProps) {
    const chartColor = settings.chart_color || '#0ea5e9'
    const [data, setData] = useState<{ name: string; value: number }[]>([])
    const [loading, setLoading] = useState(true)
    const [activeIndex, setActiveIndex] = useState(0)
    const isDesktop = useMediaQuery("(min-width: 768px)")
    const [mounted, setMounted] = useState(false)

    const supabase = createClient()
    const { theme } = useTheme()
    // Determine unselected color based on theme
    const unselectedColor = theme === 'dark' ? '#334155' : '#e2e8f0'

    useEffect(() => {
        setMounted(true)
        if (initialData && initialData.length > 0) {
            processBills(initialData)
        } else {
            fetchData()
        }
    }, [initialData])

    const processBills = (bills: any[]) => {
        if (bills && bills.length > 0) {
            // Sort bills by date ascending
            const sortedBills = [...bills].sort((a, b) => new Date(a.data_emissione).getTime() - new Date(b.data_emissione).getTime());

            // Map to sparse data (only months present)
            const monthMap = new Map<string, { name: string, value: number, year: number, monthIndex: number }>();

            sortedBills.forEach(bill => {
                const d = new Date(bill.data_emissione);
                const key = `${d.getFullYear()}-${d.getMonth()}`; // Unique Month Key

                if (!monthMap.has(key)) {
                    const monthName = d.toLocaleString('it-IT', { month: 'short' });
                    const formattedName = monthName.charAt(0).toUpperCase() + monthName.slice(1);
                    monthMap.set(key, {
                        name: formattedName,
                        value: 0,
                        year: d.getFullYear(),
                        monthIndex: d.getMonth()
                    });
                }

                const entry = monthMap.get(key)!;
                entry.value += Number(bill.consumo || 0);
            });

            // Convert to array and sort
            const months = Array.from(monthMap.values()).sort((a, b) => {
                if (a.year !== b.year) return a.year - b.year;
                return a.monthIndex - b.monthIndex;
            });

            // Take last 6 AVAILABLE data points
            const finalData = months.slice(-6).map(m => ({ name: m.name, value: m.value }));
            setData(finalData);

            // Default to last item
            setActiveIndex(finalData.length > 0 ? finalData.length - 1 : 0);
        } else {
            setData([])
        }
        setLoading(false)
    }

    const fetchData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase
                .from('profiles')
                .select('id')
                .eq('auth_user_id', user.id)
                .maybeSingle()
            if (!profile?.id) return

            const { data: bills, error } = await supabase
                .from('bills')
                .select('consumo, data_emissione')
                .eq('user_id', profile.id)
                .order('data_emissione', { ascending: true })

            if (bills && bills.length > 0) {
                // Group by month
                const monthNamesShort = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
                const aggregated = new Array(12).fill(0).map((_, i) => ({ name: monthNamesShort[i], value: 0 }));

                bills.forEach(bill => {
                    const date = new Date(bill.data_emissione);
                    const month = date.getMonth(); // 0-11
                    aggregated[month].value += Number(bill.consumo || 0);
                });

                // Filter to show maybe only months with data or first 6 months if strictly following design?
                // Let's show all months that have data, or at least up to the current month?
                // For now, let's just properly map the aggregated data to the chart format.
                // Filter out trailing zero months if desired, or keep fixed structure.
                // The original design had 6 months. Let's just pass the 12 months or simpler:
                // Let's filter to keep non-zero or just the relevant range if needed.
                // User said "real data". If I have 1 bill in Jan, I show Jan.

                // Let's just take the first 6 months of valid data or just raw months?
                // To keep it simple and safe for "Nessuna fattura", we check total.

                const hasData = aggregated.some(d => d.value > 0);
                if (hasData) {
                    // Let's trim to current partial year or just show all non-zero?
                    // Let's show standard Jan-Jun or Jan-Dec based on real data?
                    // Actually, let's just use the months that have data + standard context.
                    // For the sake of the chart looking "full" like the design, usually we show a period.
                    // Let's return the full year or sliced.
                    // If we want to replicate "Gen-Giu", we slice up to current month.
                    const currentMonth = new Date().getMonth();
                    const slicedData = aggregated.slice(0, currentMonth + 1);
                    setData(slicedData);
                    setActiveIndex(slicedData.length - 1);
                } else {
                    setData([]);
                }
            } else {
                setData([])
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    if (!mounted) return <div className="h-full w-full bg-slate-50/50 rounded-3xl animate-pulse" />

    if (loading) {
        return (
            <div className="h-full w-full md:bg-[#D0DEEF]/60 dark:md:bg-[#1e1e1e]/60 md:backdrop-blur-xl md:border md:border-white/40 dark:md:border-white/10 md:rounded-3xl md:p-6 flex items-center justify-center">
                <Loader2 className="animate-spin text-slate-400" />
            </div>
        )
    }

    if (data.length === 0) {
        return (
            <div className="md:bg-[#D0DEEF]/60 dark:md:bg-[#1e1e1e]/60 md:backdrop-blur-xl md:border md:border-white/40 dark:md:border-white/10 w-full md:rounded-3xl md:p-6 md:shadow-sm h-full flex flex-col justify-center items-center text-center relative overflow-hidden transition-colors duration-500">
                <p className="text-slate-500 dark:text-slate-400 font-medium">Nessuna fattura presente</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Non ci sono dati di consumo recenti.</p>
            </div>
        )
    }

    const activeItem = data[activeIndex] || data[data.length - 1]

    // Map for full month names
    const monthNames: Record<string, string> = {
        'Gen': 'Gennaio', 'Feb': 'Febbraio', 'Mar': 'Marzo',
        'Apr': 'Aprile', 'Mag': 'Maggio', 'Giu': 'Giugno',
        'Lug': 'Luglio', 'Ago': 'Agosto', 'Set': 'Settembre',
        'Ott': 'Ottobre', 'Nov': 'Novembre', 'Dic': 'Dicembre'
    }



    // Shared calculations
    const average = data.reduce((acc, curr) => acc + curr.value, 0) / data.length

    // Mobile dynamic stats
    const currentDiff = average !== 0 ? ((activeItem.value - average) / average) * 100 : 0

    // Desktop static stats (current month)
    const currentDesktop = data[data.length - 1].value // Using data for current month
    const percentageDiff = ((currentDesktop - average) / average) * 100

    return (
        <div className="md:bg-[#D0DEEF]/60 dark:md:bg-[#1e1e1e]/60 md:backdrop-blur-xl md:border md:border-white/40 dark:md:border-white/10 w-full md:rounded-3xl md:p-6 md:shadow-sm h-full flex flex-col justify-between relative overflow-hidden transition-colors duration-500">
            {isDesktop && (
                <>
                    {/* Header */}
                    <div className="flex justify-between pb-2 md:pb-4 mb-2 md:mb-4 border-b border-blue-100 dark:border-white/10 z-10">
                        <div className="flex items-center">
                            <div className="w-8 h-8 md:w-12 md:h-12 bg-white dark:bg-white/10 rounded-full flex items-center justify-center me-2 md:me-3 text-[#005A9C] dark:text-white shadow-sm">
                                <TrendingUp size={16} className="md:w-6 md:h-6" />
                            </div>
                            <div>
                                <h5 className="text-lg md:text-2xl font-bold text-slate-800 dark:text-white">{activeItem.value} Mc</h5>
                                <p className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">Consumo {monthNames[activeItem.name] || activeItem.name}</p>
                            </div>
                        </div>
                        <div>
                            <span className={cn(
                                "inline-flex items-center text-[10px] md:text-xs font-bold px-2 py-0.5 md:px-3 md:py-1 rounded-full shadow-sm border whitespace-nowrap",
                                currentDiff > 0
                                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20"
                                    : "bg-red-50 text-red-600 border-red-100"
                            )}>
                                {currentDiff > 0 ? '+' : ''}{currentDiff.toFixed(1)}%
                                <span className="hidden md:inline ml-1 text-[10px] opacity-90 font-medium uppercase tracking-wide whitespace-nowrap">vs Media</span>
                            </span>
                        </div>
                    </div>

                    {/* Sub-stats Grid - Hidden on mobile small view */}
                    <div className="grid grid-cols-2 gap-4 mb-4 z-10">
                        <div className="flex flex-col">
                            <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Media 6 Mesi</dt>
                            <dd className="text-lg font-semibold text-slate-700 dark:text-slate-200">{average.toFixed(1)} Mc</dd>
                        </div>
                        <div className="flex flex-col items-end">
                            <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">Trend</dt>
                            <dd className="text-lg font-semibold text-sky-500 dark:text-sky-400">In Aumento</dd>
                        </div>
                    </div>

                    <div className="flex-1 w-full min-h-[180px] z-10">
                        <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
                            <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-white/60 dark:bg-black/80 backdrop-blur-[50px] border border-white/50 dark:border-white/20 rounded-xl p-3 shadow-xl box-border">
                                                    <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">{label}</p>
                                                    <p className="text-sm font-bold text-slate-800 dark:text-white">
                                                        Consumo : <span className="text-sky-500 dark:text-sky-400">{payload[0].value} Mc</span>
                                                    </p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }}
                                    dy={10}
                                />
                                <Bar
                                    dataKey="value"
                                    radius={[8, 8, 8, 8]}
                                    barSize={28}
                                >
                                    {data.map((entry, index) => {
                                        const isHighlighted = index === activeIndex
                                        return (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={chartColor}
                                                fillOpacity={isHighlighted ? 1 : 0.4}
                                                onClick={() => setActiveIndex(index)}
                                                className="transition-all duration-300 ease-out hover:opacity-100 cursor-pointer"
                                            />
                                        )
                                    })}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </>
            )}

            {/* Mobile Ad-Hoc View (Inspo: iOS "Perfect" Shape) */}
            {!isDesktop && (
                <div className="flex flex-col h-full p-6">
                    {/* Header - Removed 'Statistic' to avoid double header with Accordion Trigger */}


                    {/* Main Stat Block (Floating Card Style effect) */}
                    <div className="mb-6">
                        <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-5xl font-bold text-sky-500 dark:text-sky-400 tracking-tighter">{activeItem.value}</h2>
                            <div className={cn(
                                "px-2.5 py-1 rounded-full text-xs font-bold border",
                                currentDiff > 0 ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20" : "bg-red-50 text-red-600 border-red-100"
                            )}>
                                {currentDiff > 0 ? '+' : ''}{currentDiff.toFixed(0)}%
                            </div>
                        </div>
                        <p className="text-slate-400 dark:text-slate-500 text-sm font-medium whitespace-nowrap">Consumo {monthNames[activeItem.name]}</p>
                    </div>

                    {/* Bar Chart */}
                    <div className="w-full h-[200px] mb-6">
                        <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
                            <BarChart
                                data={data}
                                margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
                                onClick={(e) => {
                                    if (e && typeof e.activeTooltipIndex === 'number') {
                                        setActiveIndex(e.activeTooltipIndex);
                                    }
                                }}
                                onMouseMove={(e) => {
                                    if (e && typeof e.activeTooltipIndex === 'number') {
                                        setActiveIndex(e.activeTooltipIndex);
                                    }
                                }}
                            >
                                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" className="dark:stroke-slate-800" />
                                <Tooltip cursor={{ fill: 'transparent' }} content={() => null} />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                                />
                                <Bar dataKey="value" radius={[6, 6, 6, 6]} barSize={24}>
                                    {data.map((entry, index) => (
                                        <Cell
                                            key={`cell-mobile-${index}`}
                                            fill={chartColor}
                                            fillOpacity={index === activeIndex ? 1 : 0.4}
                                            onClick={() => setActiveIndex(index)}
                                            className="transition-all duration-300 cursor-pointer"
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Stats List (iOS Row Style) */}
                    <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#ff4d00]" />
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Media 6 Mesi</span>
                            </div>
                            <span className="text-sm font-bold text-slate-900 dark:text-white">{average.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-800 dark:bg-slate-400" />
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Trend</span>
                            </div>
                            <span className="text-sm font-bold text-[#005A9C] dark:text-sky-400">In Aumento</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}