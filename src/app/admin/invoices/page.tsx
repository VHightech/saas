'use client'

import { FileText, Search, Filter } from 'lucide-react'

export default function AdminInvoicesPage() {
    return (
        <div className="space-y-6">
            <div className="bg-white/40 backdrop-blur-xl p-6 rounded-3xl border border-white/50 shadow-sm">
                <h1 className="text-2xl font-bold text-slate-800">Registro Fatture Globale</h1>
                <p className="text-slate-500 text-sm mt-1">
                    Visualizza tutte le fatture emesse nel sistema, indipendentemente dall'utente.
                </p>
            </div>

            <div className="bg-white/60 backdrop-blur-md rounded-3xl border border-white/50 shadow-sm p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                    <FileText size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-700">Sezione in Sviluppo</h3>
                <p className="text-slate-500 max-w-md mx-auto mt-2">
                    Qui troverai l'elenco completo di tutte le fatture caricate nel sistema, con filtri per data, importo e stato pagamento.
                </p>
            </div>
        </div>
    )
}
