-- Migration: 20260506060000_performance_boost.sql
-- Description: Advanced performance optimizations for large datasets (40,000+ users).
--   1. Index user_supplies(user_id) for fast detail page loads.
--   2. Enable pg_trgm for advanced text search.
--   3. Create a GIN index on profiles for instant search bar results.

-- 1. Index Foreign Keys
CREATE INDEX IF NOT EXISTS user_supplies_user_id_idx ON public.user_supplies(user_id);

-- 2. Enable Trigram extension for fuzzy search optimization
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 3. Create a GIN index for the main search bar
-- We index the combination of columns most frequently searched.
-- This makes ILIKE '%term%' queries super fast.
CREATE INDEX IF NOT EXISTS profiles_search_gin_idx ON public.profiles 
USING gin (
    (
        coalesce(name, '') || ' ' || 
        coalesce(email, '') || ' ' || 
        coalesce(cif, '') || ' ' || 
        coalesce(cfpi, '') || ' ' || 
        coalesce(codice_cliente, '') || ' ' || 
        coalesce(address, '') || ' ' || 
        coalesce(city, '')
    ) gin_trgm_ops
);

-- 4. Analyze tables to update statistics for the query planner
ANALYZE public.profiles;
ANALYZE public.bills;
ANALYZE public.user_supplies;
