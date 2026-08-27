'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

// Password Complexity: min 8 chars, uppercase, lowercase, digit, special char.
// Same rule used in /register and /forgot-password for consistency.
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"|\<\>?,./`~]).{8,}$/

export async function setFirstPassword(formData: FormData) {
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
        redirect('/login')
    }

    // Validate password first — no point touching the DB if the form is invalid.
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string

    if (!password || !confirmPassword) {
        return { error: 'Compila entrambi i campi password.' }
    }

    if (password !== confirmPassword) {
        return { error: 'Le password non coincidono.' }
    }

    if (!PASSWORD_REGEX.test(password)) {
        return {
            error: 'La password deve contenere almeno 8 caratteri, una lettera maiuscola, una minuscola, un numero e un carattere speciale (es. ! @ # $ % & *).',
        }
    }

    // 1. Set the password in Auth.
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
        console.error('[setFirstPassword] updateUser error:', updateError.message)
        return { error: 'Impossibile salvare la password. Riprova.' }
    }

    // Admin client for role resolution + shadow-profile activation.
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const adminClient = createAdminClient()

    // Post-activation destination: admins go to the admin area, everyone else to
    // /profile. Resolve by auth_user_id, falling back to id (invite/script-created
    // profiles link via id). This is why admins were landing on the user view.
    const destForRole = async (): Promise<string> => {
        let { data: roleRow } = await adminClient
            .from('profiles').select('role').eq('auth_user_id', user.id).maybeSingle()
        if (!roleRow) {
            const byId = await adminClient.from('profiles').select('role').eq('id', user.id).maybeSingle()
            roleRow = byId.data
        }
        const role = roleRow?.role
        return role === 'admin' || role === 'super_admin' || role === 'superadmin'
            ? '/admin/users'
            : '/profile'
    }

    // 2. Get codice_cliente from metadata.
    // IMPORTANT: inviteUserByEmail({ data: { codice_cliente } }) stores the payload
    // in app_metadata (raw_app_meta_data), NOT user_metadata (raw_user_meta_data).
    const codiceCliente = user.app_metadata?.codice_cliente
                       ?? user.user_metadata?.codice_cliente

    if (!codiceCliente) {
        // Admin invites carry no codice_cliente (this is the admin path), as do
        // direct signups already profile-linked by the handle_new_user trigger.
        revalidatePath('/', 'layout')
        redirect(await destForRole())
    }

    // 3. Idempotent activation: links the existing shadow profile to this
    //    auth user by setting auth_user_id. No row migration, no FK ordering
    //    concerns — bills/supplies/payments already FK the shadow's profiles.id.
    const { data: activationResult, error: activationError } = await adminClient
        .rpc('activate_shadow_profile', {
            p_real_user_id:   user.id,
            p_codice_cliente: codiceCliente,
        })

    if (activationError) {
        console.error('[setFirstPassword] activate_shadow_profile RPC failed:', activationError.message)
        // Password was already saved — don't return a hard error, log and continue.
        // The user can still log in; data will be reconciled by mass_link_orphaned_data().
    } else {
        const status = (activationResult as { status: string })?.status
        if (status === 'already_in_progress') {
            // Another device/tab is processing the same activation — this one can stop.
            console.info('[setFirstPassword] Activation already in progress for:', codiceCliente)
        } else {
            console.info('[setFirstPassword] Activation result:', activationResult)
        }
    }

    revalidatePath('/', 'layout')
    redirect(await destForRole())
}
