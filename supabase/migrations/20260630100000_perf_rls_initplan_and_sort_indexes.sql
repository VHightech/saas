-- Performance: stop per-row re-evaluation of auth functions in RLS, and add the
-- indexes the admin list/export sorts were missing.
--
-- Symptom: admin bills list/export ran an 8.8s full-table sort of ~116k rows;
-- profiles-by-email ~1.7s; every row re-evaluated is_admin()/current_profile_id()/auth.uid().
--
-- Fix 1: wrap auth.<fn>() in (select ...) so the planner evaluates it ONCE per
--        query (init-plan) instead of once per row. Semantics are identical.
--        See https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- Fix 2: composite index on bills(created_at desc, nome_pdf desc) and an index
--        on profiles(email) so the ORDER BY + LIMIT is index-driven.
--
-- Result: the bills list query went from ~800ms-8.9s to ~8ms (Index Scan).

-- profiles
alter policy "Admins can manage profiles" on public.profiles
  using ((select public.is_admin(auth.uid()))) with check ((select public.is_admin(auth.uid())));
alter policy "Admins can view all profiles" on public.profiles
  using ((select public.is_admin(auth.uid())));
alter policy "Users can update own profile" on public.profiles
  using (auth_user_id = (select auth.uid())) with check (auth_user_id = (select auth.uid()));
alter policy "Users can view own profile" on public.profiles
  using (auth_user_id = (select auth.uid()));

-- bills
alter policy "Admins can manage bills" on public.bills
  using ((select public.is_admin(auth.uid()))) with check ((select public.is_admin(auth.uid())));
alter policy "Admins can view all bills" on public.bills
  using ((select public.is_admin(auth.uid())));
alter policy "Users can view own bills" on public.bills
  using (user_id = (select public.current_profile_id()));

-- payments
alter policy "Admins can manage payments" on public.payments
  using ((select public.is_admin(auth.uid()))) with check ((select public.is_admin(auth.uid())));
alter policy "Admins can view all payments" on public.payments
  using ((select public.is_admin(auth.uid())));
alter policy "Users can insert own pending payments" on public.payments
  with check ((user_id = (select public.current_profile_id())) and (status = 'pending'));
alter policy "Users can view own payments" on public.payments
  using (user_id = (select public.current_profile_id()));

-- user_supplies
alter policy "Admins can manage supplies" on public.user_supplies
  using ((select public.is_admin(auth.uid()))) with check ((select public.is_admin(auth.uid())));
alter policy "Users can read own supplies" on public.user_supplies
  using (user_id = (select public.current_profile_id()));

-- import_logs
alter policy "Admins can manage import logs" on public.import_logs
  using ((select public.is_admin(auth.uid()))) with check ((select public.is_admin(auth.uid())));
alter policy "Admins can read import logs" on public.import_logs
  using ((select public.is_admin(auth.uid())));

-- Sort indexes for the admin list/export.
create index if not exists bills_created_at_idx
  on public.bills (created_at desc nulls last, nome_pdf desc nulls last);
create index if not exists profiles_email_idx
  on public.profiles (email);

notify pgrst, 'reload schema';
