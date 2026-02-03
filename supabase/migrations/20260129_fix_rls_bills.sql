-- Drop insecure policy safely
drop policy if exists "Enable read access for all users" on public.bills;
drop policy if exists "Users can view own bills" on public.bills;
drop policy if exists "Admins can view all bills" on public.bills;

-- Create secure policies
create policy "Users can view own bills"
on public.bills for select
to authenticated
using (
  auth.uid() = user_id
);

create policy "Admins can view all bills"
on public.bills for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
    and profiles.role in ('admin', 'superadmin')
  )
);
