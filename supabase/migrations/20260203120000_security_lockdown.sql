-- SECURITY LOCKDOWN: Full RLS Hardening
-- This migration wipes all existing policies on sensitive tables and applies a strict, whitelist-only set of rules.

-- 0. Helper Function (Ensure it exists and is robust)
create or replace function public.is_admin(user_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles
    where id = user_id
    and role in ('admin', 'superadmin', 'super_admin')
  );
end;
$$ language plpgsql security definer;

-- 1. Profiles
alter table public.profiles enable row level security;
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "Admins can manage profiles" on public.profiles;

create policy "Users can view own profile"
on public.profiles for select
to authenticated
using ( auth.uid() = id );

create policy "Admins can view all profiles"
on public.profiles for select
to authenticated
using ( is_admin(auth.uid()) );

create policy "Admins can manage profiles"
on public.profiles for all
to authenticated
using ( is_admin(auth.uid()) );

-- 2. Bills
alter table public.bills enable row level security;
drop policy if exists "Users can view own bills" on public.bills;
drop policy if exists "Admins can view all bills" on public.bills;
drop policy if exists "Enable read access for all users" on public.bills;

create policy "Users can view own bills"
on public.bills for select
to authenticated
using ( auth.uid() = user_id );

create policy "Admins can view all bills"
on public.bills for select
to authenticated
using ( is_admin(auth.uid()) );

create policy "Admins can manage bills"
on public.bills for all
to authenticated
using ( is_admin(auth.uid()) );

-- 3. Tenants (STRICT)
alter table public.tenants enable row level security;
drop policy if exists "Authenticated users can view tenants" on public.tenants;

create policy "Users can view their own tenant"
on public.tenants for select
to authenticated
using (
  id in (
    select tenant_id from public.profiles where id = auth.uid()
  ) or 
  id in (
    select tenant_id from public.tenant_admins where id = auth.uid()
  ) or
  is_admin(auth.uid())
);

-- 4. Tenant Admins
alter table public.tenant_admins enable row level security;
drop policy if exists "Admins can view tenant staff" on public.tenant_admins;
drop policy if exists "Users can view own staff profile" on public.tenant_admins;

create policy "Users can view own staff profile"
on public.tenant_admins for select
to authenticated
using ( auth.uid() = id );

create policy "Admins can manage tenant staff"
on public.tenant_admins for all
to authenticated
using ( is_admin(auth.uid()) );

-- 5. Import Logs
alter table public.import_logs enable row level security;
drop policy if exists "Admins can manage import logs" on public.import_logs;

create policy "Admins can manage import logs"
on public.import_logs for all
to authenticated
using ( is_admin(auth.uid()) );

-- 6. Storage (General Security Note)
-- Policies for 'storage.objects' must be set in the Supabase Dashboard or via a separate SQL block targeting the storage schema.
-- Ensure the 'bills' bucket is NOT public and has a policy: 
-- (bucket_id = 'bills' AND auth.uid()::text = (storage.foldername(name))[1]) 
-- or similar, depending on folder structure.
