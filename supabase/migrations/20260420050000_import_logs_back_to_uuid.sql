-- Convert import_logs.id back to uuid (client now uses crypto.randomUUID())
-- and establish the FK from bills.import_log_id.
-- Preconditions (confirmed 2026-04-20): bills and import_logs can be wiped.

-- 1. Wipe existing data so the cast id::uuid cannot fail on legacy fingerprint strings.
truncate table public.bills;
truncate table public.import_logs cascade;

-- 2. Convert import_logs.id text → uuid (only if needed).
do $$
declare
    v_type text;
begin
    select data_type into v_type
    from information_schema.columns
    where table_schema = 'public' and table_name = 'import_logs' and column_name = 'id';

    if v_type <> 'uuid' then
        alter table public.import_logs alter column id drop default;
        alter table public.import_logs alter column id type uuid using id::uuid;
        alter table public.import_logs alter column id set default gen_random_uuid();
    end if;
end $$;

-- 3. Ensure bills.import_log_id is uuid.
do $$
declare
    v_type text;
begin
    select data_type into v_type
    from information_schema.columns
    where table_schema = 'public' and table_name = 'bills' and column_name = 'import_log_id';

    if v_type is null then
        alter table public.bills add column import_log_id uuid;
    elsif v_type <> 'uuid' then
        alter table public.bills drop constraint if exists bills_import_log_id_fkey;
        alter table public.bills alter column import_log_id type uuid using import_log_id::uuid;
    end if;
end $$;

-- 4. Add the FK (now both sides are uuid).
do $$
begin
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

create index if not exists bills_import_log_id_idx
    on public.bills (import_log_id);
