-- Cleanup of items flagged by the performance advisor that are provably safe.
--
-- Indexes dropped:
--   payments_status_idx       - no query filters payments.status (the bill-status
--                               sync runs DB-side keyed on bill_id, which is indexed).
--   profiles_codice_cliente_idx - fully redundant: profiles_codice_cliente_key
--                               (UNIQUE) already serves every codice_cliente lookup.
-- Kept on purpose:
--   import_logs_kind_idx      - backs a real .eq('kind','bills') query; matters at scale.
--   auth_events_* / auth_rate_limits_window_idx - login/rate-limit protection that
--                               only gets exercised under traffic bursts.
drop index if exists public.payments_status_idx;
drop index if exists public.profiles_codice_cliente_idx;

-- Redundant SELECT-only admin policies. Each table's "Admins can manage X" ALL
-- policy already grants SELECT to admins, so these are duplicates (one fewer
-- permissive policy to evaluate per query). No access change.
drop policy if exists "Admins can view all bills" on public.bills;
drop policy if exists "Admins can view all payments" on public.payments;
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "Admins can read import logs" on public.import_logs;
