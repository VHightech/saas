-- Remove redundancy: import_logs.id becomes a generic server-side PK,
-- r2_path is the link column (UNIQUE NOT NULL) that bills.import_log_id references.
-- Fresh DB assumed (bills + import_logs already empty).

-- 1. Detach the existing FK from bills.import_log_id.
alter table public.bills
    drop constraint if exists bills_import_log_id_fkey;

-- 2. Change bills.import_log_id from uuid to text (r2_path is text).
do $$
declare
    v_type text;
begin
    select data_type into v_type
    from information_schema.columns
    where table_schema = 'public' and table_name = 'bills' and column_name = 'import_log_id';

    if v_type = 'uuid' then
        alter table public.bills alter column import_log_id type text using import_log_id::text;
    end if;
end $$;

-- 3. Clean up any partial unique index we may have created earlier.
drop index if exists public.import_logs_r2_path_unique;

-- 4. import_logs.r2_path: NOT NULL + UNIQUE CONSTRAINT (required for FK target).
alter table public.import_logs
    alter column r2_path set not null;

alter table public.import_logs
    drop constraint if exists import_logs_r2_path_key;

alter table public.import_logs
    add constraint import_logs_r2_path_key unique (r2_path);

-- 5. import_logs.id: ensure server-side default.
alter table public.import_logs
    alter column id set default gen_random_uuid();

-- 6. Re-add FK on the new target column.
alter table public.bills
    add constraint bills_import_log_id_fkey
    foreign key (import_log_id)
    references public.import_logs(r2_path)
    on delete cascade;

-- 7. Index on bills.import_log_id.
drop index if exists public.bills_import_log_id_idx;
create index if not exists bills_import_log_id_idx
    on public.bills (import_log_id);
