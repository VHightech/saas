-- Remove REST/API exposure of SECURITY DEFINER helpers that are NOT used by any
-- RLS policy nor by application code (single-tenant app). Flagged by advisor
-- 0029. is_admin() and current_profile_id() are intentionally LEFT callable by
-- `authenticated` because the RLS policies on bills/payments/profiles/
-- user_supplies/import_logs depend on them (revoking would break row access).
revoke execute on function public.get_my_role() from anon, authenticated;
revoke execute on function public.get_current_user_tenant_id() from anon, authenticated;
