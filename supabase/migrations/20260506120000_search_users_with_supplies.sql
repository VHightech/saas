-- Migration: 20260506120000_search_users_with_supplies.sql
-- Description: Updates search_users RPC to include supply data from user_supplies table.

DROP FUNCTION IF EXISTS public.search_users(text, int, int, text, text, text, text);

CREATE OR REPLACE FUNCTION public.search_users(
    search_term     text,
    _limit          int     default 10,
    _offset         int     default 0,
    _status_filter  text    default 'all',
    _shadow_filter  text    default 'all',
    _sort_by        text    default 'created_at',
    _sort_order     text    default 'desc'
)
RETURNS TABLE (
    id                  uuid,
    email               text,
    name                text,
    cfpi                text,
    codice_cliente      text,
    created_at          timestamptz,
    is_shadow           boolean,
    bills_count         int,
    user_supplies_count int,
    user_supplies       jsonb,
    total_count         bigint
) AS $$
DECLARE
    search_tokens text[];
    sort_col      text;
    sort_dir      text;
BEGIN
    -- SECURITY CHECK
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role IN ('admin', 'super_admin', 'superadmin')
    ) THEN
        RAISE EXCEPTION 'Access Denied: Admin privileges required.';
    END IF;

    -- Whitelist sort column
    sort_col := CASE lower(_sort_by)
        WHEN 'name'                THEN 'name'
        WHEN 'bills_count'         THEN 'bills_count'
        WHEN 'user_supplies_count' THEN 'user_supplies_count'
        ELSE 'created_at'
    END;
    sort_dir := CASE lower(_sort_order)
        WHEN 'asc' THEN 'asc'
        ELSE 'desc'
    END;

    search_tokens := string_to_array(trim(coalesce(search_term, '')), ' ');

    RETURN QUERY EXECUTE format($q$
        WITH base_users AS (
            SELECT
                p.id, p.email, p.name, p.cfpi, p.codice_cliente,
                p.created_at, p.is_shadow,
                p.bills_count,
                p.user_supplies_count
            FROM public.profiles p
            WHERE p.role NOT IN ('admin', 'super_admin', 'superadmin')
              AND ($1 = 'all'
                   OR ($1 = 'active' AND coalesce(p.is_shadow, false) = false)
                   OR ($1 = 'shadow' AND coalesce(p.is_shadow, false) = true))
               AND (
                    coalesce(array_length($2, 1), 0) = 0
                 OR (
                    SELECT bool_and(
                        concat_ws(' ',
                            p.name, p.email, p.cfpi, p.codice_cliente
                        ) ILIKE '%%' || token || '%%'
                        OR EXISTS (
                            SELECT 1 FROM public.user_supplies s
                            WHERE s.codice_cliente = p.codice_cliente
                              AND (s.cif ILIKE '%%' || token || '%%' OR s.address ILIKE '%%' || token || '%%')
                        )
                        OR EXISTS (
                            SELECT 1 FROM public.bills b
                            WHERE b.codice_cliente = p.codice_cliente
                              AND (b.idboll::text ILIKE '%%' || token || '%%')
                        )
                    )
                    FROM unnest($2) AS token
                    WHERE token <> ''
                 )
              )
        ),
        user_with_supplies AS (
            SELECT 
                u.*,
                COALESCE(
                    (SELECT jsonb_agg(jsonb_build_object(
                        'cif', s.cif,
                        'address', s.address,
                        'city', s.city
                    ))
                     FROM public.user_supplies s
                     WHERE s.codice_cliente = u.codice_cliente),
                    '[]'::jsonb
                ) as user_supplies
            FROM base_users u
        ),
        counted AS (
            SELECT *, (SELECT count(*) FROM base_users)::bigint AS total_count
            FROM user_with_supplies
        )
        SELECT id, email, name, cfpi, codice_cliente,
               created_at, is_shadow,
               bills_count, user_supplies_count, user_supplies, total_count
        FROM counted
        ORDER BY %I %s NULLS LAST, id DESC
        LIMIT $3 OFFSET $4
    $q$, sort_col, sort_dir)
    USING _shadow_filter, search_tokens, _limit, _offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
