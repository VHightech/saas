-- Migration: 20260506000000_fix_mass_link_and_default_role.sql
-- Description:
--   1. Backfill profiles.role = 'user' on rows where role is NULL (shadow profiles imported via /api/upload-users).
--   2. Set default 'user' on profiles.role so future inserts are safe.
--   3. Rewrite mass_link_orphaned_data() to:
--      - tolerate NULL role via COALESCE,
--      - normalize CIF / codice_cliente comparisons (TRIM + UPPER),
--      - return per-pass row counts so ops know how many bills/supplies were linked.
--   4. Run the mass-link immediately so the existing import is reconciled.

-- 1) Backfill NULL role -------------------------------------------------------
update public.profiles
set role = 'user'
where role is null;

-- 2) Default for future inserts ----------------------------------------------
alter table public.profiles
    alter column role set default 'user';

-- 3) Rewrite RPC --------------------------------------------------------------
drop function if exists public.mass_link_orphaned_data();

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
    -- Bills <-> profiles by CIF (case-insensitive, trimmed)
    with upd as (
        update public.bills b
           set user_id = p.id
          from public.profiles p
         where b.user_id is null
           and b.cif is not null
           and p.cif is not null
           and trim(upper(b.cif)) = trim(upper(p.cif))
           and coalesce(p.role, 'user') not in ('admin', 'super_admin', 'superadmin')
         returning 1
    )
    select count(*) into c_bills_cif from upd;

    -- Bills <-> profiles by codice_cliente
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

    -- user_supplies <-> profiles by CIF
    with upd as (
        update public.user_supplies us
           set user_id = p.id
          from public.profiles p
         where us.user_id is null
           and us.cif is not null
           and p.cif is not null
           and trim(upper(us.cif)) = trim(upper(p.cif))
           and coalesce(p.role, 'user') not in ('admin', 'super_admin', 'superadmin')
         returning 1
    )
    select count(*) into c_supp_cif from upd;

    -- user_supplies <-> profiles by codice_cliente
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

    return query select c_bills_cif, c_bills_cc, c_supp_cif, c_supp_cc;
end;
$$;

comment on function public.mass_link_orphaned_data() is
    'Reconciles orphan bills / user_supplies (user_id IS NULL) with public.profiles by CIF and codice_cliente. Returns counts per pass.';

-- 4) Ensure user_supplies has a unique constraint on cif so the upload route
--    can safely upsert one row per fornitura without duplicating.
do $$
begin
    if not exists (
        select 1 from pg_constraint
         where conname = 'user_supplies_cif_unique'
           and conrelid = 'public.user_supplies'::regclass
    ) then
        -- Drop duplicates first (keep oldest row per cif)
        delete from public.user_supplies a
              using public.user_supplies b
         where a.cif = b.cif
           and a.cif is not null
           and a.created_at > b.created_at;

        alter table public.user_supplies
            add constraint user_supplies_cif_unique unique (cif);
    end if;
end $$;

-- 5) Reconcile existing data --------------------------------------------------
select * from public.mass_link_orphaned_data();

-- Reload PostgREST schema cache so the new return signature is picked up
notify pgrst, 'reload schema';
