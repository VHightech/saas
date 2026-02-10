-- SECURITY CRITICAL: Drop insecure "Tenant Isolation Policy"
-- This policy was allowing users to see ALL profiles in the same tenant, bypassing strict ownership rules.

alter table public.profiles enable row level security;

-- Drop the specific policy identified in the audit
drop policy if exists "Tenant Isolation Policy" on public.profiles;

-- Ensure only strict policies remain (re-applying just in case, though previous migration should have covered it)
-- These are the "Whitelist" policies we want:
-- 1. Users can view own profile
-- 2. Admins can view all profiles
-- 3. Admins can manage profiles
