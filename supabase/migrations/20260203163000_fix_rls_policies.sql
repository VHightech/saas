-- RLS Fixes for Single Tenant Architecture

-- 1. Profiles: Allow users to view their own profile
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
on public.profiles for select
using ( auth.uid() = id );

-- 2. Profiles: Allow users to update their own profile
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
using ( auth.uid() = id );

-- 3. Bills: Allow users to view their own bills
drop policy if exists "Users can view own bills" on public.bills;
create policy "Users can view own bills"
on public.bills for select
using ( auth.uid() = user_id );

-- 4. Import Logs: Allow admins to view/manage logs
-- (Assuming 'admin' check is done via app logic or we need a secure way to check role in RLS without recursion)
-- For now, let's keep it simple: Authenticated users can read logs? No, that's bad.
-- Let's check roles. BUT checking roles involves reading profiles.
-- Recursion Risk: import_logs policy -> reads profiles -> profiles policy -> auth.uid() (Safe)
-- BUT if we use a helper function that reads profiles, it might be safer.

-- Standard Admin Policy (using auth.jwt() -> app_metadata or checking profiles table)
drop policy if exists "Admins can view import logs" on public.import_logs;
create policy "Admins can view import logs"
on public.import_logs for select
using (
    exists (
        select 1 from public.profiles
        where profiles.id = auth.uid()
        and (profiles.role = 'admin' or profiles.role = 'super_admin')
    )
);

drop policy if exists "Admins can insert import logs" on public.import_logs;
create policy "Admins can insert import logs"
on public.import_logs for insert
with check (
    exists (
        select 1 from public.profiles
        where profiles.id = auth.uid()
        and (profiles.role = 'admin' or profiles.role = 'super_admin')
    )
);

drop policy if exists "Admins can update import logs" on public.import_logs;
create policy "Admins can update import logs"
on public.import_logs for update
using (
    exists (
        select 1 from public.profiles
        where profiles.id = auth.uid()
        and (profiles.role = 'admin' or profiles.role = 'super_admin')
    )
);
