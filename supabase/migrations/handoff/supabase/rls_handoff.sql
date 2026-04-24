-- Acqdash Handoff — RLS policies for the new tables.
-- Apply AFTER migration_handoff.sql.

-- ─────────────────────────────────────────────────────────────
-- NOTIFICATIONS — users can read + mark-read their own
-- ─────────────────────────────────────────────────────────────
drop policy if exists "notif_select_own" on public.notifications;
create policy "notif_select_own"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "notif_update_own" on public.notifications;
create policy "notif_update_own"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Admins can insert for any user (service role bypasses RLS anyway)
drop policy if exists "notif_admin_insert" on public.notifications;
create policy "notif_admin_insert"
  on public.notifications for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin','super_admin')
    )
  );

-- ─────────────────────────────────────────────────────────────
-- CONSUMPTION ALERTS — users read their own
-- ─────────────────────────────────────────────────────────────
drop policy if exists "alerts_select_own" on public.consumption_alerts;
create policy "alerts_select_own"
  on public.consumption_alerts for select
  to authenticated
  using (user_id = auth.uid());

-- Admins can insert / resolve
drop policy if exists "alerts_admin_all" on public.consumption_alerts;
create policy "alerts_admin_all"
  on public.consumption_alerts for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin','super_admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin','super_admin')
    )
  );

-- ─────────────────────────────────────────────────────────────
-- PAYMENT ATTEMPTS — users see their own, only service role writes
-- ─────────────────────────────────────────────────────────────
drop policy if exists "pay_select_own" on public.payment_attempts;
create policy "pay_select_own"
  on public.payment_attempts for select
  to authenticated
  using (user_id = auth.uid());

-- Inserts handled exclusively by service role (PagoPA callback server action).
-- No authenticated INSERT policy on purpose.
