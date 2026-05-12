-- Migration: 20260505_update_search_users_v3.sql
-- Description: Updates search_users function to include an optional status filter.

DROP FUNCTION IF EXISTS public.search_users(text, int, int);
DROP FUNCTION IF EXISTS public.search_users(text, int, int, text);

create or replace function public.search_users(
    search_term text, 
    _limit int default 10, 
    _offset int default 0,
    _status_filter text default 'all'
)
returns table (
  id uuid,
  email text,
  name text,
  username text,
  cfpi text,
  cif text,
  codice_cliente text,
  created_at timestamptz,
  is_shadow boolean,
  address text,
  city text,
  stadio text,
  stato_contratto text,
  total_count bigint
) as $$
declare
  search_tokens text[];
begin
  -- SECURITY CHECK
  if not exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and (profiles.role = 'admin' or profiles.role = 'super_admin' or profiles.role = 'superadmin')
  ) then
      raise exception 'Access Denied: Admin privileges required.';
  end if;

  -- Split search term into tokens
  search_tokens := string_to_array(trim(search_term), ' ');

  return query
  with filtered_profiles as (
    select distinct p.*
    from public.profiles p
    left join public.bills b on b.user_id = p.id
    cross join lateral (
      select REGEXP_REPLACE(b.nome_pdf, '\.pdf$', '', 'i') as pdf_clean
    ) as pdf_data
    cross join lateral (
      select concat_ws(' ', 
        p.name, 
        p.email, 
        p.cif, 
        p.cfpi, 
        p.codice_cliente, 
        p.address, 
        p.city, 
        p.stadio,
        p.stato_contratto,
        pdf_data.pdf_clean
      ) as search_blob
    ) as blob
    where 
      -- Role filter (exclude admins)
      p.role NOT IN ('admin', 'super_admin', 'superadmin')
      AND
      -- Search tokens filter
      (
        select bool_and(blob.search_blob ilike '%' || token || '%')
        from unnest(search_tokens) as token
      )
      AND
      -- Status filter
      (
        _status_filter = 'all' 
        OR p.stato_contratto = _status_filter
      )
  )
  select 
    fp.id,
    fp.email,
    fp.name,
    fp.username,
    fp.cfpi,
    fp.cif,
    fp.codice_cliente,
    fp.created_at,
    fp.is_shadow,
    fp.address,
    fp.city,
    fp.stadio,
    fp.stato_contratto,
    (select count(*) from filtered_profiles)::bigint as total_count
  from filtered_profiles fp
  order by fp.created_at desc
  limit _limit offset _offset;
end;
$$ language plpgsql security definer;
