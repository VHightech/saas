-- The "Admins can manage X" ALL policies were already single-init-plan via the
-- outer (select ...), but the advisor's static linter still flagged the bare
-- auth.uid() nested inside is_admin(). Double-wrap the inner call so it reads
-- (select is_admin((select auth.uid()))): identical semantics and performance,
-- and clears the auth_rls_initplan warning for a clean pre-production report.

alter policy "Admins can manage profiles" on public.profiles
  using ((select public.is_admin((select auth.uid())))) with check ((select public.is_admin((select auth.uid()))));
alter policy "Admins can manage bills" on public.bills
  using ((select public.is_admin((select auth.uid())))) with check ((select public.is_admin((select auth.uid()))));
alter policy "Admins can manage payments" on public.payments
  using ((select public.is_admin((select auth.uid())))) with check ((select public.is_admin((select auth.uid()))));
alter policy "Admins can manage supplies" on public.user_supplies
  using ((select public.is_admin((select auth.uid())))) with check ((select public.is_admin((select auth.uid()))));
alter policy "Admins can manage import logs" on public.import_logs
  using ((select public.is_admin((select auth.uid())))) with check ((select public.is_admin((select auth.uid()))));
