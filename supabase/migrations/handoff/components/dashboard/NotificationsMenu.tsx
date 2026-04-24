'use client'

/**
 * Notifications popover — badge + dropdown list.
 * Drop into src/components/dashboard/NotificationsMenu.tsx
 */

import * as React from 'react'
import { Bell, Check } from 'lucide-react'
import type { AppNotification } from '@/types/dashboard-extended'
import { fmtDateRelative } from '@/lib/format'

export interface NotificationsMenuProps {
    notifications: AppNotification[]
    onMarkAllRead?: () => void
    onMarkRead?: (id: string) => void
    onNavigate?: (href: string) => void
}

export function NotificationsMenu({ notifications, onMarkAllRead, onMarkRead, onNavigate }: NotificationsMenuProps) {
    const [open, setOpen] = React.useState(false)
    const ref = React.useRef<HTMLDivElement>(null)
    const unread = notifications.filter(n => !n.read_at).length

    React.useEffect(() => {
        const h = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
        }
        document.addEventListener('mousedown', h)
        return () => document.removeEventListener('mousedown', h)
    }, [])

    return (
        <div ref={ref} className="relative">
            <button onClick={() => setOpen(o => !o)}
                className="relative w-10 h-10 rounded-lg hover:bg-[var(--acq-ink-soft)] grid place-items-center transition">
                <Bell className="w-[18px] h-[18px] text-[var(--acq-ink)]" />
                {unread > 0 && (
                    <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--acq-red)] text-white text-[10px] font-bold grid place-items-center border-2 border-[var(--acq-surface)]">
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute top-full right-0 mt-2 w-[380px] max-w-[calc(100vw-32px)] rounded-xl border border-[var(--acq-ink-soft)] bg-[var(--acq-surface)] shadow-lg z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--acq-ink-soft)]">
                        <div className="text-sm font-semibold text-[var(--acq-ink)]">Notifiche</div>
                        {unread > 0 && (
                            <button onClick={() => onMarkAllRead?.()}
                                className="text-xs font-semibold text-[var(--acq-blue)] hover:underline">
                                Segna tutte lette
                            </button>
                        )}
                    </div>

                    <div className="max-h-[400px] overflow-auto">
                        {notifications.length === 0 && (
                            <div className="p-8 text-center text-sm text-[var(--acq-ink-sub)]">
                                Nessuna notifica
                            </div>
                        )}
                        {notifications.map(n => (
                            <button key={n.id}
                                onClick={() => {
                                    if (!n.read_at) onMarkRead?.(n.id)
                                    if (n.href) onNavigate?.(n.href)
                                    setOpen(false)
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-[var(--acq-bg)] border-b border-[var(--acq-ink-hair)] last:border-0 flex gap-3">
                                {!n.read_at && <span className="w-2 h-2 rounded-full bg-[var(--acq-blue)] mt-1.5 flex-shrink-0" />}
                                <div className={`flex-1 ${n.read_at ? 'pl-[14px]' : ''}`}>
                                    <div className="text-sm font-semibold text-[var(--acq-ink)]">{n.title}</div>
                                    {n.body && <div className="text-xs text-[var(--acq-ink-sub)] mt-0.5 line-clamp-2">{n.body}</div>}
                                    <div className="text-[11px] text-[var(--acq-ink-sub)] mt-1 font-mono">{fmtDateRelative(n.created_at)}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
