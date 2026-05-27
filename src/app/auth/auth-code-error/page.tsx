'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowLeft } from 'lucide-react'

export default function AuthCodeErrorPage() {
    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-[#0a0a0a]">
            <div className="w-full max-w-md bg-white dark:bg-white/[0.04] p-8 rounded-2xl shadow-lg border border-slate-100 dark:border-white/10 text-center">
                <div className="w-16 h-16 bg-rose-50 dark:bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                    <AlertTriangle size={32} />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                    Link non valido o scaduto
                </h1>
                <p className="text-slate-600 dark:text-slate-400 text-sm mb-8 leading-relaxed">
                    Il codice di autenticazione fornito è scaduto, è già stato utilizzato oppure non è valido. Richiedi un nuovo link per accedere.
                </p>
                <div className="space-y-3">
                    <Link
                        href="/login"
                        className="w-full py-3.5 px-6 rounded-xl bg-blue-600 text-white font-semibold shadow-lg hover:shadow-xl hover:bg-blue-700 transition-all duration-200 flex items-center justify-center gap-2"
                    >
                        <ArrowLeft size={16} />
                        Torna al Login
                    </Link>
                </div>
            </div>
        </div>
    )
}
