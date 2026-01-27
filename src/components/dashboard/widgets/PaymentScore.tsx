'use client'

export function PaymentScore() {
    return (
        <div className="bg-white/60 backdrop-blur-xl border border-white/40 rounded-3xl p-6 h-full flex flex-col justify-between items-center text-center shadow-sm">
            <div className="flex w-full justify-between items-center mb-4">
                <h3 className="font-bold text-slate-800 text-lg">Affidabilità</h3>
                <span className="text-xs font-semibold text-slate-400 hover:text-[#005A9C] cursor-pointer">Vedi Dettagli</span>
            </div>

            <div className="relative w-48 h-24 overflow-hidden mt-2">
                <div className="absolute top-0 left-0 w-48 h-48 rounded-full border-[16px] border-slate-100 border-b-0"></div>
                <div className="absolute top-0 left-0 w-48 h-48 rounded-full border-[16px] border-[#F59E0B] border-t-transparent border-r-transparent border-l-transparent rotate-[135deg] transition-all duration-1000 ease-out" style={{ transform: 'rotate(135deg)' }}></div>

                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 text-center translate-y-2">
                    <h2 className="text-5xl font-bold text-slate-800">1620</h2>
                    <p className="text-sm text-[#10B981] font-bold mt-1">Eccellente</p>
                </div>
            </div>

            <button className="bg-[#E5F0FF] text-[#005A9C] px-8 py-3 rounded-xl text-sm font-bold hover:bg-blue-100 transition-colors mt-6 w-full">
                Esplora Benefici
            </button>
        </div>
    )
}
