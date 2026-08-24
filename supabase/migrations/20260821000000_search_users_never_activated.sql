-- Distingue "invitato ma mai entrato" da "registrato".
--
-- Il trigger handle_new_user scatta sull'INSERT in auth.users, che avviene al
-- momento dell'invito: da quell'istante il profilo ha is_shadow = false e
-- l'elenco admin lo mostra come registrato. Ma la password viene salvata solo
-- da setFirstPassword, quando l'utente compila davvero il modulo. Chi apre il
-- link e chiude la pagina resta senza password: puo sbloccarsi rifacendo il
-- primo accesso (initiateFirstAccess gli manda un link nuovo), ma nessun
-- operatore ha modo di accorgersi che e fermo.
--
-- Il discriminante e auth.users.encrypted_password vuota. NON last_sign_in_at:
-- aprire il link di invito crea comunque una sessione, quindi si valorizza
-- anche per chi poi non imposta nulla.
--
-- Nota: vale finche l'autenticazione e a password. Un eventuale accesso OAuth
-- avrebbe encrypted_password vuota pur potendo entrare regolarmente.
--
-- La funzione va eliminata e ricreata: aggiungere una colonna al RETURNS TABLE
-- cambia il tipo di ritorno, e CREATE OR REPLACE non lo consente. I permessi
-- vengono riassegnati in fondo, perche il DROP li porta via.

drop function if exists public.search_users(text, integer, integer, text, text, text, text);

create function public.search_users(
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
    bills_count integer, user_supplies_count integer, never_activated boolean,
    user_supplies jsonb, total_count bigint
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
                p.created_at, p.is_shadow, p.bills_count, p.user_supplies_count, p.auth_user_id
            from public.profiles p
            where p.role not in ('admin', 'super_admin', 'superadmin')
              and ($1 = 'all'
                   or ($1 = 'active' and coalesce(p.is_shadow, false) = false)
                   or ($1 = 'shadow' and coalesce(p.is_shadow, false) = true)
                   or ($1 = 'invited'
                       and coalesce(p.is_shadow, false) = false
                       and p.auth_user_id is not null
                       and exists (
                           select 1 from auth.users au
                           where au.id = p.auth_user_id
                             and coalesce(au.encrypted_password, '') = ''
                       )))
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
        page as (
            select * from base_users
            order by %I %s nulls last, id desc
            limit $3 offset $4
        )
        select
            pg.id, pg.email, pg.name, pg.codice_fiscale, pg.partita_iva, pg.pec, pg.codice_cliente,
            pg.created_at, pg.is_shadow, pg.bills_count, pg.user_supplies_count,
            -- Calcolata solo sulle righe della pagina, non su tutto il filtrato.
            coalesce((
                select coalesce(au.encrypted_password, '') = ''
                from auth.users au
                where au.id = pg.auth_user_id
            ), false) as never_activated,
            coalesce(
                (select jsonb_agg(jsonb_build_object('cif', s.cif, 'address', s.address, 'city', s.city))
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

-- Il DROP ha rimosso anche i permessi: si ripristina lo stato voluto, cioe
-- niente chiamate anonime via /rest/v1/rpc/search_users.
revoke execute on function
  public.search_users(text, integer, integer, text, text, text, text)
  from anon, public;

grant execute on function
  public.search_users(text, integer, integer, text, text, text, text)
  to authenticated, service_role;
