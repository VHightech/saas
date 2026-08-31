'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireSuperadmin, requireUserManagement } from '@/lib/auth-checks'
import { notifyEmailAssociated } from '@/lib/emails/notify-email-associated'

export async function deleteUser(userId: string) {
    const authCheck = await requireSuperadmin()
    if (authCheck.error) {
        return { error: authCheck.error }
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )

    if (authCheck.user?.id === userId) {
        return { error: 'Non puoi eliminare il tuo stesso account.' }
    }

    // 1. Delete from Auth (this usually cascades to public.profiles if configured, but let's be safe)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (authError) {
        console.error('Error deleting auth user:', authError)
        return { error: 'Errore durante la cancellazione dell\'utente auth.' }
    }

    // 2. Delete from Public Profiles (if cascade didn't handle it or if user was just shadow)
    const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', userId)

    if (profileError) {
        console.error('Error deleting profile:', profileError)
        // If auth deletion succeeded, we might still want to return success or warning
        return { error: 'Utente Auth eliminato, ma errore eliminazione profilo.' }
    }

    revalidatePath('/admin/users')
    return { success: true }
}

export async function updateUser(userId: string, data: {
    name?: string
    email?: string
    phone?: string
    codice_fiscale?: string
    partita_iva?: string
    pec?: string
    codice_cliente?: string
}) {
    const authCheck = await requireUserManagement()
    if (authCheck.error) {
        return { error: authCheck.error }
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )

    // Resolve the AUTH user id. For shadow-claimed profiles, profiles.id is NOT
    // the auth.users id — the link is auth_user_id. Updating auth by profiles.id
    // silently hit nothing, which is why the login email never changed.
    const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('auth_user_id, email, name')
        .eq('id', userId)
        .maybeSingle()
    const authUserId = (prof?.auth_user_id as string | null) || null
    const currentEmail = (prof?.email as string | null) || null
    const currentName = (prof?.name as string | null) || null

    // Indirizzo associato ora: aggiunto dove mancava (hadEmail = false) oppure
    // corretto. Serve per decidere se e come notificare il cliente al punto 3.
    const nextEmail = (data.email || '').trim()
    const hadEmail = (currentEmail || '').trim().length > 0
    const emailAssociated =
        nextEmail.length > 0 &&
        nextEmail.toLowerCase() !== (currentEmail || '').trim().toLowerCase()

    // 1. Update the auth email ONLY when it actually changed. The GoTrue admin
    //    call is a network round-trip; firing it on every save (e.g. a name-only
    //    edit) made saving slow. email_confirm:true applies the new address
    //    immediately. Errors are surfaced, not swallowed.
    const emailChanged =
        !!data.email && !!authUserId &&
        (data.email || '').trim().toLowerCase() !== (currentEmail || '').trim().toLowerCase()

    if (emailChanged) {
        const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId as string, {
            email: data.email,
            email_confirm: true,
        })
        if (authErr) {
            console.error('Auth email update failed:', authErr.message)
            return { error: `Impossibile aggiornare l'email di accesso: ${authErr.message}` }
        }
    }

    // 2. Update Public Profile
    const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
            name: data.name,
            email: data.email,
            phone: data.phone,
            codice_fiscale: data.codice_fiscale,
            partita_iva: data.partita_iva,
            pec: data.pec,
            ...(data.codice_cliente !== undefined ? { codice_cliente: data.codice_cliente } : {}),
        })
        .eq('id', userId)

    if (profileError) {
        console.error('Error updating profile:', profileError)
        return { error: 'Errore durante l\'aggiornamento del profilo.' }
    }

    // 3. Notifica al cliente che il suo indirizzo e' stato associato/aggiornato.
    //
    //    VERIFICATO il 2026-08-31: la security notification "Email address
    //    changed" di Supabase, benche' abilitata, NON scatta per una modifica
    //    fatta via admin API. `admin.updateUserById(..., { email_confirm: true })`
    //    e' una scrittura amministrativa e marca l'indirizzo come gia' confermato,
    //    quindi non esiste il flusso di cambio email da cui nascerebbe. Il canale
    //    email funziona (invito e set-password arrivano), quindi non e' un
    //    problema di consegna: quell'evento non viene emesso.
    //    -> nessuna utenza, ne' shadow ne' attivata, viene avvisata da Supabase.
    //       Se serve la notifica, e' la nostra o niente.
    //
    //    Nota: anche se Supabase la inviasse, non sarebbe un doppione — la sua
    //    security notification va al vecchio indirizzo (avvisa chi possedeva
    //    l'account), la nostra al nuovo. Sono complementari.
    //
    //    Ogni esito e' visibile all'operatore. Il silenzio sul caso "non
    //    configurato" era giustificato quando un trasporto non c'era per scelta;
    //    ora che l'SMTP e' configurato, quel caso significa che il deployment in
    //    esecuzione non ha le variabili — su Vercel le modifiche all'ambiente non
    //    raggiungono un deployment gia' avviato, serve un nuovo deploy. E'
    //    un'anomalia, non uno stato normale: nasconderla lascia l'operatore a
    //    chiedersi perche' il cliente non riceve niente.
    //    Best-effort e DOPO la scrittura: il dato e' gia' salvato, un problema di
    //    consegna non deve annullare il lavoro dell'operatore.
    let emailNotified = false
    let emailNotice: string | undefined
    if (emailAssociated) {
        const res = await notifyEmailAssociated({
            to: nextEmail,
            name: data.name ?? currentName,
            mode: hadEmail ? 'updated' : 'added',
        })
        if (res.sent) {
            emailNotified = true
        } else if (res.reason === 'not_configured') {
            console.warn('[updateUser] notifica saltata: variabili SMTP non lette dal server')
            emailNotice = 'Dati salvati. Notifica NON inviata: il server non legge la configurazione SMTP. Verifica le variabili su Vercel e rifai il deploy.'
        } else {
            emailNotice = `Dati salvati. Notifica NON inviata, errore di consegna: ${res.detail ?? 'causa non riportata dal server SMTP'}`
        }
    }

    // No revalidatePath: the admin pages are client-rendered and re-fetch their
    // own data, while the edit form merges the saved fields into local state.
    // Calling revalidatePath here only forced a router refresh that re-ran the
    // admin layout's auth round-trip on every save — the source of the lag.
    return { success: true, emailNotified, warning: emailNotice }
}

export async function resetUserPassword(userId: string) {
    const authCheck = await requireUserManagement()
    if (authCheck.error) {
        return { error: authCheck.error }
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )

    // Resolve the AUTH user id (auth_user_id) + email from the profile. Using
    // profiles.id as the auth id fails for shadow-claimed users.
    const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('auth_user_id, email')
        .eq('id', userId)
        .maybeSingle()

    const authUserId = (prof?.auth_user_id as string | null) || null
    const email = (prof?.email as string | null) || null

    if (!authUserId || !email) {
        return { error: 'Utente non registrato: nessun account di accesso da reimpostare.' }
    }

    // Send the recovery email automatically. Calling this from the SERVER with the
    // service-role client bypasses the Turnstile captcha (the captcha only applies
    // to the public/browser endpoint — that was the source of the "captcha_token"
    // error). Supabase delivers the email via its configured provider (Resend).
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/auth/set-password?recovery=1`,
    })

    if (error) {
        console.error('Reset email failed:', error.message)
        return { error: `Errore durante l'invio dell'email di reset: ${error.message}` }
    }

    return { success: true }
}

/**
 * Reset a user's activation: deletes their auth account and returns the profile
 * to "shadow" state (auth_user_id = null, is_shadow = true) so the next "first
 * access" sends a brand-new invite instead of a password-reset link. Bills /
 * supplies / payments are untouched (they FK profiles.id, not auth_user_id).
 * Super_admin only; admins are managed from the admin roster, not here.
 */
export async function resetActivation(userId: string) {
    const authCheck = await requireSuperadmin()
    if (authCheck.error) return { error: authCheck.error }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('auth_user_id, role')
        .eq('id', userId)
        .maybeSingle()

    if (!prof) return { error: 'Profilo non trovato.' }
    if (prof.role && ['admin', 'super_admin', 'superadmin'].includes(prof.role as string)) {
        return { error: 'Gli amministratori si gestiscono dalla pagina Amministratori.' }
    }

    // Order matters: clear the profile -> auth link FIRST, otherwise the FK
    // profiles.auth_user_id -> auth.users(id) blocks the auth user deletion.
    const { error: updErr } = await supabaseAdmin
        .from('profiles')
        .update({ auth_user_id: null, is_shadow: true })
        .eq('id', userId)

    if (updErr) {
        console.error('resetActivation update:', updErr.code)
        return { error: 'Errore durante il ripristino del profilo.' }
    }

    if (prof.auth_user_id) {
        const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(prof.auth_user_id as string)
        if (delErr && !/not.?found|user.?not.?found/i.test(delErr.message)) {
            console.error('resetActivation deleteUser:', delErr.message)
            return { error: `Profilo ripristinato, ma account di accesso non rimosso: ${delErr.message}` }
        }
    }

    revalidatePath(`/admin/users/${userId}`)
    revalidatePath('/admin/users')
    return { success: true }
}

// Per-supply contact email. Distinct from profiles.email (the login email):
// each fornitura can have its own recipient address.
const SUPPLY_EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/

function normalizeSupplyEmail(raw: string): { value: string | null } | { invalid: true } {
    const trimmed = raw.trim().toLowerCase()
    if (!trimmed) return { value: null }
    if (!SUPPLY_EMAIL_REGEX.test(trimmed)) return { invalid: true }
    return { value: trimmed }
}

export async function updateUserSupply(cif: string, data: { address?: string; city?: string; email?: string }, userId?: string) {
    const authCheck = await requireUserManagement()
    if (authCheck.error) return { error: authCheck.error }

    let email: string | null | undefined
    if (data.email !== undefined) {
        const normalized = normalizeSupplyEmail(data.email)
        if ('invalid' in normalized) return { error: 'Indirizzo email non valido.' }
        email = normalized.value
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { error } = await supabaseAdmin
        .from('user_supplies')
        .update({
            ...(data.address !== undefined ? { address: data.address } : {}),
            ...(data.city !== undefined ? { city: data.city } : {}),
            ...(email !== undefined ? { email } : {}),
        })
        .eq('cif', cif)

    if (error) {
        console.error('Error updating supply:', error.code)
        return { error: 'Errore durante l\'aggiornamento della fornitura.' }
    }

    // No revalidatePath (see updateUser): avoids the layout-refresh round-trip.
    void userId
    return { success: true }
}

export async function deleteSupply(cif: string, userId?: string) {
    const authCheck = await requireSuperadmin()
    if (authCheck.error) return { error: authCheck.error }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )

    const { error } = await supabaseAdmin
        .from('user_supplies')
        .delete()
        .eq('cif', cif)

    if (error) {
        console.error('Error deleting supply:', error)
        return { error: 'Errore durante la cancellazione della fornitura.' }
    }

    if (userId) {
        revalidatePath(`/admin/users/${userId}`)
    }
    revalidatePath('/admin/users')
    return { success: true }
}
