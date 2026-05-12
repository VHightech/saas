'use client'

import { ComposedChart, Line, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { ChevronDown, Loader2, TrendingUp, Euro } from 'lucide-react'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useMediaQuery } from '@/hooks/use-media-query'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

interface ExpensesTrendChartProps {
    bills?: any[]
    className?: string
}

const ChartSync = ({ active, payload, onUpdate }: any) => {
    useEffect(() => {
        if (active && payload && payload.length) {
            onUpdate(payload[0].payload);
        }
    }, [active, payload, onUpdate]);

    return null;
};

export function ExpensesTrendChart({ bills: externalBills, className }: ExpensesTrendChartProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [period, setPeriod] = useState('Tutti');
    const isDesktop = useMediaQuery("(min-width: 768px)")
    const [mounted, setMounted] = useState(false)
    const [allData, setAllData] = useState<{ label: string, fullDate: string, consumption: number, price: number, year: string, uniqueKey: string }[] | null>(null)
    const [years, setYears] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [activeIndex, setActiveIndex] = useState(0)

    const supabase = createClient()

    // Filter Data based on selection
    const currentData = useMemo(() => {
        if (!allData) return [];
        return period === 'Tutti' ? allData : allData.filter(d => d.year === period);
    }, [allData, period]);

    useEffect(() => {
        if (currentData && currentData.length > 0) {
            setActiveIndex(currentData.length - 1);
        }
    }, [currentData]);

    const handleSync = useCallback((item: any) => {
        const idx = currentData.findIndex(d => d.uniqueKey === item.uniqueKey);
        if (idx !== -1) {
            setActiveIndex((prev) => (prev !== idx ? idx : prev));
        }
    }, [currentData]);

    useEffect(() => {
        setMounted(true)
        if (externalBills) {
            processData(externalBills)
            setLoading(false)
        } else {
            fetchData()
        }
    }, [externalBills])

    const processData = (rawBills: any[]) => {
        if (!rawBills || rawBills.length === 0) {
            setAllData(null)
            return
        }

        // 1. Sort by Date Ascending
        const sorted = [...rawBills].sort((a, b) => {
            return new Date(a.data_emissione).getTime() - new Date(b.data_emissione).getTime()
        })

        // 2. Extract Years
        const uniqueYears = Array.from(new Set(sorted.map(b => new Date(b.data_emissione).getFullYear().toString()))).sort()
        setYears(uniqueYears)

        // 3. Map to Chart Format with Year
        const mapped = sorted.map((b, i) => ({
            label: b.data_emissione ? format(new Date(b.data_emissione), 'dd/MM/yy', { locale: it }) : '',
            fullDate: b.data_emissione ? format(new Date(b.data_emissione), 'dd MMMM yyyy', { locale: it }) : '',
            consumption: Number(b.consumo || 0),
            price: Number(b.importo || 0),
            year: new Date(b.data_emissione).getFullYear().toString(),
            uniqueKey: `${b.data_emissione}_${b.id || i}` // Unique key for XAxis
        }))

        setAllData(mapped)
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

            const { data: bills } = await supabase
                .from('bills')
                .select('id, consumo, importo, data_emissione')
                .eq('user_id', profile.id)
                .order('data_emissione', { ascending: true })

            if (bills) processData(bills)
        } catch (e) {
            console.error(e)
            setAllData(null)
        } finally {
            setLoading(false)
        }
    }

    if (!mounted) return <div className="h-full w-full bg-slate-50/50 rounded-3xl animate-pulse" />

    if (loading) {
        return (
            <div className="h-full w-full md:bg-white/30 dark:md:bg-[#1e1e1e]/60 md:backdrop-blur-xl md:border md:border-white/40 dark:md:border-white/10 md:rounded-3xl md:p-6 flex items-center justify-center">
                <Loader2 className="animate-spin text-slate-400" />
            </div>
        )
    }

    if (!allData || allData.length === 0) {
        return (
            <div className={`md:bg-white/30 dark:md:bg-[#1e1e1e]/60 md:backdrop-blur-xl md:border md:border-white/40 dark:md:border-white/10 w-full md:rounded-3xl md:p-6 md:shadow-sm h-full flex flex-col justify-center items-center text-center relative overflow-hidden transition-colors duration-500 ${className}`}>
                <h3 className="font-bold text-slate-800 dark:text-white text-lg mb-2">Andamento Spese & Consumi</h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium">Nessuna fattura presente</p>
            </div>
        )
    }

    const toggleDropdown = () => setIsOpen(!isOpen);

    const handleSelect = (value: string) => {
        setPeriod(value);
        setIsOpen(false);
    };


    // Interactive Data for Mobile
    const safeActiveIndex = activeIndex < currentData.length ? activeIndex : currentData.length - 1;
    const activeData = currentData[safeActiveIndex];

    return (
        <div className={`md:bg-white/30 dark:md:bg-[#1e1e1e]/60 md:backdrop-blur-xl md:border md:border-white/40 dark:md:border-white/10 md:rounded-3xl md:p-6 h-full flex flex-col relative overflow-visible md:shadow-sm transition-colors duration-500 ${className}`}>
            <div className="flex justify-between items-start mb-2 z-20">
                <div>
                    <h3 className="font-bold text-slate-800 dark:text-white text-lg">Costi & Consumi</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Andamento Storico</p>
                </div>
                <div className="relative">
                    <button
                        onClick={toggleDropdown}
                        className="text-xs bg-white/50 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/20 px-3 py-1 font-semibold rounded-full text-slate-600 dark:text-slate-200 cursor-pointer flex items-center transition-colors shadow-sm border border-slate-200 dark:border-white/5"
                    >
                        {period} <ChevronDown className={`inline w-3 h-3 ml-1 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isOpen && (
                        <div className="absolute right-0 top-full mt-2 w-32 bg-white/90 dark:bg-[#1e1e1e]/90 backdrop-blur-md rounded-xl shadow-lg border border-white/50 dark:border-white/10 py-1 overflow-hidden z-50">
                            <button
                                onClick={() => handleSelect('Tutti')}
                                className={`w-full text-left px-4 py-2 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors ${period === 'Tutti' ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-slate-600 dark:text-slate-300'}`}
                            >
                                Tutti
                            </button>
                            {years.map((year) => (
                                <button
                                    key={year}
                                    onClick={() => handleSelect(year)}
                                    className={`w-full text-left px-4 py-2 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors ${period === year ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-slate-600 dark:text-slate-300'}`}
                                >
                                    {year}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Desktop Chart View */}
            {isDesktop && (
                <div className="flex-1 w-full min-h-0 z-10 hidden md:block">
                    <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
                        <ComposedChart
                            data={currentData}
                            margin={{
                                top: 5,
                                right: 10,
                                left: 10,
                                bottom: 0,
                            }}
                        >
                            <defs>
                                <linearGradient id="colorConsumption" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.2)" />

                            <XAxis
                                dataKey="uniqueKey"
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(value, index) => currentData[index] ? currentData[index].label : ''}
                                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }}
                                dy={10}
                                interval="preserveStartEnd"
                            />

                            {/* Left Axis: Consumption */}
                            <YAxis
                                yAxisId="left"
                                type="number"
                                hide
                                domain={[0, 'auto']}
                            />

                            {/* Right Axis: Price */}
                            <YAxis
                                yAxisId="right"
                                orientation="right"
                                type="number"
                                hide
                                domain={[0, 'auto']}
                            />

                            <Tooltip
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                        const consumption = payload.find(p => p.dataKey === 'consumption')?.value as number;
                                        const price = payload.find(p => p.dataKey === 'price')?.value as number;
                                        const fullDate = payload[0].payload.fullDate;

                                        return (
                                            <div className="bg-white dark:bg-[#1e1e1e] border border-slate-100 dark:border-white/10 rounded-xl p-3 shadow-lg box-border min-w-[140px]">
                                                <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold mb-2 uppercase tracking-wide border-b border-slate-100 dark:border-white/10 pb-1">{fullDate}</p>

                                                <div className="flex items-center justify-between gap-4 mb-1">
                                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Importo</span>
                                                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">€ {(price || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-4">
                                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Consumo</span>
                                                    <span className="text-sm font-bold text-indigo-500 dark:text-indigo-400">{consumption?.toLocaleString()} Mc</span>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                                cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
                                isAnimationActive={false}
                            />

                            {/* Consumption Area (Background) */}
                            <Area
                                yAxisId="left"
                                type="monotone"
                                dataKey="consumption"
                                stroke="#818cf8"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorConsumption)"
                                isAnimationActive={true}
                                activeDot={{ r: 6, strokeWidth: 0, fill: "#818cf8" }}
                            />

                            {/* Price Line (Foreground) */}
                            <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="price"
                                stroke="#10b981" // Emerald 500
                                strokeWidth={3}
                                dot={{ r: 4, strokeWidth: 2, stroke: "#10b981", fill: "white" }}
                                activeDot={{ r: 6, strokeWidth: 0, fill: "#10b981" }}
                                isAnimationActive={true}
                            />

                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Mobile Ad-Hoc View */}
            {!isDesktop && (
                <div className="md:hidden flex flex-col gap-4 mt-2">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/40 dark:bg-white/5 rounded-2xl p-3 border border-white/20 dark:border-white/10 transition-all duration-300">
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mb-1">Importo</p>
                            <div className="flex items-center gap-2">
                                <Euro size={18} className="text-emerald-500" />
                                {(() => {
                                    const rawPrice = activeData?.price;
                                    const safePrice = (typeof rawPrice === 'number' && !isNaN(rawPrice)) ? rawPrice : 0;
                                    return (
                                        <p className="text-lg font-bold text-slate-800 dark:text-white">{safePrice.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
                                    )
                                })()}
                            </div>
                        </div>
                        <div className="bg-white/40 dark:bg-white/5 rounded-2xl p-3 border border-white/20 dark:border-white/10 transition-all duration-300">
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mb-1">Consumo</p>
                            <div className="flex items-center gap-2">
                                <TrendingUp size={18} className="text-indigo-500" />
                                <p className="text-lg font-bold text-slate-800 dark:text-white">{activeData.consumption.toLocaleString()} Mc</p>
                            </div>
                        </div>
                    </div>

                    <div className="h-[180px] w-full bg-white/30 dark:bg-white/5 rounded-2xl p-2 border border-white/20 dark:border-white/10">
                        <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
                            <ComposedChart
                                data={currentData}
                                margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                            >
                                <defs>
                                    <linearGradient id="colorMobile" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.5} />
                                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />

                                <XAxis
                                    dataKey="label"
                                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                                    axisLine={false}
                                    tickLine={false}
                                    interval="preserveStartEnd"
                                    dy={10}
                                />
                                <YAxis yAxisId="left" hide />
                                <YAxis yAxisId="right" orientation="right" hide />

                                <Tooltip
                                    content={(props) => <ChartSync {...props} onUpdate={handleSync} />}
                                    cursor={{ stroke: '#818cf8', strokeWidth: 1, strokeDasharray: '4 4' }}
                                />
                                <Area
                                    yAxisId="left"
                                    type="monotone"
                                    dataKey="consumption"
                                    stroke="#818cf8"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorMobile)"
                                />
                                <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="price"
                                    stroke="#10b981"
                                    strokeWidth={2}
                                    dot={false}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    )
}
