import { verifyOtp } from '@/app/auth/verify-2fa/actions'

export default function Verify2FAPage() {
    return (
        <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-gradient-to-br from-white to-[var(--color-secondary)]">

            <div className="glass-heavy w-full max-w-md p-8 rounded-2xl relative z-10 animate-in fade-in zoom-in duration-500">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--color-secondary)] mb-4 text-[var(--color-primary)]">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shield-check"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /><path d="m9 12 2 2 4-4" /></svg>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">Verifica 2FA</h1>
                    <p className="text-slate-600">Inserisci il codice a 6 cifre inviato al tuo dispositivo.</p>
                </div>

                <form className="space-y-6">
                    <div className="flex justify-center gap-2">
                        {/* Simple single input for now, ideally separate boxes or refined input */}
                        <input
                            name="token"
                            type="text"
                            maxLength={6}
                            placeholder="000000"
                            className="w-full text-center text-3xl tracking-[1em] font-mono py-4 rounded-xl bg-white/50 border border-white/60 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] transition-all placeholder:text-slate-300 text-slate-800"
                            autoComplete="one-time-code"
                        />
                    </div>

                    <button
                        formAction={verifyOtp}
                        className="w-full py-3.5 px-6 rounded-xl bg-[var(--color-primary)] text-white font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200"
                    >
                        Verifica
                    </button>
                </form>

                <div className="mt-8 text-center text-sm">
                    <button className="text-slate-500 hover:text-[var(--color-primary)] transition-colors">
                        Non hai ricevuto il codice? Invia di nuovo
                    </button>
                </div>
            </div>
        </div>
    )
}
