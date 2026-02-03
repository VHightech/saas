import { createClient } from "@/lib/supabase/server"
import { Plus } from "lucide-react"
import Link from "next/link"

export default async function SuperAdminPage() {
    const supabase = await createClient()

    // Fetch all tenants
    const { data: tenants, error } = await supabase
        .from("tenants")
        .select("*")
        .order("created_at", { ascending: false })

    if (error) {
        return <div className="text-red-500">Error loading tenants: {error.message}</div>
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Tenants</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Manage platform organizations</p>
                </div>
                <Link
                    href="/admin/super/new"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
                >
                    <Plus size={18} />
                    New Tenant
                </Link>
            </div>

            <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/10">
                        <tr>
                            <th className="p-4 font-semibold text-slate-700 dark:text-slate-300">Name</th>
                            <th className="p-4 font-semibold text-slate-700 dark:text-slate-300">Slug / Domain</th>
                            <th className="p-4 font-semibold text-slate-700 dark:text-slate-300">Modules</th>
                            <th className="p-4 font-semibold text-slate-700 dark:text-slate-300">Adapter</th>
                            <th className="p-4 font-semibold text-slate-700 dark:text-slate-300">Created At</th>
                            <th className="p-4 font-semibold text-slate-700 dark:text-slate-300 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {tenants?.map((tenant) => (
                            <tr key={tenant.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-8 h-8 rounded flex items-center justify-center text-white font-bold text-xs"
                                            style={{ backgroundColor: tenant.primary_color || '#0ea5e9' }}
                                        >
                                            {tenant.name.substring(0, 1)}
                                        </div>
                                        <div>
                                            <div className="font-medium text-slate-900 dark:text-white">{tenant.name}</div>
                                            {tenant.logo_url && <div className="text-[10px] text-slate-400">Custom Logo Active</div>}
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <div className="text-slate-900 dark:text-white font-mono text-sm">{tenant.slug}</div>
                                    {tenant.domain && <div className="text-xs text-indigo-500 font-mono">{tenant.domain}</div>}
                                </td>
                                <td className="p-4">
                                    <div className="flex gap-1">
                                        {tenant.features?.crm && <span className="bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/20">CRM</span>}
                                        {tenant.features?.invoicing && <span className="bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-500/20">BIL</span>}
                                    </div>
                                </td>
                                <td className="p-4 text-slate-500 dark:text-slate-400 text-xs font-mono">{tenant.adapter}</td>
                                <td className="p-4 text-slate-500 dark:text-slate-400 text-sm">
                                    {new Date(tenant.created_at).toLocaleDateString()}
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex justify-end gap-3">
                                        <Link
                                            href={`/dashboard?tenant=${tenant.slug}`}
                                            className="text-slate-500 hover:text-indigo-600 text-sm font-medium transition-colors"
                                        >
                                            View
                                        </Link>
                                        <button className="text-indigo-600 hover:text-indigo-500 text-sm font-medium">Edit</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {tenants?.length === 0 && (
                    <div className="p-12 text-center text-slate-500">
                        No tenants found. Create one to get started.
                    </div>
                )}
            </div>
        </div>
    )
}
