-- Security Audit: Enable RLS and define policies for critical tables

-- 1. Profiles
alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
on public.profiles for select
to authenticated
using ( auth.uid() = id );

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
on public.profiles for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('admin', 'superadmin', 'super_admin')
  )
);

-- 2. Import Logs
alter table public.import_logs enable row level security;

drop policy if exists "Admins can manage import logs" on public.import_logs;
create policy "Admins can manage import logs"
on public.import_logs for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('admin', 'superadmin', 'super_admin')
  )
);

-- 3. Tenants (Metadata)
alter table public.tenants enable row level security;

drop policy if exists "Authenticated users can view tenants" on public.tenants;
create policy "Authenticated users can view tenants"
on public.tenants for select
to authenticated
using (true);
