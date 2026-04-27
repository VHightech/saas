'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CreditCard, X, Loader2, AlertCircle } from 'lucide-react'
import { initiatePagoPAPayment } from '@/actions/payment-actions'

interface BillForPayment {
    id: number
    idboll?: number
    amount: string
    cif?: string
    expiry?: string
}

interface PagoPAPaymentModalProps {
    isOpen: boolean
    bill: BillForPayment | null
    onClose: () => void
    onSuccess?: () => void
}

function parseAmountToNumber(amount: string): number {
    const cleaned = amount.replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.')
    const value = Number.parseFloat(cleaned)
    return Number.isFinite(value) ? value : 0
}

export function PagoPAPaymentModal({ isOpen, bill, onClose, onSuccess }: PagoPAPaymentModalProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handlePay = async () => {
        if (!bill) return
        setLoading(true)
        setError(null)

        try {
            const amount = parseAmountToNumber(bill.amount)
            const result = await initiatePagoPAPayment(bill.id, amount)

            if ('error' in result && result.error) {
                setError(result.error)
                return
            }

            if ('paymentUrl' in result && result.paymentUrl) {
                window.open(result.paymentUrl, '_blank', 'noopener,noreferrer')
                onSuccess?.()
                onClose()
            }
        } catch {
            setError('Errore imprevisto durante il pagamento.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <AnimatePresence>
            {isOpen && bill && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="bg-white dark:bg-[#111] rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl max-w-md w-full p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between mb-6">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <CreditCard className="w-5 h-5 text-sky-500" />
                                    <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                        Pagamento PagoPA
                                    </h2>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Bolletta {bill.idboll ?? bill.id}
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/5 transition"
                                aria-label="Chiudi"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-4 mb-6 border border-slate-100 dark:border-white/5">
                            <div className="flex justify-between items-center">
                                <span className="text-[11px] uppercase font-bold tracking-widest text-slate-400">
                                    Importo
                                </span>
                                <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">
                                    {bill.amount}
                                </span>
                            </div>
                            {bill.expiry && (
                                <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200/50 dark:border-white/5">
                                    <span className="text-[11px] uppercase font-bold tracking-widest text-slate-400">
                                        Scadenza
                                    </span>
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                        {bill.expiry}
                                    </span>
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="flex items-start gap-2 mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold">
                                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="flex gap-2">
                            <button
                                onClick={onClose}
                                disabled={loading}
                                className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 text-xs font-black uppercase tracking-widest disabled:opacity-50"
                            >
                                Annulla
                            </button>
                            <button
                                onClick={handlePay}
                                disabled={loading}
                                className="flex-[1.5] py-3 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20 disabled:opacity-60"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Elaborazione...
                                    </>
                                ) : (
                                    <>
                                        <CreditCard size={16} />
                                        Paga ora
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
