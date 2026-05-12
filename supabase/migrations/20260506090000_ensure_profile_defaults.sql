-- Migration: 20260506090000_ensure_profile_defaults.sql
-- Description: Ensures all profiles have a role and sets 'user' as the default.

-- 1. Backfill any missing roles
update public.profiles
set role = 'user'
where role is null;

-- 2. Set 'user' as the default for all future registrations/imports
alter table public.profiles
    alter column role set default 'user';
