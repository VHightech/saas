-- 1) Rename bills.payment_type / payment_method → billing_type / expected_method
--    to separate "billing metadata" (info about the invoice itself, from the CSV)
--    from "payment events" (rows in the payments table).
-- 2) Trigger: when a payment turns 'paid', sync bills.status to 'paid'.

-- ===== 1. Rename columns on bills =====
do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'bills' and column_name = 'payment_type'
    ) and not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'bills' and column_name = 'billing_type'
    ) then
        alter table public.bills rename column payment_type to billing_type;
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'bills' and column_name = 'payment_method'
    ) and not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'bills' and column_name = 'expected_method'
    ) then
        alter table public.bills rename column payment_method to expected_method;
    end if;
end $$;

-- ===== 2. Sync trigger: payments.status → bills.status =====
create or replace function public.sync_bill_status_from_payment()
returns trigger
language plpgsql
security definer
as $$
begin
    -- When a payment is marked paid, mirror it onto the parent bill.
    if new.status = 'paid' and (old.status is null or old.status is distinct from 'paid') then
        update public.bills
        set status = 'paid'
        where id = new.bill_id
          and status is distinct from 'paid';
    end if;

    -- If a paid payment is later refunded / cancelled, revert bill to unpaid
    -- only when there's no other 'paid' payment for the same bill.
    if old.status = 'paid' and new.status in ('refunded', 'failed')
       and not exists (
           select 1 from public.payments
           where bill_id = new.bill_id
             and status = 'paid'
             and id <> new.id
       )
    then
        update public.bills
        set status = 'unpaid'
        where id = new.bill_id;
    end if;

    return new;
end;
$$;

drop trigger if exists trg_payments_sync_bill_status on public.payments;
create trigger trg_payments_sync_bill_status
    after insert or update of status on public.payments
    for each row execute function public.sync_bill_status_from_payment();
