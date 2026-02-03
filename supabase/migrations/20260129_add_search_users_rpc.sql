-- Funzione per cercare utenti per campi profilo O nome file PDF (escludendo estensione)
create or replace function public.search_users(search_term text, _limit int default 10, _offset int default 0)
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
  legacy_id int,
  address text,
  city text,
  total_count bigint
) as $$
begin
  return query
  with filtered_profiles as (
    select distinct p.*
    from public.profiles p
    left join public.bills b on b.user_id = p.id
    where 
      -- Campi Profilo
      p.name ilike '%' || search_term || '%' or
      p.email ilike '%' || search_term || '%' or
      p.cif ilike '%' || search_term || '%' or
      p.cfpi ilike '%' || search_term || '%' or
      p.codice_cliente ilike '%' || search_term || '%' or
      -- Nome PDF Depurato (escludendo l'estensione .pdf dalla ricerca)
      -- Questo evita che cercando "pdf" escano tutti i risultati, 
      -- e cerca solo nel "body" del nome file.
      REGEXP_REPLACE(b.nome_pdf, '\.pdf$', '', 'i') ilike '%' || search_term || '%'
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
    fp.legacy_id,
    fp.address,
    fp.city,
    (select count(*) from filtered_profiles)::bigint as total_count
  from filtered_profiles fp
  order by fp.created_at desc
  limit _limit offset _offset;
end;
$$ language plpgsql security definer;
