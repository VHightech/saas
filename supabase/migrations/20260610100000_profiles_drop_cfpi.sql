-- 20260610100000_profiles_drop_cfpi.sql
-- Migration finale: rimuove profiles.cfpi (rimpiazzato da codice_fiscale/partita_iva).
-- Prerequisito applicato: 20260609120000_profiles_add_cf_piva_pec.sql (colonne + backfill).
-- Il codice applicativo non legge più profiles.cfpi; bills.cfpi/user_supplies.cfpi restano.
--
-- Dipendenze su profiles.cfpi (verificate sul DB live): nessuna view / constraint / indice /
-- colonna generata / RLS policy. Le sole funzioni che la citano sono search_users e
-- handle_new_user, ricreate qui senza cfpi prima del DROP.

-- 1) search_users SENZA cfpi (ritorna codice_fiscale/partita_iva/pec)
drop function if exists public.search_users(text, integer, integer, text, text, text, text);

create or replace function public.search_users(search_term text, _limit integer default 10, _offset integer default 0, _status_filter text default 'all'::text, _shadow_filter text default 'all'::text, _sort_by text default 'created_at'::text, _sort_order text default 'desc'::text)
 returns table(id uuid, email text, name text, codice_fiscale text, partita_iva text, pec text, codice_cliente text, created_at timestamp with time zone, is_shadow boolean, bills_count integer, user_supplies_count integer, user_supplies jsonb, total_count bigint)
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
                p.id, p.email, p.name, p.codice_fiscale, p.partita_iva, p.pec, p.codice_cliente,
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
                            p.name, p.email, p.codice_fiscale, p.partita_iva, p.pec, p.codice_cliente
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
        select id, email, name, codice_fiscale, partita_iva, pec, codice_cliente,
               created_at, is_shadow,
               bills_count, user_supplies_count, user_supplies, total_count
        from counted
        order by %I %s nulls last, id desc
        limit $3 offset $4
    $q$, sort_col, sort_dir)
    using _shadow_filter, search_tokens, _limit, _offset;
end;
$function$;

-- 2) handle_new_user: rimuove i riferimenti a colonne inesistenti su profiles
--    (cfpi in drop, + cif/username mai esistite). Path (a) shadow invariato; path (b)
--    ora inserisce solo colonne reali (i campi fiscali li popola register dopo il signUp).
create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
    _codice_cliente text;
    _shadow_id      uuid;
begin
    if (new.raw_app_meta_data->>'role' = 'admin')
       or (new.raw_app_meta_data->>'role' = 'super_admin')
       or (new.raw_user_meta_data->>'is_admin' = 'true') then
        return new;
    end if;

    begin
        _codice_cliente := coalesce(
            nullif(new.raw_app_meta_data->>'codice_cliente', ''),
            nullif(new.raw_user_meta_data->>'codice_cliente', '')
        );

        -- (a) Attiva un profilo shadow esistente (path principale per clienti pre-caricati).
        if _codice_cliente is not null then
            select id into _shadow_id
            from public.profiles
            where codice_cliente = _codice_cliente
              and is_shadow = true
              and auth_user_id is null
            limit 1
            for update;

            if _shadow_id is not null then
                update public.profiles
                set auth_user_id = new.id,
                    is_shadow    = false,
                    email        = coalesce(public.profiles.email, new.email)
                where id = _shadow_id;
                return new;
            end if;
        end if;

        -- (b) Signup diretto — crea un profilo nuovo (solo colonne realmente esistenti).
        if exists (select 1 from public.profiles where id = new.id) then
            return new;
        end if;

        insert into public.profiles (
            id, auth_user_id, email, name, codice_cliente
        )
        values (
            new.id,
            new.id,
            new.email,
            coalesce(new.raw_user_meta_data->>'full_name', ''),
            _codice_cliente
        )
        on conflict (id) do update set
            auth_user_id = excluded.auth_user_id,
            is_shadow    = false;

    exception when others then
        raise warning 'handle_new_user trigger failed for user %: %', new.id, sqlerrm;
    end;

    return new;
end;
$function$;

-- 3) Drop della colonna cfpi
alter table public.profiles drop column if exists cfpi;

notify pgrst, 'reload schema';
