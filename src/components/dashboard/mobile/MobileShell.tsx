'use client'

import { useState, useEffect } from 'react'
import { useDashboard } from '@/components/dashboard/dashboard-context'
import { MobileHome } from './MobileHome'
import { MobileBollette } from './MobileBollette'
import { MobileProfilo } from './MobileProfilo'
import { MobileConfronto } from './MobileConfronto'
import { MobileSupporto } from './MobileSupporto'
import { MobileBollettaDetail } from './MobileBollettaDetail'
import { initiatePagoPAPayment } from '@/actions/payment-actions'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { Profile, Bill } from '@/types/dashboard'

type Tab = 'home' | 'bollette' | 'profilo' | 'confronto' | 'supporto'

export interface UserSupply {
    codice_cliente?: string
    cif?: string
    address?: string
    city?: string
    ulm?: string
    [key: string]: any
}

interface MobileShellProps {
    profile: Profile
    bills: Bill[]
    supplies?: UserSupply[]
    stats: {
        firstName: string
        fullName: string
        clientCode: string
        fiscalCode?: string
        address?: string
        email?: string
        phone?: string
        lastConsumption: number
        percentageBadge: React.ReactNode
    }
}

export function MobileShell({ profile, bills, supplies = [], stats }: MobileShellProps) {
    const { selectedSupply, setSelectedSupply } = useDashboard()
    const router = useRouter()
    const supabase = createClient()
    const [tab, setTab] = useState<Tab>('home')
    const [selectedBill, setSelectedBill] = useState<Bill | null>(null)
    const [isPaying, setIsPaying] = useState(false)

    // Handle Browser Back Gesture / Physical Back Button
    useEffect(() => {
        // Push initial state
        if (typeof window !== 'undefined' && !window.history.state) {
            window.history.replaceState({ tab: 'home' }, '')
        }

        const handlePopState = (event: PopStateEvent) => {
            if (event.state?.billId) {
                // If we were in a bill but popped to another state that has a bill (shouldn't happen often)
            } else {
                setSelectedBill(null)
            }

            if (event.state?.tab) {
                setTab(event.state.tab)
            } else {
                setTab('home')
            }
        }

        window.addEventListener('popstate', handlePopState)
        return () => window.removeEventListener('popstate', handlePopState)
    }, [])

    // Wrapper for setTab that updates history
    const navigateTo = (nextTab: Tab) => {
        if (nextTab !== tab) {
            window.history.pushState({ tab: nextTab }, '')
            setTab(nextTab)
        }
    }

    // Count unpaid bills for the badge
    const unpaidCount = bills.filter((b: any) => (b.status || 'unpaid') === 'unpaid').length

    // Wrapper for bill selection
    const openBill = (bill: Bill) => {
        window.history.pushState({ tab: tab, billId: bill.id }, '')
        setSelectedBill(bill)
    }

    const closeBill = () => {
        if (selectedBill) {
            window.history.back()
        }
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.refresh()
    }

    const handlePay = async (bill: Bill) => {
        if (isPaying) return
        setIsPaying(true)
        try {
            const amount = Number(bill.importo || 0)
            const result = await initiatePagoPAPayment(bill.id, amount)

            if ('error' in result && result.error) {
                alert(result.error)
                return
            }

            if ('paymentUrl' in result && result.paymentUrl) {
                window.location.href = result.paymentUrl
            }
        } catch {
            alert('Errore durante l\'inizializzazione del pagamento.')
        } finally {
            setIsPaying(false)
        }
    }

    if (selectedBill) {
        const getSupplyId = (s: any) => s?.ulm || s?.codice_ulm || s?.pdr || 'all'
        const matchingSupply = supplies.find((s: any) => {
            const sid = getSupplyId(s)
            return sid === selectedBill.ulm || s.cif === (selectedBill as any).cif
        })

        const currentIndex = bills.findIndex(b => b.id === selectedBill.id)
        const onNext = currentIndex < bills.length - 1 ? () => setSelectedBill(bills[currentIndex + 1]) : undefined
        const onPrev = currentIndex > 0 ? () => setSelectedBill(bills[currentIndex - 1]) : undefined

        return (
            <div className="lg:hidden">
                <MobileBollettaDetail
                    bill={selectedBill} 
                    supply={matchingSupply} 
                    onBack={closeBill}
                    onPay={handlePay}
                    isPaying={isPaying}
                    onNext={onNext}
                    onPrev={onPrev}
                    allBills={bills}
                    onSelectBill={setSelectedBill}
                />
            </div>
        )
    }

    return (
        <div className="lg:hidden min-h-screen bg-[#F8FAFC] dark:bg-[#0F1115] flex flex-col">
            <div key={tab} className="flex-1 flex flex-col animate-content-in">
                {tab === 'home' && (
                <MobileHome
                    profile={profile}
                    bills={bills}
                    supplies={supplies}
                    stats={stats}
                    unpaidCount={unpaidCount}
                    onGoToBollette={() => navigateTo('bollette')}
                    onGoToConfronto={() => navigateTo('confronto')}
                    onGoToSupporto={() => navigateTo('supporto')}
                    onGoToProfilo={() => navigateTo('profilo')}
                    onSelectBill={openBill}
                    onPay={handlePay}
                    selectedSupplyId={selectedSupply}
                    onSelectSupply={setSelectedSupply}
                    onLogout={handleLogout}
                />
            )}
            {tab === 'bollette' && <MobileBollette bills={bills} supplies={supplies} onSelectBill={openBill} onBack={() => window.history.back()} />}
            {tab === 'profilo' && <MobileProfilo profile={profile} stats={stats} supplies={supplies} onBack={() => window.history.back()} onLogout={handleLogout} />}
            {tab === 'confronto' && <MobileConfronto bills={bills} onBack={() => window.history.back()} />}
            {tab === 'supporto' && <MobileSupporto firstName={stats.firstName} onBack={() => window.history.back()} />}
            </div>
        </div>
    )
}
