-- Migration: 20260206120000_fix_profile_permissions.sql
-- Description: Fixes Mass Assignment vulnerability by restricting UPDATE privileges to safe columns only.

BEGIN;

-- 1. Revoke the ability for authenticated users to update ANY column on profiles
-- This removes the default "update all columns" permission if it was granted via "GRANT ALL ON TABLE..." 
-- or implicit owner rights (though users usually aren't owners).
-- Note: In Supabase, 'authenticated' usually has permissions granted via defaults or previous migrations.
REVOKE UPDATE ON public.profiles FROM authenticated;

-- 2. Grant the ability to update ONLY harmless columns
-- We strictly whitelist: name, address, city
-- This prevents Mass Assignment (e.g. sending { "role": "admin" }) because the DB will reject updates to columns not in this list.
GRANT UPDATE (name, address, city) ON public.profiles TO authenticated;

COMMIT;
