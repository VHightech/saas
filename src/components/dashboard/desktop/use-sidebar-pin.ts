'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

/** Preferenza "barra laterale bloccata aperta", per browser. */
const SIDEBAR_PIN_KEY = 'acqdash:user:sidebar-pinned'

type Listener = (pinned: boolean) => void

// La barra e il <main> di ogni pagina sono componenti fratelli, quindi la
// preferenza vive in uno store di modulo e ognuno si iscrive: quando si preme
// il pin la barra resta aperta e il contenuto si sposta nello stesso istante.
// Sta in localStorage perche' e' una comodita' del browser, non un dato di
// dominio (nessuna colonna su profiles).
let pinned = false
let hydrated = false
const listeners = new Set<Listener>()

function readStored(): boolean {
    try {
        return window.localStorage.getItem(SIDEBAR_PIN_KEY) === '1'
    } catch {
        // Storage negato (finestra privata, cookie bloccati): resta hover-only.
        return false
    }
}

function setPinned(next: boolean) {
    pinned = next
    try {
        window.localStorage.setItem(SIDEBAR_PIN_KEY, next ? '1' : '0')
    } catch {
        // La preferenza vale solo per questa sessione: nessun errore all'utente.
    }
    listeners.forEach((notify) => notify(next))
}

/**
 * Stato "barra bloccata aperta" condiviso tra la sidebar e il contenuto.
 * `mounted` resta false al primo render: la preferenza si legge nell'effect di
 * mount, non durante l'idratazione, altrimenti l'HTML del server (barra chiusa)
 * non combacerebbe.
 */
export function useSidebarPin() {
    const [state, setState] = useState({ mounted: false, pinned: false })

    useEffect(() => {
        if (!hydrated) {
            hydrated = true
            pinned = readStored()
        }
        setState({ mounted: true, pinned })

        const notify: Listener = (next) => setState({ mounted: true, pinned: next })
        listeners.add(notify)
        return () => { listeners.delete(notify) }
    }, [])

    return {
        mounted: state.mounted,
        pinned: state.pinned,
        togglePin: () => setPinned(!pinned),
    }
}

/**
 * Margine sinistro del <main>: la sidebar e' `fixed`, quindi il contenuto va
 * spostato a mano. Con la barra bloccata aperta resta larga 240px, altrimenti
 * 80px (l'apertura al passaggio del mouse resta sovrapposta al contenuto).
 */
export function sidebarMainOffset(pinned: boolean): string {
    return cn('transition-[margin] duration-300 ease-out', pinned ? 'ml-60' : 'ml-20')
}
