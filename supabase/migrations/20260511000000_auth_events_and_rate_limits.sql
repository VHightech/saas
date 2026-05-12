-- Audit log for authentication-related events (first-access invites, login attempts, etc).
-- Captures who/when/where/result for forensics and abuse detection.
create table if not exists public.auth_events (
    id uuid primary key default gen_random_uuid(),
    event_type text not null,
    codice_cliente_hash text,                  -- sha256(codice) so logs don't expose the code itself
    email_hash text,                           -- sha256(lower(email)), nullable
    ip_address inet,
    user_agent text,
    outcome text not null check (outcome in ('success','failure','blocked','rate_limited','captcha_failed')),
    reason text,                               -- short machine-readable reason code
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists auth_events_created_at_idx on public.auth_events (created_at desc);
create index if not exists auth_events_ip_created_idx on public.auth_events (ip_address, created_at desc);
create index if not exists auth_events_codice_hash_idx on public.auth_events (codice_cliente_hash, created_at desc);
create index if not exists auth_events_event_outcome_idx on public.auth_events (event_type, outcome, created_at desc);

-- Service role only. Regular users (including authenticated) must never read this.
alter table public.auth_events enable row level security;
revoke all on public.auth_events from anon, authenticated;
-- No policies => only the service role (which bypasses RLS) can read/write.

-- Sliding-window counters for throttling. Each row is one bucket.
create table if not exists public.auth_rate_limits (
    bucket_key text not null,                  -- e.g. "ip:1.2.3.4" or "codice:abcd"
    window_start timestamptz not null,         -- truncated to the minute
    hit_count int not null default 0,
    primary key (bucket_key, window_start)
);

create index if not exists auth_rate_limits_window_idx on public.auth_rate_limits (window_start);

alter table public.auth_rate_limits enable row level security;
revoke all on public.auth_rate_limits from anon, authenticated;

-- Atomic increment + return-current-count helper.
-- Buckets are 1 minute wide; caller decides how many buckets to sum.
create or replace function public.bump_rate_limit(
    p_bucket_key text,
    p_window timestamptz default date_trunc('minute', now())
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
    v_count int;
begin
    insert into public.auth_rate_limits (bucket_key, window_start, hit_count)
    values (p_bucket_key, p_window, 1)
    on conflict (bucket_key, window_start)
    do update set hit_count = public.auth_rate_limits.hit_count + 1
    returning hit_count into v_count;

    return v_count;
end;
$$;

-- Sum hits across the last N minutes for a bucket.
create or replace function public.count_rate_limit(
    p_bucket_key text,
    p_minutes int default 10
) returns int
language sql
security definer
set search_path = public
as $$
    select coalesce(sum(hit_count), 0)::int
    from public.auth_rate_limits
    where bucket_key = p_bucket_key
      and window_start >= date_trunc('minute', now()) - make_interval(mins => p_minutes);
$$;

revoke all on function public.bump_rate_limit(text, timestamptz) from public;
revoke all on function public.count_rate_limit(text, int) from public;

-- Janitor: drop buckets older than 1 day.
create or replace function public.prune_auth_rate_limits()
returns void
language sql
security definer
set search_path = public
as $$
    delete from public.auth_rate_limits where window_start < now() - interval '1 day';
$$;
