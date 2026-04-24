'use client'

/**
 * Command palette (⌘K / Ctrl+K) — fuzzy search across bills, supplies, settings.
 * Drop into src/components/dashboard/CommandPalette.tsx
 * Depends on cmdk (`npm i cmdk`) and shadcn/ui command (`npx shadcn@latest add command`).
 */

import * as React from 'react'
import { Command } from 'cmdk'
import { Search, FileText, Home, Settings, CreditCard, HelpCircle } from 'lucide-react'
import type { Bill } from '@/types/dashboard'
import type { Supply } from '@/types/dashboard-extended'
import { fmtDate, fmtEur } from '@/lib/format'

export interface CommandPaletteProps {
    bills: Bill[]
    supplies: Supply[]
    onNavigate: (href: string) => void
    onOpenBill: (bill: Bill) => void
    onSwitchSupply: (supply: Supply) => void
}

export function CommandPalette(props: CommandPaletteProps) {
    const [open, setOpen] = React.useState(false)

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                setOpen(o => !o)
            }
        }
        document.addEventListener('keydown', down)
        return () => document.removeEventListener('keydown', down)
    }, [])

    if (!open) return null

    return (
        <div className="fixed inset-0 z-[100] grid place-items-start pt-[10vh] bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}>
            <Command
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-xl mx-auto rounded-2xl bg-[var(--acq-surface)] shadow-2xl overflow-hidden border border-[var(--acq-ink-soft)]">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--acq-ink-soft)]">
                    <Search className="w-4 h-4 text-[var(--acq-ink-sub)]" />
                    <Command.Input autoFocus placeholder="Cerca bollette, forniture, impostazioni…"
                        className="flex-1 bg-transparent outline-none text-sm text-[var(--acq-ink)]" />
                    <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--acq-ink-soft)] text-[var(--acq-ink-sub)]">esc</kbd>
                </div>

                <Command.List className="max-h-[50vh] overflow-auto p-2">
                    <Command.Empty className="py-8 text-center text-sm text-[var(--acq-ink-sub)]">
                        Nessun risultato.
                    </Command.Empty>

                    <Command.Group heading="Azioni rapide" className="text-[10px] font-semibold tracking-wider uppercase text-[var(--acq-ink-sub)] px-2 pt-2 pb-1">
                        <Item icon={Home} label="Dashboard" onSelect={() => { props.onNavigate('/dashboard'); setOpen(false) }} />
                        <Item icon={FileText} label="Archivio bollette" onSelect={() => { props.onNavigate('/dashboard/bills'); setOpen(false) }} />
                        <Item icon={CreditCard} label="Pagamenti" onSelect={() => { props.onNavigate('/dashboard/payments'); setOpen(false) }} />
                        <Item icon={Settings} label="Impostazioni" onSelect={() => { props.onNavigate('/dashboard/profile'); setOpen(false) }} />
                        <Item icon={HelpCircle} label="Supporto" onSelect={() => { props.onNavigate('/support'); setOpen(false) }} />
                    </Command.Group>

                    {props.supplies.length > 0 && (
                        <Command.Group heading="Forniture" className="text-[10px] font-semibold tracking-wider uppercase text-[var(--acq-ink-sub)] px-2 pt-3 pb-1">
                            {props.supplies.map(s => (
                                <Item key={s.id} icon={Home} label={`${s.label} · ULM ${s.ulm}`}
                                    onSelect={() => { props.onSwitchSupply(s); setOpen(false) }} />
                            ))}
                        </Command.Group>
                    )}

                    {props.bills.length > 0 && (
                        <Command.Group heading="Bollette recenti" className="text-[10px] font-semibold tracking-wider uppercase text-[var(--acq-ink-sub)] px-2 pt-3 pb-1">
                            {props.bills.slice(0, 10).map(b => (
                                <Item key={b.id} icon={FileText}
                                    label={`${fmtDate(b.data_emissione)} · ${fmtEur(b.importo)}`}
                                    hint={`#${b.id}`}
                                    onSelect={() => { props.onOpenBill(b); setOpen(false) }} />
                            ))}
                        </Command.Group>
                    )}
                </Command.List>
            </Command>
        </div>
    )
}

function Item({ icon: Icon, label, hint, onSelect }: {
    icon: React.ComponentType<{ className?: string }>
    label: string
    hint?: string
    onSelect: () => void
}) {
    return (
        <Command.Item onSelect={onSelect}
            className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer
                       data-[selected=true]:bg-[var(--acq-bg)] text-sm text-[var(--acq-ink)]">
            <Icon className="w-4 h-4 text-[var(--acq-ink-sub)]" />
            <span className="flex-1 truncate">{label}</span>
            {hint && <span className="text-xs text-[var(--acq-ink-sub)] font-mono">{hint}</span>}
        </Command.Item>
    )
}
