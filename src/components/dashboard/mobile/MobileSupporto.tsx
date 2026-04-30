'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Phone, Receipt, Droplets, Home, FileText, Mail, Globe, MapPin, Clock, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MobileSupportoProps {
    firstName: string
    onBack: () => void
}

const EMERGENCY_NUMBER = '800.213.911'
const SERVICE_NUMBER = '800.069.718'
const SUPPORT_EMAIL = 'info@acquambientemarche.it'
const SUPPORT_PEC = 'info@pec.acquambientemarche.it'
const SUPPORT_WEBSITE = 'www.acquambientemarche.it'
const CENTRALINO = '071/782471'
const PROTOCOLLO = '071/7824733'
const VAT_NUMBER = '02119730428'

const telHref = (n: string) => `tel:${n.replace(/[^0-9]/g, '')}`

type TopicId = 'bill' | 'leak' | 'address' | 'invoice'

interface Topic {
    id: TopicId
    label: string
    subtitle: string
    Icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
    iconBg: string
    iconColor: string
    description: string
    callNumber: string
    callLabel: string
}

const NEUTRAL_ICON_BG = 'bg-[#93C5FD]/15 dark:bg-white/5'
const NEUTRAL_ICON_COLOR = 'text-[#1E5BFF] dark:text-[#93C5FD]'

const TOPICS: Topic[] = [
    {
        id: 'bill',
        label: 'Bolletta',
        subtitle: 'Pagamenti e importi',
        Icon: Receipt,
        iconBg: NEUTRAL_ICON_BG,
        iconColor: NEUTRAL_ICON_COLOR,
        description: 'Domande su importi, pagamenti, rateizzazioni o solleciti? Il Servizio Clienti può aiutarti a risolvere subito.',
        callNumber: SERVICE_NUMBER,
        callLabel: 'Chiama Servizio Clienti',
    },
    {
        id: 'leak',
        label: 'Guasti',
        subtitle: 'Perdite e fughe',
        Icon: Droplets,
        iconBg: 'bg-red-50 dark:bg-red-500/10',
        iconColor: 'text-red-600 dark:text-red-400',
        description: 'Hai notato una perdita o un guasto idrico? Per emergenze chiama subito il Pronto Intervento, attivo 24 ore su 24.',
        callNumber: EMERGENCY_NUMBER,
        callLabel: 'Chiama Pronto Intervento',
    },
    {
        id: 'address',
        label: 'Trasloco',
        subtitle: 'Cambio residenza',
        Icon: Home,
        iconBg: NEUTRAL_ICON_BG,
        iconColor: NEUTRAL_ICON_COLOR,
        description: 'Hai cambiato indirizzo o vuoi attivare/cessare una fornitura? Ti guidiamo passo passo.',
        callNumber: SERVICE_NUMBER,
        callLabel: 'Chiama Servizio Clienti',
    },
    {
        id: 'invoice',
        label: 'Fatturazione',
        subtitle: 'Dati e modifiche',
        Icon: FileText,
        iconBg: NEUTRAL_ICON_BG,
        iconColor: NEUTRAL_ICON_COLOR,
        description: 'Vuoi modificare dati anagrafici, IBAN o metodo di pagamento? Possiamo aggiornare tutto in pochi minuti.',
        callNumber: SERVICE_NUMBER,
        callLabel: 'Chiama Servizio Clienti',
    },
]

function isOpenNow() {
    const now = new Date()
    const day = now.getDay()
    const hour = now.getHours()
    return day >= 1 && day <= 5 && hour >= 8 && hour < 20
}

export function MobileSupporto({ firstName, onBack }: MobileSupportoProps) {
    const [activeTopic, setActiveTopic] = useState<Topic | null>(null)
    const [open, setOpen] = useState(false)

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'auto' })
        document.scrollingElement?.scrollTo({ top: 0, behavior: 'auto' })
        setOpen(isOpenNow())
    }, [])

    useEffect(() => {
        if (activeTopic) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [activeTopic])

    return (
        <div className="px-5 pb-32 space-y-6">
            {/* Header */}
            <div className="pt-4 flex items-center justify-between">
                <button
                    onClick={onBack}
                    className="w-12 h-12 rounded-full bg-white dark:bg-white/5 flex items-center justify-center text-[#0A2540] dark:text-white shrink-0 active:scale-90 transition-transform"
                >
                    <ChevronLeft size={24} />
                </button>
                <p className="text-xl font-bold text-[#0A2540] dark:text-white">Supporto</p>
                <div className="w-12" />
            </div>



            {/* Emergency CTA */}
            <a
                href={telHref(EMERGENCY_NUMBER)}
                className="relative block overflow-hidden rounded-[2rem] p-5 text-white active:scale-[0.98] transition-transform"
                style={{ background: 'linear-gradient(135deg, #DC2626 0%, #EA580C 100%)' }}
            >
                <div className="absolute -bottom-8 -right-8 w-40 h-40 rounded-full bg-white/15 blur-2xl pointer-events-none" />
                <div className="relative z-10 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <AlertTriangle size={11} strokeWidth={2.5} className="text-white" />
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-90">Pronto Intervento · 24h</p>
                        </div>
                        <h3 className="text-2xl font-bold tracking-tight">{EMERGENCY_NUMBER}</h3>
                        <p className="text-[11px] font-medium opacity-80 mt-0.5">Numero verde · emergenze idriche</p>
                    </div>
                    <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
                        <Phone size={24} className="text-white" strokeWidth={2.5} />
                    </div>
                </div>
            </a>

            {/* Service CTA + status */}
            <a
                href={telHref(SERVICE_NUMBER)}
                className="block w-full bg-[#C6F36B] text-[#0A2540] rounded-[2rem] p-5 active:scale-[0.98] transition-transform"
            >
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className={cn(
                                'w-1.5 h-1.5 rounded-full',
                                open ? 'bg-emerald-600 animate-pulse' : 'bg-slate-400'
                            )} />
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-70">
                                {open ? 'Servizio Clienti · in linea' : 'Servizio Clienti'}
                            </p>
                        </div>
                        <h3 className="text-2xl font-bold tracking-tight">{SERVICE_NUMBER}</h3>
                        <p className="text-[11px] font-medium opacity-70 mt-0.5">Numero verde gratuito · Lun–Ven 8–20</p>
                    </div>
                    <div className="w-14 h-14 rounded-full bg-[#0A2540] flex items-center justify-center shrink-0">
                        <Phone size={24} className="text-[#C6F36B]" strokeWidth={2.5} />
                    </div>
                </div>
            </a>

            {/* Topic grid */}
            <div>
                <p className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase mb-3 px-1">Argomenti frequenti</p>
                <div className="grid grid-cols-2 gap-3">
                    {TOPICS.map((topic) => (
                        <button
                            key={topic.id}
                            onClick={() => setActiveTopic(topic)}
                            className="bg-white dark:bg-[#1A1D23] p-4 rounded-2xl text-left active:scale-95 transition-transform"
                        >
                            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-3', topic.iconBg)}>
                                <topic.Icon size={20} className={topic.iconColor} strokeWidth={2.5} />
                            </div>
                            <p className="text-sm font-bold text-[#0A2540] dark:text-white">{topic.label}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5 truncate">{topic.subtitle}</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Other channels */}
            <div>
                <p className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase mb-3 px-1">Altri canali</p>
                <div className="bg-white dark:bg-[#1A1D23] rounded-3xl overflow-hidden">
                    <ChannelRow
                        icon={<Mail size={18} strokeWidth={2.5} />}
                        iconBg={NEUTRAL_ICON_BG}
                        iconColor={NEUTRAL_ICON_COLOR}
                        label="Email"
                        sublabel={SUPPORT_EMAIL}
                        href={`mailto:${SUPPORT_EMAIL}`}
                    />
                    <ChannelRow
                        icon={<Mail size={18} strokeWidth={2.5} />}
                        iconBg={NEUTRAL_ICON_BG}
                        iconColor={NEUTRAL_ICON_COLOR}
                        label="PEC"
                        sublabel={SUPPORT_PEC}
                        href={`mailto:${SUPPORT_PEC}`}
                    />
                    <ChannelRow
                        icon={<Globe size={18} strokeWidth={2.5} />}
                        iconBg={NEUTRAL_ICON_BG}
                        iconColor={NEUTRAL_ICON_COLOR}
                        label="Sito web"
                        sublabel={SUPPORT_WEBSITE}
                        href={`https://${SUPPORT_WEBSITE}`}
                        external
                    />
                </div>
            </div>

            {/* Sede & orari */}
            <div>
                <p className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase mb-3 px-1">Sportello & sede</p>
                <div className="bg-white dark:bg-[#1A1D23] rounded-3xl p-5 space-y-5">
                    <div className="flex items-start gap-3">
                        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', NEUTRAL_ICON_BG, NEUTRAL_ICON_COLOR)}>
                            <MapPin size={18} strokeWidth={2.5} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Sede Castelfidardo</p>
                            <p className="text-sm font-bold text-[#0A2540] dark:text-white">Via Recanatese, 27/I</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">60022 Castelfidardo (AN)</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', NEUTRAL_ICON_BG, NEUTRAL_ICON_COLOR)}>
                            <Clock size={18} strokeWidth={2.5} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Orari sportello</p>
                            <p className="text-sm font-bold text-[#0A2540] dark:text-white">Lun – Ven · 8:00 – 14:00</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                                Mar e Gio anche 16:00 – 18:00
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Other phone numbers */}
            <div>
                <p className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase mb-3 px-1">Altri numeri</p>
                <div className="bg-white dark:bg-[#1A1D23] rounded-3xl overflow-hidden">
                    <PhoneRow label="Centralino" number={CENTRALINO} />
                    <PhoneRow label="Ufficio Protocollo" number={PROTOCOLLO} />
                </div>
            </div>

            {/* VAT footer */}
            <p className="text-[10px] font-mono text-slate-400 text-center pt-2 uppercase">
                C.F. e P.IVA {VAT_NUMBER}
            </p>

            {/* Topic detail sheet */}
            {activeTopic && (
                <TopicSheet topic={activeTopic} onClose={() => setActiveTopic(null)} />
            )}
        </div>
    )
}

function ChannelRow({
    icon,
    iconBg,
    iconColor,
    label,
    sublabel,
    href,
    external,
}: {
    icon: React.ReactNode
    iconBg: string
    iconColor: string
    label: string
    sublabel: string
    href: string
    external?: boolean
}) {
    return (
        <a
            href={href}
            target={external ? '_blank' : undefined}
            rel={external ? 'noopener noreferrer' : undefined}
            className="flex items-center gap-3 px-4 py-3.5 active:bg-slate-50 dark:active:bg-white/5 transition-colors"
        >
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', iconBg, iconColor)}>
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#0A2540] dark:text-white">{label}</p>
                <p className="text-[11px] text-slate-400 truncate">{sublabel}</p>
            </div>
            <ChevronRight size={18} className="text-slate-300 dark:text-slate-600 shrink-0" />
        </a>
    )
}

function PhoneRow({ label, number }: { label: string; number: string }) {
    return (
        <a
            href={telHref(number)}
            className="flex items-center gap-3 px-4 py-3.5 active:bg-slate-50 dark:active:bg-white/5 transition-colors"
        >
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', NEUTRAL_ICON_BG, NEUTRAL_ICON_COLOR)}>
                <Phone size={18} strokeWidth={2.5} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#0A2540] dark:text-white">{label}</p>
                <p className="text-[11px] text-slate-400 font-mono tracking-tight">{number}</p>
            </div>
            <ChevronRight size={18} className="text-slate-300 dark:text-slate-600 shrink-0" />
        </a>
    )
}

function TopicSheet({ topic, onClose }: { topic: Topic; onClose: () => void }) {
    const [mounted, setMounted] = useState(false)
    useEffect(() => { setMounted(true) }, [])
    if (!mounted) return null

    return createPortal(
        <div className="fixed inset-0 z-[60] flex items-end animate-in fade-in duration-200">
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className="relative w-full bg-white dark:bg-[#1A1D23] rounded-t-[2.5rem] p-6 pb-10 shadow-2xl animate-in slide-in-from-bottom duration-300">
                <div className="flex justify-center mb-4">
                    <div className="w-12 h-1.5 rounded-full bg-slate-200 dark:bg-white/10" />
                </div>

                <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center mb-4', topic.iconBg)}>
                    <topic.Icon size={28} className={topic.iconColor} strokeWidth={2.5} />
                </div>

                <h3 className="text-2xl font-bold text-[#0A2540] dark:text-white tracking-tight mb-2">{topic.label}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
                    {topic.description}
                </p>

                <a
                    href={telHref(topic.callNumber)}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-[#C6F36B] text-[#0A2540] font-bold text-sm tracking-tight active:scale-[0.98] transition-transform"
                >
                    <Phone size={18} strokeWidth={2.5} />
                    {topic.callLabel} · {topic.callNumber}
                </a>
            </div>
        </div>,
        document.body
    )
}
