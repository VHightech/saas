-- 1) Payments table — one row per payment event (supports acconti + saldi).
-- 2) Strict RLS: a user can read/write only their own payments; admins see all.
-- 3) Cleanup redundant columns.
-- 4) Align user_supplies RLS to recognise 'super_admin'.

-- ===== 1. payments =====
create table if not exists public.payments (
    id uuid primary key default gen_random_uuid(),
    bill_id bigint not null references public.bills(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    amount numeric(10,2) not null check (amount > 0),
    method text not null check (method in ('pagopa', 'bonifico', 'contanti', 'carta', 'altro')),
    type text not null check (type in ('saldo', 'acconto')),
    status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
    pagopa_notice_code text,
    pagopa_token text,
    paid_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists payments_bill_id_idx on public.payments (bill_id);
create index if not exists payments_user_id_idx on public.payments (user_id);
create index if not exists payments_status_idx on public.payments (status);

-- ===== 2. RLS on payments =====
alter table public.payments enable row level security;

drop policy if exists "Users can view own payments" on public.payments;
create policy "Users can view own payments"
    on public.payments for select
    to authenticated
    using (user_id = auth.uid());

drop policy if exists "Admins can view all payments" on public.payments;
create policy "Admins can view all payments"
    on public.payments for select
    to authenticated
    using (public.is_admin(auth.uid()));

drop policy if exists "Users can insert own pending payments" on public.payments;
create policy "Users can insert own pending payments"
    on public.payments for insert
    to authenticated
    with check (
        user_id = auth.uid()
        and status = 'pending'
    );

-- Updates are reserved for admin / service role (PagoPA webhook runs with service role).
drop policy if exists "Admins can manage payments" on public.payments;
create policy "Admins can manage payments"
    on public.payments for all
    to authenticated
    using (public.is_admin(auth.uid()))
    with check (public.is_admin(auth.uid()));

-- Revoke column-level UPDATE from authenticated role — no regular user can tamper with status.
revoke update on public.payments from authenticated;

-- ===== 3. Cleanup safe redundancies =====
-- bills.ulm is always right(cif, 6). Convert to a GENERATED column — the frontend
-- keeps reading `bills.ulm` but we never have to set it manually again.
alter table public.bills drop column if exists ulm;
alter table public.bills
    add column ulm text generated always as (right(cif, 6)) stored;

-- profiles.username: still used in dashboard layout + profile/complete flow.
-- Leaving in place for now; de-duplication will come with a UI refactor.

-- ===== 4. Align user_supplies RLS with the is_admin() helper (covers super_admin) =====
drop policy if exists "Enable all access for admins" on public.user_supplies;
drop policy if exists "Users can read own supplies" on public.user_supplies;

create policy "Users can read own supplies"
    on public.user_supplies for select
    to authenticated
    using (user_id = auth.uid());

create policy "Admins can manage supplies"
    on public.user_supplies for all
    to authenticated
    using (public.is_admin(auth.uid()))
    with check (public.is_admin(auth.uid()));
