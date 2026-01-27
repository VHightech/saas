'use client'

import { useState } from 'react'
import { FileText, Download, Eye, Calendar, X, Droplets, Euro } from 'lucide-react'

// Updated mock data based on the screenshot
const mockDocuments = [
    { id: 1, name: 'Bolletta Acqua', emissione: '13/03/2024', cif: '510665502883', scadenza: '12/04/2024', importo: '36,82 €', consumo: '57,00 Mc', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' },
    { id: 2, name: 'Bolletta Acqua', emissione: '13/03/2024', cif: '510665510665', scadenza: '12/04/2024', importo: '34,68 €', consumo: '38,00 Mc', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' },
    { id: 3, name: 'Bolletta Acqua', emissione: '14/06/2024', cif: '510665502883', scadenza: '15/07/2024', importo: '50,66 €', consumo: '57,00 Mc', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' },
    { id: 4, name: 'Bolletta Acqua', emissione: '14/06/2024', cif: '510665510665', scadenza: '15/07/2024', importo: '22,18 €', consumo: '38,00 Mc', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' },
    { id: 5, name: 'Bolletta Acqua', emissione: '17/09/2024', cif: '510665502883', scadenza: '18/10/2024', importo: '39,33 €', consumo: '54,00 Mc', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' },
    { id: 6, name: 'Bolletta Acqua', emissione: '17/09/2024', cif: '510665510665', scadenza: '18/10/2024', importo: '25,79 €', consumo: '37,00 Mc', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' },
]

export function DocumentList() {
    const [viewingDoc, setViewingDoc] = useState<string | null>(null)

    return (
        <>
            <div className="space-y-6 animate-in slide-in-from-bottom duration-500 delay-100">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">Elenco Bollette</h3>
                    <div className="text-sm text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-800/50 px-3 py-1 rounded-full border border-white dark:border-slate-700">
                        Utenza: <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">RMLMLS53M42...</span>
                    </div>
                </div>

                {/* Mobile View (Cards) - Hidden on desktop */}
                <div className="grid gap-4 md:hidden">
                    {mockDocuments.map((doc) => (
                        <div key={doc.id} className="glass rounded-xl p-4 space-y-3 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity dark:text-white">
                                <FileText size={80} />
                            </div>

                            <div className="flex justify-between items-start z-10 relative">
                                <div>
                                    <span className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-wider">Scadenza {doc.scadenza}</span>
                                    <h4 className="font-bold text-slate-800 dark:text-white text-lg mt-1">{doc.importo}</h4>
                                </div>
                                <span className="bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 text-xs px-2 py-1 rounded flex items-center">
                                    <Droplets size={12} className="mr-1" /> {doc.consumo}
                                </span>
                            </div>

                            <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1 z-10 relative">
                                <p>Emesso il: {doc.emissione}</p>
                                <p className="font-mono text-xs text-slate-400 dark:text-slate-500">CIF: {doc.cif}</p>
                            </div>

                            <div className="flex gap-2 pt-2 z-10 relative">
                                <button onClick={() => setViewingDoc(doc.url)} className="flex-1 bg-white/60 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 text-[var(--color-primary)] py-2 rounded-lg font-medium text-sm transition-colors border border-transparent hover:border-[var(--color-primary)]">
                                    Vedi PDF
                                </button>
                                <button className="flex-1 bg-[var(--color-primary)] text-white py-2 rounded-lg font-medium text-sm hover:brightness-110 shadow-lg shadow-blue-500/20">
                                    Download
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Desktop View (Table) - Hidden on mobile */}
                <div className="hidden md:block glass rounded-2xl overflow-hidden border border-white/40 dark:border-slate-700 shadow-sm">
                    <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300 border-separate border-spacing-0">
                        <thead className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4 text-center bg-white/50 dark:bg-slate-800/50 first:rounded-l-xl align-middle">Data Emissione</th>
                                <th className="px-6 py-4 text-center bg-white/50 dark:bg-slate-800/50 align-middle">CIF</th>
                                <th className="px-6 py-4 text-center bg-white/50 dark:bg-slate-800/50 align-middle">Scadenza</th>
                                <th className="px-6 py-4 text-center bg-white/50 dark:bg-slate-800/50 align-middle">Importo</th>
                                <th className="px-6 py-4 text-center bg-white/50 dark:bg-slate-800/50 align-middle">Consumo</th>
                                <th className="px-6 py-4 text-center bg-white/50 dark:bg-slate-800/50 last:rounded-r-xl align-middle">Azioni</th>
                            </tr>
                        </thead>
                        <tbody className="">
                            {mockDocuments.map((doc) => (
                                <tr key={doc.id} className="hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors group">
                                    <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800/60 align-middle">{doc.emissione}</td>
                                    <td className="px-6 py-4 font-mono text-xs border-b border-slate-100 dark:border-slate-800/60 align-middle">{doc.cif}</td>
                                    <td className="px-6 py-4 text-orange-600 dark:text-orange-400 font-medium border-b border-slate-100 dark:border-slate-800/60 align-middle">{doc.scadenza}</td>
                                    <td className="px-6 py-4 text-right font-bold text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-800/60 align-middle">{doc.importo}</td>
                                    <td className="px-6 py-4 text-right font-medium border-b border-slate-100 dark:border-slate-800/60 align-middle">{doc.consumo}</td>
                                    <td className="px-6 py-4 flex items-center justify-center gap-2 border-b border-slate-100 dark:border-slate-800/60 align-middle">
                                        <button
                                            onClick={() => setViewingDoc(doc.url)}
                                            className="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-400 hover:text-[var(--color-primary)] transition-all"
                                            title="Vedi Anteprima"
                                        >
                                            <Eye size={18} />
                                        </button>
                                        <button
                                            className="p-2 rounded-lg bg-[var(--color-primary)] text-white hover:brightness-110 shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5"
                                            title="Scarica PDF"
                                        >
                                            <Download size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div >

            {/* PDF Viewer Modal */}
            {
                viewingDoc && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
                            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
                                <h3 className="font-semibold text-slate-700">Anteprima Documento</h3>
                                <button onClick={() => setViewingDoc(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500 hover:text-red-500">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="flex-1 bg-slate-100 p-0">
                                <iframe src={viewingDoc} className="w-full h-full border-0" title="PDF Preview" />
                            </div>
                        </div>
                    </div>
                )
            }
        </>
    )
}
