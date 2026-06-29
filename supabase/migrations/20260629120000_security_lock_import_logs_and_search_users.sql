-- Security hardening from the 2026-06-29 pentest.
-- Applied to prod via Supabase migrations; committed here for version control.

-- Finding 1 (LOW/MEDIUM): import_logs SELECT was `USING (true)` for the
-- `authenticated` role, so ANY logged-in user could read every import batch
-- (archive names, R2 prefixes, counts, error JSON) over PostgREST. Restrict to
-- admins. The admin UI reads import_logs via the service-role client (which
-- bypasses RLS), so this does not affect admin functionality.
drop policy if exists "Allow read access to authenticated users" on public.import_logs;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'import_logs'
      and policyname = 'Admins can read import logs'
  ) then
    create policy "Admins can read import logs"
      on public.import_logs
      for select
      to authenticated
      using (public.is_admin(auth.uid()));
  end if;
end $$;

-- Finding 2 (hardening): search_users is SECURITY DEFINER and self-guards
-- (raises 'Access Denied' unless the caller is an admin), but EXECUTE was held
-- via the default PUBLIC grant, making it callable anonymously over
-- /rest/v1/rpc/search_users. Remove the anonymous attack surface; keep it
-- callable by authenticated (the internal admin guard still applies).
revoke execute on function
  public.search_users(text, integer, integer, text, text, text, text)
  from public, anon;

grant execute on function
  public.search_users(text, integer, integer, text, text, text, text)
  to authenticated;

notify pgrst, 'reload schema';
