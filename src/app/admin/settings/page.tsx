'use client'

import { Settings, Bell, Lock, User } from 'lucide-react'

export default function AdminSettingsPage() {
    return (
        <div className="space-y-6">
            <div className="bg-white/40 backdrop-blur-xl p-6 rounded-3xl border border-white/50 shadow-sm">
                <h1 className="text-2xl font-bold text-slate-800">Impostazioni Sistema</h1>
                <p className="text-slate-500 text-sm mt-1">
                    Configura preferenze, notifiche e sicurezza.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white/60 backdrop-blur-md rounded-3xl p-6 border border-white/50 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                            <User size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">Profilo Amministratore</h3>
                            <p className="text-xs text-slate-500">Gestisci i tuoi dati di accesso</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white/60 backdrop-blur-md rounded-3xl p-6 border border-white/50 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                            <Bell size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">Notifiche Email</h3>
                            <p className="text-xs text-slate-500">Configura invio automatico report</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white/60 backdrop-blur-md rounded-3xl p-6 border border-white/50 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                            <Lock size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">Sicurezza</h3>
                            <p className="text-xs text-slate-500">Log di accesso e permessi</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
