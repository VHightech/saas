-- 20260609120000_profiles_add_cf_piva_pec.sql
-- Additivo: separa CF e P.IVA in due colonne e aggiunge la PEC su profiles.
-- NON droppa cfpi (drop rinviato a una migration successiva, dopo l'allineamento
-- del codice applicativo). search_users diventa un SUPERSET: ritorna sia cfpi sia
-- i nuovi campi, così il codice attuale e quello nuovo funzionano in contemporanea.

-- 1) Nuove colonne (idempotente)
alter table public.profiles add column if not exists codice_fiscale text;
alter table public.profiles add column if not exists partita_iva   text;
alter table public.profiles add column if not exists pec           text;

-- 2) Backfill dai cfpi esistenti: 11 cifre => P.IVA, altrimenti CF (solo se ancora vuoto)
update public.profiles
set partita_iva = cfpi
where cfpi ~ '^\d{11}$' and partita_iva is null;

update public.profiles
set codice_fiscale = cfpi
where cfpi is not null and cfpi !~ '^\d{11}$' and codice_fiscale is null;

-- 3) GRANT allineati a quelli reali di cfpi (lettura per anon/authenticated, update solo service_role)
grant select (codice_fiscale, partita_iva, pec) on public.profiles to anon, authenticated, service_role;
grant insert (codice_fiscale, partita_iva, pec) on public.profiles to anon, authenticated, service_role;
grant update (codice_fiscale, partita_iva, pec) on public.profiles to service_role;

-- 4) search_users SUPERSET: ritorna cfpi (compat) + codice_fiscale/partita_iva/pec
drop function if exists public.search_users(text, integer, integer, text, text, text, text);

create or replace function public.search_users(search_term text, _limit integer default 10, _offset integer default 0, _status_filter text default 'all'::text, _shadow_filter text default 'all'::text, _sort_by text default 'created_at'::text, _sort_order text default 'desc'::text)
 returns table(id uuid, email text, name text, cfpi text, codice_fiscale text, partita_iva text, pec text, codice_cliente text, created_at timestamp with time zone, is_shadow boolean, bills_count integer, user_supplies_count integer, user_supplies jsonb, total_count bigint)
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
    search_tokens text[];
    sort_col      text;
    sort_dir      text;
begin
    if not exists (
        select 1 from public.profiles
        where profiles.id = auth.uid()
          and profiles.role in ('admin', 'super_admin', 'superadmin')
    ) then
        raise exception 'Access Denied: Admin privileges required.';
    end if;

    sort_col := case lower(_sort_by)
        when 'name'                then 'name'
        when 'bills_count'         then 'bills_count'
        when 'user_supplies_count' then 'user_supplies_count'
        else 'created_at'
    end;
    sort_dir := case lower(_sort_order)
        when 'asc' then 'asc'
        else 'desc'
    end;

    search_tokens := string_to_array(trim(coalesce(search_term, '')), ' ');

    return query execute format($q$
        with base_users as (
            select
                p.id, p.email, p.name, p.cfpi, p.codice_fiscale, p.partita_iva, p.pec, p.codice_cliente,
                p.created_at, p.is_shadow,
                p.bills_count,
                p.user_supplies_count
            from public.profiles p
            where p.role not in ('admin', 'super_admin', 'superadmin')
              and ($1 = 'all'
                   or ($1 = 'active' and coalesce(p.is_shadow, false) = false)
                   or ($1 = 'shadow' and coalesce(p.is_shadow, false) = true))
               and (
                    coalesce(array_length($2, 1), 0) = 0
                 or (
                    select bool_and(
                        concat_ws(' ',
                            p.name, p.email, p.cfpi, p.codice_fiscale, p.partita_iva, p.pec, p.codice_cliente
                        ) ilike '%%' || token || '%%'
                        or exists (
                            select 1 from public.user_supplies s
                            where s.codice_cliente = p.codice_cliente
                              and (s.cif ilike '%%' || token || '%%' or s.address ilike '%%' || token || '%%')
                        )
                        or exists (
                            select 1 from public.bills b
                            where b.codice_cliente = p.codice_cliente
                              and (b.idboll::text ilike '%%' || token || '%%')
                        )
                    )
                    from unnest($2) as token
                    where token <> ''
                 )
              )
        ),
        user_with_supplies as (
            select
                u.*,
                coalesce(
                    (select jsonb_agg(jsonb_build_object(
                        'cif', s.cif,
                        'address', s.address,
                        'city', s.city
                    ))
                     from public.user_supplies s
                     where s.codice_cliente = u.codice_cliente),
                    '[]'::jsonb
                ) as user_supplies
            from base_users u
        ),
        counted as (
            select *, (select count(*) from base_users)::bigint as total_count
            from user_with_supplies
        )
        select id, email, name, cfpi, codice_fiscale, partita_iva, pec, codice_cliente,
               created_at, is_shadow,
               bills_count, user_supplies_count, user_supplies, total_count
        from counted
        order by %I %s nulls last, id desc
        limit $3 offset $4
    $q$, sort_col, sort_dir)
    using _shadow_filter, search_tokens, _limit, _offset;
end;
$function$;

notify pgrst, 'reload schema';
