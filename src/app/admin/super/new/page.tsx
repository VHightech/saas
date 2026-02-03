'use client'

import { createTenant } from "./tenant-actions"
import { useState } from "react"
import { Loader2, ArrowLeft, ArrowRight, Building2, Palette, Database, LayoutDashboard, Check } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ExperienceBuilder } from "@/components/admin/builder/ExperienceBuilder"
import { DataMapper } from "@/components/admin/data-mapper"
import { TenantPreview } from "@/components/admin/tenant-preview"

// Step Definitions
const STEPS = [
    { id: 'identity', label: 'Identity', icon: Building2, description: 'Name & Domain' },
    { id: 'branding', label: 'Branding', icon: Palette, description: 'Look & Feel' },
    { id: 'data', label: 'Data Engine', icon: Database, description: 'Import Strategy' },
    { id: 'experience', label: 'Builder', icon: LayoutDashboard, description: 'Layout & Vis' },
]

export default function NewTenantPage() {
    const [loading, setLoading] = useState(false)
    const [activeStep, setActiveStep] = useState(0)
    const [selectedAdapter, setSelectedAdapter] = useState("standard-csv")
    const [importMapping, setImportMapping] = useState<Record<string, string>>({})
    const [previewData, setPreviewData] = useState<any[]>([])
    const [brandName, setBrandName] = useState("My Tenant")
    const [brandColor, setBrandColor] = useState("#0ea5e9")
    const [brandLogo, setBrandLogo] = useState("")

    const [builderConfig, setBuilderConfig] = useState<any>(null)
    const router = useRouter()

    async function handleSubmit(formData: FormData) {
        setLoading(true)
        const result = await createTenant(formData)

        if (result.error) {
            toast.error(result.error)
            setLoading(false)
        } else {
            toast.success("Tenant created successfully!")
            router.push("/admin/super")
        }
    }

    const currentStep = STEPS[activeStep]
    const isLastStep = activeStep === STEPS.length - 1

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#050505] flex flex-col">

            {/* Top Navigation Bar */}
            <div className="sticky top-0 z-50 bg-white/80 dark:bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-slate-200 dark:border-white/10">
                <div className="max-w-[1920px] mx-auto px-6 py-4">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">

                        {/* Title & Back */}
                        <div className="flex items-center gap-6">
                            <Link href="/admin/super" className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 hover:text-black dark:text-slate-400 dark:hover:text-white transition-colors">
                                <ArrowLeft size={20} />
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Create New Tenant</h1>
                                <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">Configuration Wizard</p>
                            </div>
                        </div>

                        {/* Horizontal Stepper */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 max-w-full no-scrollbar">
                            {STEPS.map((step, index) => {
                                const Icon = step.icon
                                const isActive = activeStep === index
                                const isCompleted = activeStep > index
                                const isFuture = activeStep < index

                                return (
                                    <div key={step.id} className="flex items-center">
                                        <button
                                            onClick={() => isActive || isCompleted ? setActiveStep(index) : null}
                                            className={`flex items-center gap-3 px-4 py-2 rounded-full border transition-all whitespace-nowrap
                                            ${isActive
                                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-500/20 dark:border-indigo-500/30 dark:text-indigo-300 ring-4 ring-indigo-500/5'
                                                    : isCompleted
                                                        ? 'bg-white border-green-200 text-green-700 hover:bg-green-50 dark:bg-transparent dark:border-green-500/30 dark:text-green-400'
                                                        : 'bg-white border-transparent text-slate-400 dark:bg-transparent dark:text-slate-600'
                                                }`}
                                            disabled={isFuture}
                                        >
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold
                                                ${isActive ? 'bg-indigo-600 text-white' : isCompleted ? 'bg-green-500 text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-500'}
                                            `}>
                                                {isCompleted ? <Check size={12} /> : <Icon size={12} />}
                                            </div>
                                            <span className="text-sm font-semibold">{step.label}</span>
                                        </button>

                                        {index < STEPS.length - 1 && (
                                            <div className={`w-8 h-[2px] mx-2 ${isCompleted ? 'bg-green-500/30' : 'bg-slate-200 dark:bg-white/5'}`} />
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {/* Actions (Hidden on mobile, preserved for layout balance) */}
                        <div className="w-[200px] hidden md:block"></div>
                    </div>
                </div>
            </div>

            {/* Main Content Area - Full Width */}
            <div className="flex-1 w-full max-w-[1920px] mx-auto px-6 py-8">
                <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl min-h-[700px] flex flex-col overflow-hidden">

                    <form action={handleSubmit} className="flex-1 flex flex-col">

                        {/* Hidden persisted state */}
                        <input type="hidden" name="builder_config" value={JSON.stringify(builderConfig)} />
                        <input type="hidden" name="import_mapping" value={JSON.stringify(importMapping)} />

                        <div className="flex-1 p-8 md:p-12">
                            {/* ---------------- STEP 1: IDENTITY ---------------- */}
                            <div className={activeStep === 0 ? 'block max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500' : 'hidden'}>
                                <div className="text-center mb-12">
                                    <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-500/10">
                                        <Building2 size={32} />
                                    </div>
                                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">Setup Tenant Identity</h2>
                                    <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">Define the workspace identity, URL slug, and domain settings.</p>
                                </div>
                                <div className="space-y-8">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Company Name</label>
                                        <input
                                            name="name"
                                            type="text"
                                            required
                                            placeholder="e.g. Acme Industries"
                                            onChange={(e) => setBrandName(e.target.value)}
                                            className="w-full px-5 py-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-lg font-medium"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Slug</label>
                                            <div className="flex">
                                                <span className="bg-slate-100 dark:bg-white/5 border border-r-0 border-slate-200 dark:border-white/10 px-4 py-3 rounded-l-xl text-slate-500 text-sm font-mono flex items-center">/</span>
                                                <input name="slug" type="text" required placeholder="acme" className="flex-1 px-4 py-3 rounded-r-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Custom Domain</label>
                                            <input name="domain" type="text" placeholder="portal.acme.com" className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ---------------- STEP 2: BRANDING ---------------- */}
                            <div className={activeStep === 1 ? 'block max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500' : 'hidden'}>
                                <div className="text-center mb-12">
                                    <div className="w-16 h-16 bg-pink-100 text-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-pink-500/10">
                                        <Palette size={32} />
                                    </div>
                                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">Branding & Features</h2>
                                    <p className="text-slate-500 dark:text-slate-400">Customize the look and feel and enable specific modules.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                    <div className="space-y-8">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Brand Color</label>
                                            <div className="p-1 border border-slate-200 dark:border-white/10 rounded-2xl inline-block shadow-sm">
                                                <input
                                                    name="primary_color"
                                                    type="color"
                                                    value={brandColor}
                                                    onChange={(e) => setBrandColor(e.target.value)}
                                                    className="h-24 w-48 rounded-xl cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Logo URL</label>
                                            <input
                                                name="logo_url"
                                                type="url"
                                                placeholder="https://..."
                                                onChange={(e) => setBrandLogo(e.target.value)}
                                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 dark:bg-white/5 p-8 rounded-2xl border border-slate-100 dark:border-white/5">
                                        <h3 className="font-bold text-lg mb-6 text-slate-900 dark:text-white">Active Modules</h3>
                                        <div className="space-y-4">
                                            {['crm', 'invoicing'].map(feature => (
                                                <label key={feature} className="flex items-center gap-4 p-4 bg-white dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-xl cursor-pointer hover:border-indigo-300 transition-colors">
                                                    <input type="checkbox" name={`feature_${feature}`} defaultChecked className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300" />
                                                    <div>
                                                        <span className="block font-bold text-slate-900 dark:text-white capitalize">{feature} Module</span>
                                                        <span className="text-xs text-slate-500">Enable {feature} capabilities for this tenant.</span>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ---------------- STEP 3: DATA ENGINE ---------------- */}
                            <div className={activeStep === 2 ? 'block animate-in fade-in slide-in-from-bottom-4 duration-500' : 'hidden'}>
                                <div className="mb-6 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                                            <Database className="text-emerald-500" /> Data Import Engine
                                        </h2>
                                        <p className="text-slate-500 dark:text-slate-400">Map your CSV columns to standard fields.</p>
                                    </div>
                                    <select
                                        name="adapter"
                                        className="px-4 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={selectedAdapter}
                                        onChange={(e) => setSelectedAdapter(e.target.value)}
                                    >
                                        <option value="standard-csv">Standard CSV</option>
                                        <option value="dynamic-csv">No-Code Mapper</option>
                                    </select>
                                </div>

                                {selectedAdapter === "dynamic-csv" ? (
                                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                                        <div className="xl:col-span-2">
                                            <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-6 border border-slate-200 dark:border-white/10 min-h-[500px]">
                                                <DataMapper
                                                    onChange={setImportMapping}
                                                    onDataPreview={setPreviewData}
                                                    // Full UI with Mapping Cards
                                                    requiredFields={[
                                                        { key: 'amount', label: 'Amount (€)', type: 'currency' },
                                                        { key: 'expiry_date', label: 'Expiry Date', type: 'date' },
                                                        { key: 'cif', label: 'Customer ID (CIF)', type: 'text' },
                                                        { key: 'service_id', label: 'Service ID (POD/PDR)', type: 'text' },
                                                        { key: 'consumption', label: 'Consumption (Smc/Kw)', type: 'number' },
                                                        { key: 'pdf_name', label: 'PDF Filename', type: 'text' }
                                                    ]}
                                                />
                                            </div>
                                        </div>
                                        <div className="xl:col-span-1">
                                            <div className="sticky top-24 h-[600px]">
                                                <TenantPreview
                                                    branding={{
                                                        name: brandName,
                                                        primaryColor: brandColor,
                                                    }}
                                                    mapping={importMapping}
                                                    data={previewData}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center p-20 text-center text-slate-400 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 min-h-[400px]">
                                        <Database size={64} className="mb-6 opacity-20" />
                                        <p className="text-lg font-medium text-slate-600 dark:text-slate-300">Standard CSV Adapter Selected</p>
                                        <p>This uses the default hardcoded ingestion logic.</p>
                                    </div>
                                )}
                            </div>

                            {/* ---------------- STEP 4: EXPERIENCE BUILDER ---------------- */}
                            <div className={activeStep === 3 ? 'block animate-in fade-in slide-in-from-bottom-4 duration-500' : 'hidden'}>
                                <div className="mb-6">
                                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                                        <LayoutDashboard className="text-indigo-500" /> Experience Builder
                                    </h2>
                                    <p className="text-slate-500 dark:text-slate-400">Design the dashboard layout. Data is sourced from the mapped CSV.</p>
                                </div>

                                <ExperienceBuilder
                                    onConfigChange={setBuilderConfig}
                                    initialData={previewData}
                                    initialMapping={importMapping}
                                    branding={{
                                        name: brandName,
                                        color: brandColor,
                                        logoUrl: brandLogo
                                    }}
                                />
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="p-8 border-t border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 flex items-center justify-between backdrop-blur-sm">
                            <button
                                type="button"
                                onClick={() => setActiveStep(prev => Math.max(0, prev - 1))}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-colors ${activeStep === 0
                                    ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                                    : 'text-slate-600 dark:text-slate-300 hover:bg-white hover:shadow-md'
                                    }`}
                                disabled={activeStep === 0}
                            >
                                <ArrowLeft size={18} /> Back
                            </button>

                            {!isLastStep ? (
                                <button
                                    type="button"
                                    onClick={() => setActiveStep(prev => Math.min(STEPS.length - 1, prev + 1))}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all hover:scale-105"
                                >
                                    Continue <ArrowRight size={18} />
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-green-500/20 transition-all hover:scale-105 disabled:opacity-70 disabled:hover:scale-100"
                                >
                                    {loading && <Loader2 className="animate-spin" size={18} />}
                                    {loading ? "Creating..." : "Create Tenant"}
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
