'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { ChevronDown } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useMediaQuery } from '@/hooks/use-media-query'

import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

// Helper to aggregate data
const processBillData = (bills: any[]) => {
    const yearsSet = new Set<string>();
    const monthlyDataByYear: Record<string, number[]> = {};

    bills.forEach(bill => {
        if (!bill.data_emissione) return;
        const date = new Date(bill.data_emissione);
        const year = date.getFullYear().toString();
        yearsSet.add(year);

        if (!monthlyDataByYear[year]) {
            monthlyDataByYear[year] = new Array(12).fill(0);
        }
        const month = date.getMonth(); // 0-11
        monthlyDataByYear[year][month] += Number(bill.consumo || 0);
    });

    const sortedYears = Array.from(yearsSet).sort();

    // 1. "Tutti" Dataset (Yearly Totals)
    const tuttiData = sortedYears.map(year => {
        const total = monthlyDataByYear[year].reduce((a, b) => a + b, 0);
        return { label: year, consumption: total };
    });

    // 2. Per-Year Datasets (Monthly)
    const datasets: Record<string, { label: string, consumption: number }[]> = {
        'Tutti': tuttiData
    };

    const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

    sortedYears.forEach(year => {
        datasets[year] = monthlyDataByYear[year].map((val, idx) => ({
            label: monthNames[idx],
            consumption: val
        }));
    });

    return datasets;
}

interface ExpensesTrendChartProps {
    bills?: any[]
    className?: string
}

export function ExpensesTrendChart({ bills: externalBills, className }: ExpensesTrendChartProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [period, setPeriod] = useState('Tutti');
    const isDesktop = useMediaQuery("(min-width: 768px)")
    const [mounted, setMounted] = useState(false)
    const [dataSets, setDataSets] = useState<Record<string, { label: string, consumption: number }[]> | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeIndex, setActiveIndex] = useState(0)

    const supabase = createClient()

    useEffect(() => {
        setMounted(true)
        if (externalBills) {
            if (externalBills.length > 0) {
                const processed = processBillData(externalBills)
                setDataSets(processed)
                // Default to 'Tutti' or latest year? Stick to 'Tutti' for overview.
            } else {
                setDataSets(null)
            }
            setLoading(false)
        } else {
            fetchData()
        }
    }, [externalBills])

    const fetchData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: bills } = await supabase
                .from('bills')
                .select('consumo, data_emissione')
                .eq('user_id', user.id)

            if (bills && bills.length > 0) {
                const processed = processBillData(bills)
                setDataSets(processed)
            } else {
                setDataSets(null)
            }
        } catch (e) {
            console.error(e)
            setDataSets(null)
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

    if (!dataSets) {
        return (
            <div className="md:bg-white/30 dark:md:bg-[#1e1e1e]/60 md:backdrop-blur-xl md:border md:border-white/40 dark:md:border-white/10 w-full md:rounded-3xl md:p-6 md:shadow-sm h-full flex flex-col justify-center items-center text-center relative overflow-hidden transition-colors duration-500">
                <h3 className="font-bold text-slate-800 dark:text-white text-lg mb-2">Andamento Consumi</h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium">Nessuna fattura presente</p>
            </div>
        )
    }

    const toggleDropdown = () => setIsOpen(!isOpen);

    const handleSelect = (value: string) => {
        setPeriod(value);
        setIsOpen(false);
    };

    const currentData = dataSets[period] || Object.values(dataSets)[0];

    // Ensure activeIndex is valid for current data
    const safeActiveIndex = activeIndex < currentData.length ? activeIndex : currentData.length - 1;
    const activeData = currentData[safeActiveIndex];

    // Calculate summary metrics
    const totalConsumption = currentData.reduce((acc, curr) => acc + curr.consumption, 0);
    const averageConsumption = Math.round(totalConsumption / currentData.filter(d => d.consumption > 0).length || 1);


    if (!mounted) return <div className={`h-full w-full bg-slate-50/50 rounded-3xl animate-pulse ${className}`} />

    return (
        <div className={`md:bg-white/30 dark:md:bg-[#1e1e1e]/60 md:backdrop-blur-xl md:border md:border-white/40 dark:md:border-white/10 md:rounded-3xl md:p-6 h-full flex flex-col relative overflow-visible md:shadow-sm transition-colors duration-500 ${className}`}>
            <div className="flex justify-end md:justify-between items-start mb-2 z-20">
                <div className="hidden md:block">
                    <h3 className="font-bold text-slate-800 dark:text-white text-lg">Andamento Consumi</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Generale</p>
                </div>
                <div className="relative">
                    <button
                        onClick={toggleDropdown}
                        className="text-xs bg-white/50 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/20 px-3 py-1 font-semibold rounded-full text-slate-600 dark:text-slate-200 cursor-pointer flex items-center transition-colors shadow-sm"
                    >
                        {period} <ChevronDown className={`inline w-3 h-3 ml-1 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isOpen && (
                        <div className="absolute right-0 top-full mt-2 w-32 bg-white/90 dark:bg-[#1e1e1e]/90 backdrop-blur-md rounded-xl shadow-lg border border-white/50 dark:border-white/10 py-1 overflow-hidden z-50">
                            {Object.keys(dataSets).map((option) => (
                                <button
                                    key={option}
                                    onClick={() => handleSelect(option)}
                                    className={`w-full text-left px-4 py-2 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors ${period === option ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-slate-600 dark:text-slate-300'}`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Summary Metrics removed */}

            {/* Desktop Chart View */}
            {isDesktop && (
                <div className="flex-1 w-full min-h-0 z-10 hidden md:block">
                    <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
                        <AreaChart
                            data={currentData}
                            margin={{
                                top: 5,
                                right: 30,
                                left: 30,
                                bottom: 0,
                            }}
                        >
                            <defs>
                                <linearGradient id="colorConsumption" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.6} />
                                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.2)" />
                            <XAxis
                                dataKey="label"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                                dy={10}
                                interval={0}
                            />
                            <YAxis type="number" hide />
                            <Tooltip
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                        const value = payload[0].value as number;
                                        const diff = value - averageConsumption;
                                        const diffPercent = ((diff / averageConsumption) * 100).toFixed(1);

                                        return (
                                            <div className="bg-white/60 dark:bg-black/80 backdrop-blur-[50px] border border-white/50 dark:border-white/20 rounded-xl p-3 shadow-xl box-border min-w-[140px]">
                                                <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold mb-1 uppercase tracking-wide">{label}</p>
                                                <div className="flex items-baseline gap-1 mb-2">
                                                    <p className="text-2xl font-bold text-slate-800 dark:text-white">{value.toLocaleString()}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">Mc</p>
                                                </div>
                                                <div className="pt-2 border-t border-slate-200/60 dark:border-white/10">
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-slate-500 dark:text-slate-400">Media periodo:</span>
                                                        <span className="font-semibold text-slate-700 dark:text-slate-300">{averageConsumption}</span>
                                                    </div>
                                                    <div className={`text-xs font-semibold mt-1 flex items-center ${diff > 0 ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                        {diff > 0 ? '+' : ''}{diffPercent}%
                                                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 ml-1 font-normal">vs media</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                                cursor={{ stroke: '#818cf8', strokeWidth: 1, strokeDasharray: '4 4' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="consumption"
                                stroke="#818cf8"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorConsumption)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Mobile Ad-Hoc View */}
            {!isDesktop && (
                <div className="md:hidden flex flex-col gap-4 mt-2">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/40 dark:bg-white/5 rounded-2xl p-3 border border-white/20 dark:border-white/10 transition-all duration-300">
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mb-1">Periodo</p>
                            <p className="text-lg font-bold text-slate-800 dark:text-white">{activeData.label}</p>
                        </div>
                        <div className="bg-white/40 dark:bg-white/5 rounded-2xl p-3 border border-white/20 dark:border-white/10 transition-all duration-300">
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mb-1">Consumo</p>
                            <p className="text-lg font-bold text-[#005A9C] dark:text-sky-400">{activeData.consumption.toLocaleString()} Mc</p>
                        </div>
                    </div>

                    <div className="h-[150px] w-full bg-white/30 dark:bg-white/5 rounded-2xl p-2 border border-white/20 dark:border-white/10">
                        <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
                            <AreaChart
                                data={currentData}
                                onClick={(e: any) => {
                                    if (e && typeof e.activeTooltipIndex === 'number') {
                                        setActiveIndex(e.activeTooltipIndex);
                                    }
                                }}
                                onMouseMove={(e: any) => {
                                    if (e && typeof e.activeTooltipIndex === 'number') {
                                        setActiveIndex(e.activeTooltipIndex);
                                    }
                                }}
                                onTouchMove={(e: any) => {
                                    if (e && typeof e.activeTooltipIndex === 'number') {
                                        setActiveIndex(e.activeTooltipIndex);
                                    }
                                }}
                            >
                                <defs>
                                    <linearGradient id="colorMobile" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.5} />
                                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Tooltip
                                    content={() => null} // Hide default tooltip, using custom cards above
                                    cursor={{ stroke: '#818cf8', strokeWidth: 1, strokeDasharray: '4 4' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="consumption"
                                    stroke="#818cf8"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorMobile)"
                                    activeDot={{ r: 6, fill: "#005A9C", stroke: "white", strokeWidth: 2 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    )
}
