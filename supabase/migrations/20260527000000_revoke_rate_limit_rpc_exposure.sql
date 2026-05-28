-- Security hardening: remove the public REST surface of the rate-limit RPCs.
--
-- Supabase auto-grants EXECUTE on public functions to the `anon` and
-- `authenticated` roles so they are callable via /rest/v1/rpc/*. The earlier
-- migration (20260511000000) only revoked from `public`, leaving the explicit
-- anon/authenticated grants in place — flagged by the security advisor
-- (0028/0029: "Public/Signed-In Users Can Execute SECURITY DEFINER Function").
--
-- These functions are invoked EXCLUSIVELY server-side through the service-role
-- client (src/lib/auth-events.ts → bumpAndCheckRateLimit), which bypasses role
-- grants entirely. Revoking anon/authenticated EXECUTE therefore closes the
-- abuse surface (a caller inflating another user's rate-limit bucket → targeted
-- DoS of the first-access flow) WITHOUT affecting application behaviour.

revoke execute on function public.bump_rate_limit(text, timestamptz) from anon, authenticated;
revoke execute on function public.count_rate_limit(text, int)        from anon, authenticated;
