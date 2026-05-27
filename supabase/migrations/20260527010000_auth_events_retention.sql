-- GDPR data minimization / storage limitation (Art. 5.1.e): define a retention
-- window for auth_events. These rows contain pseudonymized identifiers (hashed
-- codice/email) plus IP + user agent, kept only for security/anti-abuse.
--
-- Default retention: 18 months. Adjust to the period documented in the privacy
-- notice. Invoke prune_auth_events() periodically (e.g. via pg_cron or a
-- scheduled job) to enforce it.

create or replace function public.prune_auth_events(p_months integer default 18)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    deleted_count integer;
begin
    delete from public.auth_events
    where created_at < now() - make_interval(months => p_months);
    get diagnostics deleted_count = row_count;
    return deleted_count;
end;
$$;

-- Server/maintenance only: never exposed over the REST API.
revoke all on function public.prune_auth_events(integer) from anon, authenticated, public;

-- If pg_cron is available, schedule a daily prune at 03:30 UTC. Safe no-op
-- when the extension is not installed.
do $$
begin
    if exists (select 1 from pg_extension where extname = 'pg_cron') then
        perform cron.schedule(
            'prune-auth-events-daily',
            '30 3 * * *',
            $cron$ select public.prune_auth_events(18); $cron$
        );
    end if;
end;
$$;
