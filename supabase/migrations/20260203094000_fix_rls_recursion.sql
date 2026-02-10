-- Fix RLS Recursion: Use a security definer function for role checks
-- This allows policies to check a user's role without triggering infinite recursion on the profiles table.

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

-- 1. Profiles (Update policies to use the function)
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
using ( is_admin(auth.uid()) );

-- 2. Bills (Update existing policies that might be recursive)
alter table public.bills enable row level security;

drop policy if exists "Admins can view all bills" on public.bills;
create policy "Admins can view all bills"
on public.bills for select
to authenticated
using ( is_admin(auth.uid()) );

-- 3. Import Logs
alter table public.import_logs enable row level security;

drop policy if exists "Admins can manage import logs" on public.import_logs;
create policy "Admins can manage import logs"
on public.import_logs for all
to authenticated
using ( is_admin(auth.uid()) );
