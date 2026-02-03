'use server'


import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireSuperAdmin } from '@/lib/auth'

export async function createTenant(formData: FormData) {
    // 1. Security Check
    try {
        await requireSuperAdmin()
    } catch (e) {
        return { error: 'Unauthorized' }
    }

    const name = formData.get('name') as string
    const slug = formData.get('slug') as string
    const domain = formData.get('domain') as string
    const primary_color = formData.get('primary_color') as string
    const logo_url = formData.get('logo_url') as string
    const adapter = formData.get('adapter') as string || 'standard-csv'

    // Features (Checkbox handling: FormData only sends them if checked)
    const features = {
        crm: formData.get('feature_crm') === 'on',
        invoicing: formData.get('feature_invoicing') === 'on',
    }

    // Import Mapping handling
    // Import Mapping handling
    const import_mapping_raw = formData.get('import_mapping') as string
    let import_mapping = {}

    if (import_mapping_raw) {
        try {
            import_mapping = JSON.parse(import_mapping_raw)
        } catch (e) {
            console.error('Failed to parse import mapping', e)
        }
    } else {
        // Fallback or empty
        import_mapping = {
            amount: '{{Importo}}',
            expiry_date: '{{Scadenza}}',
            cif: '{{CF}}',
            service_id: '{{POD}}',
            consumption: '{{Consumo}}'
        }
    }

    // Dashboard Layout / Builder Config handling
    const builder_config_raw = formData.get('builder_config') as string
    const dashboard_layout_raw = formData.get('dashboard_layout') as string

    let dashboard_layout: any = {
        // Default Legacy Layout (Fallback)
        admin: {
            left: ['admin_stats', 'recent_uploads'],
            right: ['admin_shortcuts']
        },
        user: {
            left: ['user_widget', 'consumption_chart'],
            right: ['recent_bills', 'expenses_chart']
        }
    }

    if (builder_config_raw) {
        try {
            dashboard_layout = JSON.parse(builder_config_raw)
        } catch (e) {
            console.error('Failed to parse builder config', e)
        }
    } else if (dashboard_layout_raw) {
        try {
            dashboard_layout = JSON.parse(dashboard_layout_raw)
        } catch (e) {
            console.error('Failed to parse dashboard layout', e)
        }
    }

    if (!name || !slug) {
        return { error: 'Name and Slug are required' }
    }

    const supabase = await createClient()

    // 2. Insert into DB
    const { error } = await supabase
        .from('tenants')
        .insert({
            name,
            slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'), // Sanitize slug
            domain: domain ? domain.toLowerCase().trim() : null,  // Sanitize domain
            primary_color,
            logo_url: logo_url || null,
            adapter,
            features,
            import_mapping,
            dashboard_layout
        })

    if (error) {
        if (error.code === '23505') { // Unique constraint violation
            if (error.message.includes('slug')) return { error: 'Slug already exists.' }
            if (error.message.includes('domain')) return { error: 'Domain already exists.' }
        }
        return { error: error.message }
    }

    revalidatePath('/admin/super')
    return { success: true }
}
