-- Acqdash Handoff — new tables for notifications, alerts, payment attempts
-- Apply on top of existing schema. Uses IF NOT EXISTS to be idempotent.
-- Compatible with your Supabase RLS model (user isolation via auth.uid()).

-- ─────────────────────────────────────────────────────────────
-- 1. NOTIFICATIONS
-- ─────────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('bill_new','bill_due','payment_ok','payment_failed','consumption_spike','system')),
  title text not null,
  body text,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_unread
  on public.notifications(user_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;

-- ─────────────────────────────────────────────────────────────
-- 2. CONSUMPTION ALERTS
-- ─────────────────────────────────────────────────────────────
create table if not exists public.consumption_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  supply_id uuid references public.user_supplies(id) on delete cascade,
  severity text not null check (severity in ('info','warning','critical')),
  title text not null,
  description text,
  metric_value numeric,
  metric_delta_pct numeric,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_alerts_user_open
  on public.consumption_alerts(user_id, detected_at desc)
  where resolved_at is null;

alter table public.consumption_alerts enable row level security;

-- ─────────────────────────────────────────────────────────────
-- 3. PAYMENT ATTEMPTS (audit trail PagoPA)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  bill_id bigint not null references public.bills(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10,2) not null,
  status text not null check (status in ('pending','awaiting_user','succeeded','failed','expired','cancelled')),
  pagopa_iuv text,
  pagopa_notice_code text,
  receipt_url text,
  error_code text,
  error_message text,
  initiated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_payments_bill on public.payment_attempts(bill_id, initiated_at desc);
create index if not exists idx_payments_user on public.payment_attempts(user_id, initiated_at desc);

alter table public.payment_attempts enable row level security;

-- ─────────────────────────────────────────────────────────────
-- ROLLBACK (uncomment if you need to revert)
-- ─────────────────────────────────────────────────────────────
-- drop table if exists public.payment_attempts;
-- drop table if exists public.consumption_alerts;
-- drop table if exists public.notifications;
