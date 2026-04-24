'use server'

/**
 * Example Server Actions for Acqdash — drop these patterns into src/actions/.
 * Uses your existing `createClient()` from '@/lib/supabase/server'.
 */

import { createClient } from '@/lib/supabase/server'
import type { AppNotification, ConsumptionAlert, Supply } from '@/types/dashboard-extended'
import type { Bill } from '@/types/dashboard'

export async function listUserSupplies(): Promise<Supply[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('user_supplies')
        .select('*')
        .order('is_primary', { ascending: false })
    if (error) throw error
    return (data ?? []) as unknown as Supply[]
}

export async function listUserNotifications(limit = 20): Promise<AppNotification[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
    if (error) throw error
    return (data ?? []) as unknown as AppNotification[]
}

export async function markNotificationRead(id: string): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
    if (error) throw error
}

export async function markAllNotificationsRead(): Promise<void> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('read_at', null)
    if (error) throw error
}

export async function listOpenAlerts(): Promise<ConsumptionAlert[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('consumption_alerts')
        .select('*')
        .is('resolved_at', null)
        .order('detected_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as unknown as ConsumptionAlert[]
}

export async function listBillsForSupply(supplyUlm?: string): Promise<Bill[]> {
    const supabase = await createClient()
    let q = supabase.from('bills').select('*').order('data_emissione', { ascending: false })
    if (supplyUlm) q = q.eq('ulm', supplyUlm)
    const { data, error } = await q
    if (error) throw error
    return (data ?? []) as unknown as Bill[]
}
