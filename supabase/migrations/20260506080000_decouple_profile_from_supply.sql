-- Migration: 20260506080000_decouple_profile_from_supply.sql
-- Description: Updates mass_link logic to rely on codice_cliente instead of cif on profiles.
-- This allows us to remove supply-specific data (cif, address, city) from the profiles table.

create or replace function public.mass_link_orphaned_data()
returns table (
    linked_bills_by_cif        int,
    linked_bills_by_codice     int,
    linked_supplies_by_cif     int,
    linked_supplies_by_codice  int
)
language plpgsql
security definer
as $$
declare
    c_bills_cif    int := 0;
    c_bills_cc     int := 0;
    c_supp_cif     int := 0;
    c_supp_cc      int := 0;
begin
    -- 1. Link Bills to Profiles via codice_cliente (Global ID)
    with upd as (
        update public.bills b
           set user_id = p.id
          from public.profiles p
         where b.user_id is null
           and b.codice_cliente is not null
           and p.codice_cliente is not null
           and trim(b.codice_cliente) = trim(p.codice_cliente)
           and coalesce(p.role, 'user') not in ('admin', 'super_admin', 'superadmin')
         returning 1
    )
    select count(*) into c_bills_cc from upd;

    -- 2. Link Supplies to Profiles via codice_cliente (Global ID)
    with upd as (
        update public.user_supplies us
           set user_id = p.id
          from public.profiles p
         where us.user_id is null
           and us.codice_cliente is not null
           and p.codice_cliente is not null
           and trim(us.codice_cliente) = trim(p.codice_cliente)
           and coalesce(p.role, 'user') not in ('admin', 'super_admin', 'superadmin')
         returning 1
    )
    select count(*) into c_supp_cc from upd;

    -- 3. Link Bills to Profiles via user_supplies (Cross-reference by CIF)
    -- This handles cases where a bill has a CIF but no codice_cliente, 
    -- by looking up which user owns that CIF in user_supplies.
    with upd as (
        update public.bills b
           set user_id = us.user_id
          from public.user_supplies us
         where b.user_id is null
           and b.cif is not null
           and us.cif is not null
           and us.user_id is not null
           and trim(upper(b.cif)) = trim(upper(us.cif))
         returning 1
    )
    select count(*) into c_bills_cif from upd;

    return query select c_bills_cif, c_bills_cc, 0, c_supp_cc;
end;
$$;

comment on function public.mass_link_orphaned_data() is
    'Reconciles orphan bills and supplies. Links primarily via codice_cliente. Secondarily links bills via user_supplies (by CIF).';
