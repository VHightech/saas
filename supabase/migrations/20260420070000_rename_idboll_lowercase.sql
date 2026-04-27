-- Rename quoted "idBoll" → idboll (unquoted, lowercase) to align with PostgREST's
-- default case folding. The JS client will now reference `idboll` everywhere.

do $$
begin
    -- Column rename if the camelCase variant exists.
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'bills' and column_name = 'idBoll'
    ) and not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'bills' and column_name = 'idboll'
    ) then
        execute 'alter table public.bills rename column "idBoll" to idboll';
    end if;
end $$;

-- Rebuild the unique partial index against the lowercase column (drop old if needed).
drop index if exists public.bills_idboll_unique;
create unique index if not exists bills_idboll_unique
    on public.bills (idboll)
    where idboll is not null;

-- Make sure the column is bigint (from migration 060000).
do $$
declare
    v_type text;
begin
    select data_type into v_type
    from information_schema.columns
    where table_schema = 'public' and table_name = 'bills' and column_name = 'idboll';

    if v_type = 'integer' then
        alter table public.bills alter column idboll type bigint using idboll::bigint;
    end if;
end $$;
