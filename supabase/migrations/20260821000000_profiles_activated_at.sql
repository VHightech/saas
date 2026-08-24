-- Distingue "invitato ma mai entrato" da "registrato", tramite un fatto
-- registrato invece che dedotto.
--
-- Il trigger handle_new_user scatta sull'INSERT in auth.users, che avviene
-- all'invito: da quell'istante il profilo ha is_shadow = false e in elenco
-- sembra registrato. La password pero la scrive solo setFirstPassword. Chi
-- apre il link e chiude la pagina resta senza password: si sblocca rifacendo
-- il primo accesso, ma nessun operatore puo accorgersi che e fermo.
--
-- PERCHE NON auth.users.encrypted_password
-- Sembrava il discriminante ovvio, ed e sbagliato: GoTrue popola quel campo
-- gia alla creazione dell'account, quindi un invitato che non ha mai scelto
-- nulla ha comunque un hash bcrypt da 60 caratteri, indistinguibile da quello
-- di una password vera. Misurato sul codice cliente 509155:
--
--   invited_at       06:15:00.499
--   confirmed_at     06:16:55.179   <- clic sul link
--   updated_at       06:16:55.188   <- +3 ms, nessun intervento umano
--   length(encrypted_password) = 60
--
-- PERCHE NON last_sign_in_at
-- Aprire il link crea comunque una sessione: nello stesso caso sopra risulta
-- valorizzato a 06:16:55.185, sei millisecondi dopo la conferma.
--
-- La sola prova certa e l'esecuzione di setFirstPassword, che e l'unico punto
-- in cui qualcuno sceglie davvero una password. Da qui la colonna.

alter table public.profiles
    add column if not exists activated_at timestamptz;

comment on column public.profiles.activated_at is
    'Istante in cui l''utente ha impostato la propria password tramite setFirstPassword. '
    'NULL su un profilo con auth_user_id valorizzato significa: invitato, mai entrato. '
    'Non ricavabile da auth.users: encrypted_password e last_sign_in_at sono entrambi '
    'popolati dal solo invito.';

-- Backfill una tantum. Non esiste un dato storico che dica chi ha scelto una
-- password, quindi si usa l'unico indizio disponibile: uno scarto significativo
-- fra la conferma dell'invito e l'ultima modifica dell'account. Il clic sul
-- link muove updated_at di pochi millisecondi; compilare il modulo richiede
-- almeno decine di secondi. La soglia e volutamente prudente: chi resta fuori
-- appare come "mai entrato" e viene semplicemente ricontattato, mentre marcare
-- per errore come attivo qualcuno che e fermo lo renderebbe di nuovo invisibile.
update public.profiles p
set activated_at = u.updated_at
from auth.users u
where u.id = p.auth_user_id
  and p.activated_at is null
  and u.confirmed_at is not null
  and u.updated_at > u.confirmed_at + interval '30 seconds';

-- Serve il filtro "invited", che e l'unico accesso previsto su questa colonna.
create index if not exists profiles_invitati_non_attivati_idx
    on public.profiles (created_at desc)
    where activated_at is null and auth_user_id is not null;

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
                p.created_at, p.is_shadow, p.bills_count, p.user_supplies_count,
                -- Invitato (ha un account) ma senza password scelta.
                (p.auth_user_id is not null and p.activated_at is null) as never_activated
            from public.profiles p
            where p.role not in ('admin', 'super_admin', 'superadmin')
              and ($1 = 'all'
                   or ($1 = 'active' and coalesce(p.is_shadow, false) = false)
                   or ($1 = 'shadow' and coalesce(p.is_shadow, false) = true)
                   or ($1 = 'invited'
                       and coalesce(p.is_shadow, false) = false
                       and p.auth_user_id is not null
                       and p.activated_at is null))
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
            pg.created_at, pg.is_shadow, pg.bills_count, pg.user_supplies_count, pg.never_activated,
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
