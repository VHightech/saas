import { redirect } from 'next/navigation'
import { AdminLayoutShell } from '@/components/admin/admin-layout-shell'
import { getAdminContext } from '@/lib/auth-checks'

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Single resolution of session + role + permissions. getAdminContext does
    // one getUser() and one profile lookup (with id fallback), and only returns
    // a ctx for administrative roles — so this replaces the previous three
    // sequential auth round-trips (getUser + getCurrentUserRole + getAdminContext).
    const adminCtx = await getAdminContext()
    if (!adminCtx.ctx) {
        redirect(adminCtx.status === 401 ? '/login' : '/profile')
    }

    const { user, role, canInviteAdmins } = adminCtx.ctx
    const userName = user.user_metadata?.full_name || 'Admin'

    // 5. Render Shell with Mobile Restriction
    return (
        <>
            {/* Mobile Blocking Screen */}
            <div className="md:hidden min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-[#1e1e1e] p-8 text-center transition-colors">
                <div className="mb-4 text-red-500 dark:text-red-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Area non disponibile su mobile</h2>
                <p className="text-slate-600 dark:text-slate-400">
                    L'accesso all'area amministrativa è ottimizzato solo per PC Desktop.
                    <br />
                    Ti preghiamo di accedere da un computer.
                </p>
            </div>

            {/* Desktop Admin Interface */}
            <div className="hidden md:block">
                <AdminLayoutShell userName={userName} userRole={role} canInviteAdmins={canInviteAdmins}>
                    {children}
                </AdminLayoutShell>
            </div>
        </>
    )
}
