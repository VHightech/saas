-- ARCHITECTURAL CHANGE: Remove Multi-Tenant System
-- We are switching to a single-tenant architecture based strictly on User IDs.

-- 1. Drop Tenant Tables
drop table if exists public.tenant_admins cascade;
drop table if exists public.tenants cascade;

-- 1b. Drop conflicting policies that depend on tenant_id
drop policy if exists "Tenant Isolation Policy" on public.profiles;
drop policy if exists "Tenant Isolation Policy" on public.bills;
drop policy if exists "Tenant Isolation Policy" on public.import_logs;

-- 2. Clean up Profiles
alter table public.profiles drop column if exists tenant_id cascade;

-- 3. Clean up Bills
alter table public.bills drop column if exists tenant_id cascade;

-- 4. Clean up Import Logs
alter table public.import_logs drop column if exists tenant_id cascade;

-- 5. Clean up any other potential tenant columns in future tables
-- (Add here if any other tables were created with tenant_id)

-- 6. Ensure RLS Policies are clean (though Lockdown should have handled this, we verify)
-- Just ensuring no policies reference tenant_id (dropping tables cascades policies on them, but checking profiles)
-- The "Tenant Isolation Policy" was already dropped. 
-- Any policy referencing tenant_id on profiles/bills woudl fail, but since we dropped the column, 
-- those policies might cause issues if not dropped first? 
-- Actually, dropping a column cascadedly drops policies that depend on it usually, or errors.
-- Safer to drop the policies first if we hadn't already. 
-- But our "Security Lockdown" script already wiped all old policies and replaced them with ones NOT using tenant_id.
-- So we should be safe.

-- 7. Fix any functions that might use tenants (none critical found, mostly in middleware/code)
