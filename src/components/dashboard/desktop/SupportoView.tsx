'use client'

import { Phone, Mail, Globe, MapPin, Clock, AlertTriangle, FileText, Droplets, Home as HomeIcon, Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DesktopSidebar } from '@/components/dashboard/desktop/DesktopSidebar'
import { useSidebarPin, sidebarMainOffset } from '@/components/dashboard/desktop/use-sidebar-pin'
import { MobileSupporto } from '@/components/dashboard/mobile/MobileSupporto'

const EMERGENCY_NUMBER = '800.213.911'
const SERVICE_NUMBER = '800.069.718'
const SUPPORT_EMAIL = 'info@acquambientemarche.it'
const SUPPORT_PEC = 'info@pec.acquambientemarche.it'
const SUPPORT_WEBSITE = 'www.acquambientemarche.it'
const CENTRALINO = '071/782471'
const PROTOCOLLO = '071/7824733'
const VAT_NUMBER = '02119730428'

const telHref = (n: string) => `tel:${n.replace(/[^0-9]/g, '')}`

interface SupportoViewProps {
    firstName: string
}

export function SupportoView({ firstName }: SupportoViewProps) {
    // Barra laterale bloccata aperta: il contenuto si sposta con lei.
    const { pinned } = useSidebarPin()
    return (
        <>
            {/* MOBILE */}
            <div className="lg:hidden min-h-screen bg-[#F8FAFC] dark:bg-[#0F1115]">
                <MobileSupporto firstName={firstName} onBack={() => history.back()} />
            </div>

            {/* DESKTOP */}
            <div className="hidden lg:block h-screen overflow-hidden bg-[#F8FAFC] dark:bg-[#0F1115]">
                <DesktopSidebar />

                <main className={cn(sidebarMainOffset(pinned), "h-full overflow-y-auto custom-scrollbar")}>
                    <div className="max-w-[1440px] mx-auto p-8 space-y-6">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Assistenza</p>
                        <h1 className="text-3xl font-bold text-[#0A2540] dark:text-white tracking-tight">Ciao {firstName}, come possiamo aiutarti?</h1>
                    </div>

                    {/* Emergency callout */}
                    <a href={telHref(EMERGENCY_NUMBER)} className="block rounded-[2rem] p-6 text-white relative overflow-hidden"
                        style={{ background: 'linear-gradient(135deg, #b91c1c 0%, #ef4444 100%)' }}>
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
                                <AlertTriangle size={26} />
                            </div>
                            <div className="flex-1">
                                <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Pronto Intervento · 24/7</p>
                                <p className="text-3xl font-extrabold tracking-tight">{EMERGENCY_NUMBER}</p>
                                <p className="text-[12px] opacity-90 mt-1">Guasti e perdite idriche · sempre attivo, anche nei festivi</p>
                            </div>
                            <Phone size={28} className="opacity-80" />
                        </div>
                    </a>

                    {/* Quick contact grid */}
                    <div className="grid grid-cols-3 gap-5">
                        <ContactCard icon={<Phone size={18} />} label="Servizio Clienti" value={SERVICE_NUMBER} sub="Lun-Ven 8-14 · Mar/Gio anche 16-18" href={telHref(SERVICE_NUMBER)} accent="#1E5BFF" />
                        <ContactCard icon={<Mail size={18} />} label="Email" value={SUPPORT_EMAIL} sub="Risposta entro 24h" href={`mailto:${SUPPORT_EMAIL}`} accent="#10b981" />
                        <ContactCard icon={<FileText size={18} />} label="PEC" value={SUPPORT_PEC} sub="Per comunicazioni ufficiali" href={`mailto:${SUPPORT_PEC}`} accent="#7c3aed" />
                    </div>

                    {/* Topics */}
                    <div className="bg-white dark:bg-[#1A1D23] rounded-[2rem] p-5">
                        <h2 className="text-lg font-bold text-[#0A2540] dark:text-white tracking-tight mb-4">Argomenti frequenti</h2>
                        <div className="grid grid-cols-2 gap-3">
                            <Topic icon={<Receipt size={18} />} title="Hai dubbi sulla bolletta?" desc="Verifica gli importi, le letture e le scadenze." cta="Chiama il servizio clienti" tel={SERVICE_NUMBER} />
                            <Topic icon={<Droplets size={18} />} title="Hai notato una perdita?" desc="Segnala immediatamente per un intervento tecnico urgente." cta="Chiama pronto intervento" tel={EMERGENCY_NUMBER} emergency />
                            <Topic icon={<HomeIcon size={18} />} title="Vuoi cambiare indirizzo?" desc="Aggiornamento dati anagrafici e di fornitura." cta="Chiama il servizio clienti" tel={SERVICE_NUMBER} />
                            <Topic icon={<FileText size={18} />} title="Richiedi una fattura" desc="Copie fatture o estratti conto." cta="Chiama il servizio clienti" tel={SERVICE_NUMBER} />
                        </div>
                    </div>

                    {/* Company info */}
                    <div className="bg-white dark:bg-[#1A1D23] rounded-[2rem] p-5 grid grid-cols-2 gap-4">
                        <InfoLine icon={<Phone size={14} />} label="Centralino" value={CENTRALINO} />
                        <InfoLine icon={<FileText size={14} />} label="Protocollo" value={PROTOCOLLO} />
                        <InfoLine icon={<Globe size={14} />} label="Sito web" value={SUPPORT_WEBSITE} />
                        <InfoLine icon={<Clock size={14} />} label="P.IVA" value={VAT_NUMBER} />
                    </div>
                    </div>
                </main>
            </div>
        </>
    )
}

function ContactCard({ icon, label, value, sub, href, accent }: { icon: React.ReactNode; label: string; value: string; sub: string; href: string; accent: string }) {
    return (
        <a href={href} className="block bg-white dark:bg-[#1A1D23] rounded-[2rem] p-5 transition-shadow">
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: accent }}>
                    {icon}
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
            </div>
            <p className="text-[15px] font-bold text-[#0A2540] dark:text-white break-all">{value}</p>
            <p className="text-[11px] text-slate-500 mt-1">{sub}</p>
        </a>
    )
}

function Topic({ icon, title, desc, cta, tel, emergency }: { icon: React.ReactNode; title: string; desc: string; cta: string; tel: string; emergency?: boolean }) {
    return (
        <div className="rounded-2xl p-4 bg-slate-50 dark:bg-white/5">
            <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${emergency ? 'bg-red-100 text-red-600' : 'bg-[#93C5FD]/15 text-[#1E5BFF]'}`}>
                    {icon}
                </div>
                <div className="min-w-0">
                    <p className="text-[13px] font-bold text-[#0A2540] dark:text-white">{title}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{desc}</p>
                    <a href={telHref(tel)} className={`inline-flex items-center gap-1.5 mt-2 text-[11px] font-bold ${emergency ? 'text-red-600' : 'text-[#1E5BFF]'}`}>
                        <Phone size={11} /> {cta} · {tel}
                    </a>
                </div>
            </div>
        </div>
    )
}

function InfoLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-400 flex items-center justify-center shrink-0">
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
                <p className="text-[12px] font-bold text-[#0A2540] dark:text-white truncate">{value}</p>
            </div>
        </div>
    )
}
