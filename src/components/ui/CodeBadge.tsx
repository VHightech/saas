'use client'

import { useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CodeBadgeProps {
    value: string
    label?: string
    copyable?: boolean
    /** Use the monospace font for the value (default true). */
    mono?: boolean
    /**
     * Frosted-glass variant for use on top of dark/gradient backgrounds
     * (e.g. the supply card and Ultima Bolletta hero). Defaults to false
     * which renders the standard surface variant suitable for white/dark cards.
     */
    light?: boolean
}

/**
 * Pill that displays a labelled code (CIF, ULM, Codice Cliente, …) with an
 * optional one-tap copy affordance and a 2-second "Copiato!" confirmation.
 *
 * Pointer-down events are stopped on the interactive elements so the parent
 * carousel (or any drag-scroll surface) cannot swallow the click.
 */
export function CodeBadge({
    value,
    label,
    copyable = false,
    mono = true,
    light = false,
}: CodeBadgeProps) {
    const [copied, setCopied] = useState(false)

    const copy = async (e: ReactMouseEvent | ReactPointerEvent) => {
        e.stopPropagation()
        if (!copyable || !value) return
        try {
            await navigator.clipboard.writeText(value)
        } catch {
            // Clipboard access can be denied — silently no-op rather than
            // leaking a stack trace to the user.
        }
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const Wrapper = (copyable ? 'button' : 'span') as 'button' | 'span'
    const wrapperProps = copyable
        ? {
              type: 'button' as const,
              onClick: copy,
              onPointerDown: (e: ReactPointerEvent) => e.stopPropagation(),
              title: `Copia ${value}`,
          }
        : {}

    return (
        <div className="group/badge relative inline-flex items-center gap-1.5">
            <Wrapper
                {...wrapperProps}
                className={cn(
                    'relative inline-flex items-center h-7 px-3 rounded-full max-w-full transition-all duration-300',
                    light
                        ? cn(
                              'bg-white/10 backdrop-blur-md border border-white/10',
                              copyable && 'cursor-pointer hover:bg-white/20 active:scale-[0.98]',
                              copied && 'border-emerald-400/50 bg-emerald-500/20',
                          )
                        : cn(
                              'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10',
                              copyable && 'cursor-pointer hover:border-slate-300 dark:hover:border-white/20 active:scale-[0.98]',
                              copied && 'border-emerald-500/50 bg-emerald-50 dark:bg-emerald-500/10',
                          ),
                )}
            >
                <div className="flex items-center gap-2 min-w-0">
                    {label && (
                        <span
                            className={cn(
                                'text-[8px] font-bold uppercase tracking-wider transition-colors duration-300 shrink-0',
                                copied
                                    ? light ? 'text-emerald-300/80' : 'text-emerald-500/70'
                                    : light ? 'text-white/70' : 'text-slate-400 dark:text-slate-400',
                            )}
                        >
                            {label}
                        </span>
                    )}
                    <span
                        className={cn(
                            'text-[11px] font-bold truncate transition-all duration-300 tabular-nums',
                            mono && 'font-mono',
                            copyable && (light
                                ? 'group-hover/badge:text-white group-hover/badge:underline group-hover/badge:decoration-white underline-offset-2'
                                : 'group-hover/badge:text-emerald-600 dark:group-hover/badge:text-emerald-400 group-hover/badge:underline group-hover/badge:decoration-emerald-500 underline-offset-2'),
                            copied
                                ? light ? 'text-emerald-300' : 'text-emerald-700 dark:text-emerald-400'
                                : light ? 'text-white' : 'text-slate-700 dark:text-slate-200',
                        )}
                    >
                        {copied ? 'Copiato!' : value}
                    </span>
                </div>
            </Wrapper>

            {copyable && (
                <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={copy}
                    aria-label={`Copia ${value}`}
                    className={cn(
                        'w-6 h-6 shrink-0 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer origin-left',
                        copied
                            ? 'opacity-100 scale-100 translate-x-0 bg-emerald-600 text-white'
                            : cn(
                                  'opacity-0 -translate-x-2 pointer-events-none group-hover/badge:opacity-100 group-hover/badge:translate-x-0 group-hover/badge:pointer-events-auto text-white',
                                  light
                                      ? 'bg-white text-emerald-800 hover:bg-white/90'
                                      : 'bg-slate-900 dark:bg-white dark:text-[#1A1F2A] hover:bg-slate-800 dark:hover:bg-white/90',
                              ),
                    )}
                >
                    {copied ? <Check size={10} strokeWidth={3} /> : <Copy size={10} strokeWidth={2.5} />}
                </button>
            )}
        </div>
    )
}
