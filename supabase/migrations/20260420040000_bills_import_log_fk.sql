-- Link bills → import_logs so deleting an import cascades to its bills.
-- 1:N: one import_log → many bills.
-- Fully idempotent: adds the column and the FK only if they don't already exist.

do $$
begin
    -- 1. Add column if missing.
    if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'bills'
          and column_name = 'import_log_id'
    ) then
        alter table public.bills add column import_log_id uuid;
    end if;

    -- 2. Add FK (cascade on delete) if missing.
    if not exists (
        select 1 from pg_constraint
        where conname = 'bills_import_log_id_fkey'
          and conrelid = 'public.bills'::regclass
    ) then
        alter table public.bills
            add constraint bills_import_log_id_fkey
            foreign key (import_log_id)
            references public.import_logs(id)
            on delete cascade;
    end if;
end $$;

-- 3. Index for cascade lookups.
create index if not exists bills_import_log_id_idx
    on public.bills (import_log_id);
