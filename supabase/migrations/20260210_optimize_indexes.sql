-- 1. Index Foreign Keys (CRITICAL)
-- Rule: Always Index Foreign Keys
-- Impact: Prevents full table scans on joins and deletes
create index if not exists bills_user_id_idx on public.bills(user_id);

-- 2. Index Frequently Queried Columns (HIGH)
-- Rule: Query Performance
-- Impact: Speeds up lookups by codice_cliente (used in registration and bill ingestion)
create index if not exists profiles_codice_cliente_idx on public.profiles(codice_cliente);
create index if not exists bills_codice_cliente_idx on public.bills(codice_cliente);

-- 3. Optimization for RLS (MEDIUM)
-- Used in "Admins can view import logs" policy to check role
create index if not exists profiles_role_idx on public.profiles(role);
