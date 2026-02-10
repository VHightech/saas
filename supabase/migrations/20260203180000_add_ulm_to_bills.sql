alter table public.bills add column if not exists ulm text;

-- Optional: Index on ulm for faster supply lookups
create index if not exists bills_ulm_idx on public.bills (ulm);
