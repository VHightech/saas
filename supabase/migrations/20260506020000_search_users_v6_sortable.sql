-- Migration: 20260506020000_search_users_v6_sortable.sql
-- Description: Add _sort_by + _sort_order params to search_users so the admin
-- list can order by bills_count / user_supplies_count / name / created_at,
-- including when no search term is provided. Also returns is_shadow filter.

DROP FUNCTION IF EXISTS public.search_users(text, int, int, text);

CREATE OR REPLACE FUNCTION public.search_users(
    search_term     text,
    _limit          int     default 10,
    _offset         int     default 0,
    _status_filter  text    default 'all',
    _shadow_filter  text    default 'all',          -- 'all' | 'active' | 'shadow'
    _sort_by        text    default 'created_at',   -- created_at | name | bills_count | user_supplies_count
    _sort_order     text    default 'desc'          -- asc | desc
)
RETURNS TABLE (
    id                  uuid,
    email               text,
    name                text,
    username            text,
    cfpi                text,
    cif                 text,
    codice_cliente      text,
    created_at          timestamptz,
    is_shadow           boolean,
    address             text,
    city                text,
    stadio              text,
    stato_contratto     text,
    bills_count         int,
    user_supplies_count int,
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

    -- Whitelist sort column / direction
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
        WITH base AS (
            SELECT
                p.id, p.email, p.name, p.username, p.cfpi, p.cif, p.codice_cliente,
                p.created_at, p.is_shadow, p.address, p.city, p.stadio, p.stato_contratto,
                (SELECT count(*)::int FROM public.bills         b  WHERE b.user_id  = p.id) AS bills_count,
                (SELECT count(*)::int FROM public.user_supplies us WHERE us.user_id = p.id) AS user_supplies_count
            FROM public.profiles p
            WHERE p.role NOT IN ('admin', 'super_admin', 'superadmin')
              AND ($1 = 'all' OR p.stadio = $1)
              AND ($2 = 'all'
                   OR ($2 = 'active' AND coalesce(p.is_shadow, false) = false)
                   OR ($2 = 'shadow' AND coalesce(p.is_shadow, false) = true))
              AND (
                    coalesce(array_length($3, 1), 0) = 0
                 OR (
                    SELECT bool_and(
                        concat_ws(' ',
                            p.name, p.email, p.cif, p.cfpi, p.codice_cliente,
                            p.address, p.city, p.stadio, p.stato_contratto
                        ) ILIKE '%%' || token || '%%'
                    )
                    FROM unnest($3) AS token
                    WHERE token <> ''
                 )
              )
        ),
        counted AS (
            SELECT *, (SELECT count(*) FROM base)::bigint AS total_count
            FROM base
        )
        SELECT id, email, name, username, cfpi, cif, codice_cliente,
               created_at, is_shadow, address, city, stadio, stato_contratto,
               bills_count, user_supplies_count, total_count
        FROM counted
        ORDER BY %I %s NULLS LAST, id DESC
        LIMIT $4 OFFSET $5
    $q$, sort_col, sort_dir)
    USING _status_filter, _shadow_filter, search_tokens, _limit, _offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
