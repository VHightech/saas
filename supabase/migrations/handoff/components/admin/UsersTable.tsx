'use client'

/**
 * Admin shell — users table with search, role badge, row actions.
 * Drop into src/components/admin/UsersTable.tsx
 */

import * as React from 'react'
import { Search, MoreVertical, Shield, User as UserIcon } from 'lucide-react'
import type { Profile } from '@/types/dashboard'
import { fmtDate } from '@/lib/format'

export function UsersTable({ users, onOpen }: { users: Profile[]; onOpen?: (u: Profile) => void }) {
    const [q, setQ] = React.useState('')
    const filtered = users.filter(u => {
        const s = `${u.name ?? ''} ${u.email ?? ''} ${u.codice_cliente ?? ''}`.toLowerCase()
        return !q || s.includes(q.toLowerCase())
    })
    return (
        <div className="rounded-2xl border border-[var(--acq-ink-soft)] bg-[var(--acq-surface)]">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--acq-ink-soft)]">
                <div className="flex-1 flex items-center gap-2 px-3 h-9 rounded-lg bg-[var(--acq-bg)]">
                    <Search className="w-4 h-4 text-[var(--acq-ink-sub)]" />
                    <input value={q} onChange={e => setQ(e.target.value)}
                        placeholder="Cerca per nome, email, codice cliente…"
                        className="flex-1 bg-transparent outline-none text-sm text-[var(--acq-ink)]" />
                </div>
                <div className="text-xs font-mono text-[var(--acq-ink-sub)]">{filtered.length}</div>
            </div>

            <div className="divide-y divide-[var(--acq-ink-hair)]">
                {filtered.map(u => {
                    const isAdmin = u.role === 'admin' || u.role === 'super_admin'
                    return (
                        <button key={u.id} onClick={() => onOpen?.(u)}
                            className="w-full flex items-center gap-4 px-5 py-3 hover:bg-[var(--acq-bg)] text-left">
                            <div className="w-10 h-10 rounded-full bg-[var(--acq-ink-soft)] text-[var(--acq-ink)] grid place-items-center font-semibold text-sm">
                                {(u.name ?? u.email ?? '?').slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-[var(--acq-ink)] truncate">{u.name ?? u.username ?? u.email}</div>
                                <div className="text-xs text-[var(--acq-ink-sub)] truncate font-mono">{u.email} · {u.codice_cliente ?? '—'}</div>
                            </div>
                            <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${isAdmin ? 'bg-[var(--acq-deep-blue)]/10 text-[var(--acq-deep-blue)]' : 'bg-[var(--acq-ink-soft)] text-[var(--acq-ink-sub)]'}`}>
                                {isAdmin ? <Shield className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                                {u.role ?? 'user'}
                            </div>
                            <MoreVertical className="w-4 h-4 text-[var(--acq-ink-sub)]" />
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
