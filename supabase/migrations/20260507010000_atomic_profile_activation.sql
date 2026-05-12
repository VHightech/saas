-- Migration: 20260507010000_atomic_profile_activation.sql
-- Description:
--   Creates an atomic, advisory-locked RPC function `activate_shadow_profile`
--   that merges a shadow profile into the real auth user in a single transaction.
--   This prevents race conditions when the same user clicks the activation link
--   multiple times (double-click, two devices, etc.)

CREATE OR REPLACE FUNCTION public.activate_shadow_profile(
    p_real_user_id    UUID,
    p_codice_cliente  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_shadow_id     UUID;
    v_lock_key      BIGINT;
    v_lock_acquired BOOLEAN;
    v_result        JSONB;
BEGIN
    -- 1. Derive a deterministic advisory lock key from the codice_cliente.
    --    hashtext() is stable and fast. The lock ensures only ONE call
    --    per codice_cliente can run the migration at a time.
    v_lock_key := hashtext('activate:' || p_codice_cliente);

    -- Try to acquire the lock (non-blocking so we don't deadlock).
    -- pg_try_advisory_xact_lock releases automatically at end of transaction.
    v_lock_acquired := pg_try_advisory_xact_lock(v_lock_key);

    IF NOT v_lock_acquired THEN
        -- Another session is already activating this same account.
        -- Return a signal that the caller can safely ignore / retry.
        RETURN jsonb_build_object(
            'status', 'already_in_progress',
            'message', 'Activation is already running for this account.'
        );
    END IF;

    -- 2. Find the shadow profile (must be is_shadow = true for this codice_cliente).
    SELECT id INTO v_shadow_id
    FROM public.profiles
    WHERE codice_cliente = p_codice_cliente
      AND is_shadow = true
    LIMIT 1
    FOR UPDATE;  -- Row-level lock: prevents concurrent reads of same row

    -- 3a. No shadow found → the account is already activated (or never existed).
    IF v_shadow_id IS NULL THEN
        -- Just make sure the real profile is not shadow.
        UPDATE public.profiles
        SET is_shadow = false
        WHERE id = p_real_user_id;

        RETURN jsonb_build_object(
            'status', 'already_activated',
            'message', 'No shadow profile found. Account may already be active.'
        );
    END IF;

    -- 3b. Shadow found and we have the lock. Do NOT re-check — we own the row.

    -- 4. Re-link all bills from shadow UUID → real UUID
    UPDATE public.bills
    SET user_id = p_real_user_id
    WHERE user_id = v_shadow_id;

    -- 5. Re-link all user_supplies from shadow UUID → real UUID
    UPDATE public.user_supplies
    SET user_id = p_real_user_id
    WHERE user_id = v_shadow_id;

    -- 6. Re-link payments
    UPDATE public.payments
    SET user_id = p_real_user_id
    WHERE user_id = v_shadow_id;

    -- 7. Upsert the real profile row, copying all metadata from the shadow.
    --    ON CONFLICT handles the skeleton that handle_new_user() may have created.
    INSERT INTO public.profiles (
        id, email, name, username, cfpi, cif, codice_cliente,
        role, phone, is_shadow, created_at
    )
    SELECT
        p_real_user_id,    -- real auth UUID
        p.email,
        p.name,
        COALESCE(p.username, p.email),
        p.cfpi,
        p.cif,
        p.codice_cliente,
        COALESCE(p.role, 'user'),
        p.phone,
        false,             -- is_shadow = false
        p.created_at
    FROM public.profiles p
    WHERE p.id = v_shadow_id
    ON CONFLICT (id) DO UPDATE SET
        codice_cliente = EXCLUDED.codice_cliente,
        cif            = EXCLUDED.cif,
        cfpi           = EXCLUDED.cfpi,
        name           = EXCLUDED.name,
        phone          = EXCLUDED.phone,
        role           = EXCLUDED.role,
        is_shadow      = false;

    -- 8. Delete the old shadow row (safe: we migrated everything above)
    DELETE FROM public.profiles
    WHERE id = v_shadow_id;

    v_result := jsonb_build_object(
        'status',     'success',
        'shadow_id',  v_shadow_id,
        'real_id',    p_real_user_id,
        'message',    'Profile activated successfully.'
    );

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    -- Bubble the error so the caller sees it; transaction auto-rolls back.
    RAISE EXCEPTION 'activate_shadow_profile failed for %: %', p_codice_cliente, SQLERRM;
END;
$$;

-- Allow the service role (used by admin client) to call this function
GRANT EXECUTE ON FUNCTION public.activate_shadow_profile(UUID, TEXT) TO service_role;

-- Revoke from anon / authenticated for safety (server-side only)
REVOKE EXECUTE ON FUNCTION public.activate_shadow_profile(UUID, TEXT) FROM anon, authenticated;

COMMENT ON FUNCTION public.activate_shadow_profile IS
    'Atomically migrates a shadow profile to a real auth user. '
    'Advisory-locked per codice_cliente to be safe under concurrent calls. '
    'Call from setFirstPassword server action using the admin client.';

NOTIFY pgrst, 'reload schema';
