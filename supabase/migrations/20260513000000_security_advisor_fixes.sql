-- Security Advisor fixes (2026-05-13)
-- Addresses:
--   * function_search_path_mutable (lint 0011) — fixes 7 functions
--   * anon_security_definer_function_executable (lint 0028)
--   * authenticated_security_definer_function_executable (lint 0029)
--
-- NOT addressed here:
--   * extension_in_public (pg_trgm) — needs separate migration (drop/recreate + index rebuild)
--   * auth_leaked_password_protection — requires paid plan

-- ============================================================================
-- 1) Lock down search_path on all SECURITY DEFINER functions
-- ============================================================================
-- Pinning search_path to (public, pg_temp) prevents the "role mutable
-- search_path" lint warning AND avoids hijacking via per-role search_path
-- changes, while remaining backward compatible with function bodies that use
-- unqualified table references like `profiles` instead of `public.profiles`.
-- (Using an empty search_path is stricter but breaks any unqualified ref.)

alter function public.handle_auth_user_update()                 set search_path = public, pg_temp;
alter function public.handle_new_user()                          set search_path = public, pg_temp;
alter function public.mass_link_orphaned_data()                  set search_path = public, pg_temp;
alter function public.sync_profile_counts()                      set search_path = public, pg_temp;
alter function public.sync_bills_count()                         set search_path = public, pg_temp;
alter function public.sync_supplies_count()                      set search_path = public, pg_temp;
alter function public.sync_bill_status_from_payment()            set search_path = public, pg_temp;
alter function public.search_users(text, integer, integer, text, text, text, text)
                                                                 set search_path = public, pg_temp;

-- Same hardening for the other SECURITY DEFINER helpers (not flagged for
-- mutable search_path but still good practice):
alter function public.current_profile_id()                       set search_path = public, pg_temp;
alter function public.get_current_user_tenant_id()               set search_path = public, pg_temp;
alter function public.get_my_role()                              set search_path = public, pg_temp;
alter function public.is_admin(uuid)                             set search_path = public, pg_temp;
alter function public.activate_shadow_profile(uuid, text)        set search_path = public, pg_temp;
alter function public.bump_rate_limit(text, timestamptz)         set search_path = public, pg_temp;
alter function public.count_rate_limit(text, integer)            set search_path = public, pg_temp;
alter function public.prune_auth_rate_limits()                   set search_path = public, pg_temp;
alter function public.rls_auto_enable()                          set search_path = public, pg_temp;

-- ============================================================================
-- 2) Revoke EXECUTE from anon/authenticated on functions that should NOT be
--    callable via /rest/v1/rpc/...
-- ============================================================================

-- --- Trigger functions: invoked by triggers only, never by clients ---------
revoke execute on function public.handle_auth_user_update()        from anon, authenticated, public;
revoke execute on function public.handle_new_user()                from anon, authenticated, public;
revoke execute on function public.sync_profile_counts()            from anon, authenticated, public;
revoke execute on function public.sync_bills_count()               from anon, authenticated, public;
revoke execute on function public.sync_supplies_count()            from anon, authenticated, public;
revoke execute on function public.sync_bill_status_from_payment()  from anon, authenticated, public;

-- --- Admin / maintenance functions: only service_role should call them ----
revoke execute on function public.mass_link_orphaned_data()        from anon, authenticated, public;
revoke execute on function public.rls_auto_enable()                from anon, authenticated, public;
revoke execute on function public.prune_auth_rate_limits()         from anon, authenticated, public;

-- search_users is called from the admin area. The function body already
-- checks is_admin(), but we tighten the surface by removing anon access.
-- We keep authenticated EXECUTE because the in-function admin check gates it.
revoke execute on function public.search_users(text, integer, integer, text, text, text, text) from anon, public;

-- --- RLS helpers: keep authenticated, revoke anon ------------------------
-- These are used inside RLS policies; PostgREST evaluates policies under the
-- caller's role, so authenticated needs EXECUTE. Anon never needs them.
revoke execute on function public.current_profile_id()             from anon, public;
revoke execute on function public.get_current_user_tenant_id()     from anon, public;
revoke execute on function public.get_my_role()                    from anon, public;
revoke execute on function public.is_admin(uuid)                   from anon, public;

-- --- Intentional user-facing RPC ------------------------------------------
-- activate_shadow_profile: called after sign-up by an authenticated user.
-- Anon must NOT be able to claim a codice_cliente.
revoke execute on function public.activate_shadow_profile(uuid, text) from anon, public;

-- bump_rate_limit / count_rate_limit: called during login flow BEFORE auth,
-- so anon EXECUTE is intentional and kept.

-- ============================================================================
-- 3) Sanity check: list any remaining SECURITY DEFINER functions in public
--    that anon can still execute. Output is informational.
-- ============================================================================
do $$
declare
  r record;
begin
  raise notice 'Functions in public still executable by anon (review manually):';
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef = true
      and has_function_privilege('anon', p.oid, 'EXECUTE')
    order by p.proname
  loop
    raise notice '  - %(%)', r.proname, r.args;
  end loop;
end$$;
