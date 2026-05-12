-- Migration: 20260506100000_drop_redundant_profile_columns.sql
-- Description: Removes columns from the profiles table that are now handled in user_supplies.

alter table public.profiles
    drop column if exists username,
    drop column if exists address,
    drop column if exists city,
    drop column if exists cif,
    drop column if exists stadio,
    drop column if exists stato_contratto;

-- Re-sync schema cache
notify pgrst, 'reload schema';
