-- Migration: 20260511010000_fix_activate_shadow_profile_order.sql
-- Description:
--   Fix activate_shadow_profile() order-of-operations bug:
--   The previous version UPDATEd bills.user_id (and user_supplies, payments)
--   to the real auth UUID BEFORE inserting the corresponding profiles row.
--   bills.user_id (and friends) has a FK against profiles.id (or auth.users.id),
--   so the UPDATE fails with:
--     "insert or update on table 'bills' violates foreign key constraint 'bills_user_id_fkey'"
--
--   New order:
--     1. Upsert the real profile row from the shadow's data.
--     2. Re-link bills / user_supplies / payments.
--     3. Delete the shadow row (its children are already migrated).

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
BEGIN
    v_lock_key := hashtext('activate:' || p_codice_cliente);
    v_lock_acquired := pg_try_advisory_xact_lock(v_lock_key);

    IF NOT v_lock_acquired THEN
        RETURN jsonb_build_object(
            'status', 'already_in_progress',
            'message', 'Activation is already running for this account.'
        );
    END IF;

    -- 1. Locate the shadow profile.
    SELECT id INTO v_shadow_id
    FROM public.profiles
    WHERE codice_cliente = p_codice_cliente
      AND is_shadow = true
    LIMIT 1
    FOR UPDATE;

    -- 1a. Already activated — just ensure the real profile is not shadow.
    IF v_shadow_id IS NULL THEN
        UPDATE public.profiles
        SET is_shadow = false
        WHERE id = p_real_user_id;

        RETURN jsonb_build_object(
            'status', 'already_activated',
            'message', 'No shadow profile found. Account may already be active.'
        );
    END IF;

    -- 2. Upsert the real profile row FIRST so children FKs are satisfiable.
    --    Copy all metadata from the shadow.
    INSERT INTO public.profiles (
        id, email, name, username, cfpi, cif, codice_cliente,
        role, phone, is_shadow, created_at
    )
    SELECT
        p_real_user_id,
        p.email,
        p.name,
        COALESCE(p.username, p.email),
        p.cfpi,
        p.cif,
        p.codice_cliente,
        COALESCE(p.role, 'user'),
        p.phone,
        false,
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

    -- 3. Re-link child rows from shadow UUID to real UUID. FK now satisfied.
    UPDATE public.bills          SET user_id = p_real_user_id WHERE user_id = v_shadow_id;
    UPDATE public.user_supplies  SET user_id = p_real_user_id WHERE user_id = v_shadow_id;
    UPDATE public.payments       SET user_id = p_real_user_id WHERE user_id = v_shadow_id;

    -- 4. Remove the shadow row (children already migrated above).
    DELETE FROM public.profiles WHERE id = v_shadow_id;

    RETURN jsonb_build_object(
        'status',    'success',
        'shadow_id', v_shadow_id,
        'real_id',   p_real_user_id,
        'message',   'Profile activated successfully.'
    );

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'activate_shadow_profile failed for %: %', p_codice_cliente, SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_shadow_profile(UUID, TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.activate_shadow_profile(UUID, TEXT) FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
