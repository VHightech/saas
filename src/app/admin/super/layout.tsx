import { requireSuperAdmin } from "@/lib/auth"
import { ShieldCheck, LayoutDashboard, PlusCircle, Users } from "lucide-react"
import Link from "next/link"

export default async function SuperAdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // 1. Enforce Security Check
    await requireSuperAdmin()

    return (
        <>
            {children}
        </>
    )
}
