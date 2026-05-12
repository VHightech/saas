-- Migration: 20260505110000_add_mass_link_rpc.sql
-- Description: Adds an RPC function to mass-link orphaned bills and supplies.

create or replace function public.mass_link_orphaned_data()
returns void
language plpgsql
security definer
as $$
begin
  -- Link Bills by CIF
  update public.bills b
  set user_id = p.id
  from public.profiles p
  where b.user_id is null
    and b.cif is not null
    and b.cif = p.cif
    and p.role not in ('admin', 'super_admin', 'superadmin');

  -- Link Bills by Codice Cliente
  update public.bills b
  set user_id = p.id
  from public.profiles p
  where b.user_id is null
    and b.codice_cliente is not null
    and b.codice_cliente = p.codice_cliente
    and p.role not in ('admin', 'super_admin', 'superadmin');

  -- Link Supplies by CIF
  update public.user_supplies us
  set user_id = p.id
  from public.profiles p
  where us.user_id is null
    and us.cif is not null
    and us.cif = p.cif
    and p.role not in ('admin', 'super_admin', 'superadmin');
end;
$$;
