-- Bill numbers like 20260013505 exceed the 32-bit signed int range (~2.14 B).
-- Switch "idBoll" to bigint; JS numbers can safely represent it up to 2^53.

do $$
declare
    v_type text;
begin
    select data_type into v_type
    from information_schema.columns
    where table_schema = 'public' and table_name = 'bills' and column_name = 'idBoll';

    if v_type = 'integer' then
        alter table public.bills alter column "idBoll" type bigint using "idBoll"::bigint;
    end if;
end $$;
