-- Add STADIO and STATO CONTRATTO to profiles table
do $$
begin
    if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'profiles'
          and column_name = 'stadio'
    ) then
        alter table public.profiles add column stadio text;
    end if;

    if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'profiles'
          and column_name = 'stato_contratto'
    ) then
        alter table public.profiles add column stato_contratto text;
    end if;
end $$;
