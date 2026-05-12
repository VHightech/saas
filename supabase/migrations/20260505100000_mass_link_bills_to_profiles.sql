-- Migration: 20260505100000_mass_link_bills_to_profiles.sql
-- Description: Links existing bills with NULL user_id to profiles using CIF or Client Code.

-- 1. Create temporary indexes if missing to speed up the join
create index if not exists bills_cif_idx on public.bills(cif);
create index if not exists profiles_cif_idx on public.profiles(cif);
create index if not exists bills_codice_cliente_idx on public.bills(codice_cliente);
create index if not exists profiles_codice_cliente_idx on public.profiles(codice_cliente);

-- 2. Update bills that have no user_id by matching CIF
update public.bills b
set user_id = p.id
from public.profiles p
where b.user_id is null
  and b.cif is not null
  and b.cif = p.cif
  and p.role not in ('admin', 'super_admin', 'superadmin');

-- 3. Update bills that have no user_id by matching Codice Cliente
-- (This handles cases where CIF might be missing or different)
update public.bills b
set user_id = p.id
from public.profiles p
where b.user_id is null
  and b.codice_cliente is not null
  and b.codice_cliente = p.codice_cliente
  and p.role not in ('admin', 'super_admin', 'superadmin');

-- 4. Do the same for user_supplies if they exist
update public.user_supplies us
set user_id = p.id
from public.profiles p
where us.user_id is null
  and us.cif is not null
  and us.cif = p.cif
  and p.role not in ('admin', 'super_admin', 'superadmin');
