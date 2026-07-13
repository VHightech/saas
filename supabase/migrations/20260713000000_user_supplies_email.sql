-- Each fornitura (user_supplies row) carries its own contact email in the
-- source CSV (column "Mail"), but until now only the last row per cliente
-- survived on profiles.email. Store the email per supply instead.
--
-- profiles.email is NOT dropped: it remains the LOGIN email (synced with
-- auth.users, used by invites, password reset and identifier resolution).
-- user_supplies.email is the per-fornitura contact email shown in the UI.

alter table public.user_supplies
    add column if not exists email text;

-- Backfill: seed each supply with the owning profile's email (best data we
-- have until the next users CSV import overwrites it with the per-row value).
update public.user_supplies s
set email = lower(trim(p.email))
from public.profiles p
where s.user_id = p.id
  and s.email is null
  and p.email is not null;

-- Supplies not yet linked to a profile (user_id null) are matched by
-- codice_cliente, same key the mass-link RPC uses.
update public.user_supplies s
set email = lower(trim(p.email))
from public.profiles p
where s.user_id is null
  and s.codice_cliente = p.codice_cliente
  and s.email is null
  and p.email is not null;

-- search_users: include the supply email in the returned jsonb aggregate and
-- make it searchable. Body otherwise identical to 20260630120000.
create or replace function public.search_users(
    search_term text,
    _limit integer default 10,
    _offset integer default 0,
    _status_filter text default 'all',
    _shadow_filter text default 'all',
    _sort_by text default 'created_at',
    _sort_order text default 'desc'
)
returns table(
    id uuid, email text, name text, codice_fiscale text, partita_iva text, pec text,
    codice_cliente text, created_at timestamptz, is_shadow boolean,
    bills_count integer, user_supplies_count integer, user_supplies jsonb, total_count bigint
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
    search_tokens text[];
    sort_col text;
    sort_dir text;
begin
    if not exists (
        select 1 from public.profiles
        where (profiles.auth_user_id = auth.uid() or profiles.id = auth.uid())
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
    sort_dir := case lower(_sort_order) when 'asc' then 'asc' else 'desc' end;

    search_tokens := string_to_array(trim(coalesce(search_term, '')), ' ');

    return query execute format($q$
        with base_users as (
            select
                p.id, p.email, p.name, p.codice_fiscale, p.partita_iva, p.pec, p.codice_cliente,
                p.created_at, p.is_shadow, p.bills_count, p.user_supplies_count
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
                            p.name, p.email, p.codice_fiscale, p.partita_iva, p.pec, p.codice_cliente
                        ) ilike '%%' || token || '%%'
                        or exists (
                            select 1 from public.user_supplies s
                            where s.codice_cliente = p.codice_cliente
                              and (s.cif ilike '%%' || token || '%%'
                                   or s.address ilike '%%' || token || '%%'
                                   or s.email ilike '%%' || token || '%%')
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
        page as (
            select * from base_users
            order by %I %s nulls last, id desc
            limit $3 offset $4
        )
        select
            pg.id, pg.email, pg.name, pg.codice_fiscale, pg.partita_iva, pg.pec, pg.codice_cliente,
            pg.created_at, pg.is_shadow, pg.bills_count, pg.user_supplies_count,
            coalesce(
                (select jsonb_agg(jsonb_build_object(
                    'cif', s.cif, 'address', s.address, 'city', s.city, 'email', s.email))
                 from public.user_supplies s
                 where s.codice_cliente = pg.codice_cliente),
                '[]'::jsonb
            ) as user_supplies,
            (select count(*) from base_users)::bigint as total_count
        from page pg
        order by %I %s nulls last, pg.id desc
    $q$, sort_col, sort_dir, sort_col, sort_dir)
    using _shadow_filter, search_tokens, _limit, _offset;
end;
$function$;

notify pgrst, 'reload schema';
