'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export function PrivacyBackButton() {
    const router = useRouter()
    return (
        <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors mb-8"
        >
            <ArrowLeft size={16} /> Indietro
        </button>
    )
}
