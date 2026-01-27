import { Shield, Smartphone, CreditCard } from 'lucide-react'

export function UserCard() {
    return (
        <div className="glass-heavy rounded-2xl p-6 sm:p-8 mb-8 animate-in slide-in-from-bottom duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Dettagli Utenza</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Informazioni personali e amministrative</p>
                </div>
                <div className="mt-4 md:mt-0 inline-flex items-center px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold border border-green-200 dark:border-green-800">
                    <Shield size={14} className="mr-1" /> Account Verificato
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-white/60 dark:border-slate-700 hover:bg-white/70 dark:hover:bg-slate-800/70 transition-colors group">
                    <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1 uppercase tracking-wider">Codice Fiscale</p>
                    <div className="flex items-center justify-between">
                        <span className="font-mono text-slate-700 dark:text-slate-200 font-medium">RSSMRA80A...</span>
                        <span className="text-[var(--color-primary)] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-xs font-bold">MOSTRA</span>
                    </div>
                </div>

                <div className="p-4 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-white/60 dark:border-slate-700 hover:bg-white/70 dark:hover:bg-slate-800/70 transition-colors">
                    <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1 uppercase tracking-wider flex items-center">
                        <Smartphone size={12} className="mr-1" /> Telefono (2FA)
                    </p>
                    <span className="font-mono text-slate-700 dark:text-slate-200 font-medium">+39 3** *** 1234</span>
                </div>

                <div className="p-4 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-white/60 dark:border-slate-700 hover:bg-white/70 dark:hover:bg-slate-800/70 transition-colors">
                    <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1 uppercase tracking-wider flex items-center">
                        <CreditCard size={12} className="mr-1" /> Codice Cliente
                    </p>
                    <span className="font-mono text-[var(--color-primary)] font-bold text-lg">123456</span>
                </div>
            </div>
        </div>
    )
}
