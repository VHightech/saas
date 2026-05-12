-- Migration: 20260511020000_profiles_auth_user_id_pointer.sql
-- =============================================================================
-- Adds `profiles.auth_user_id` as the canonical link to `auth.users(id)`,
-- decoupling the legacy `profiles.id` from the auth UUID.
--
-- WHY: Today, `profiles.id` is sometimes the auth UUID (for direct signups),
-- and sometimes a random "shadow" UUID created during CSV import of legacy
-- customers. When such a customer activates, Supabase issues a fresh
-- `auth.users.id` that doesn't match the shadow's `profiles.id`, forcing a
-- complex merge of bills / user_supplies / payments rows. That merge is the
-- root cause of repeated FK-order bugs and broken activations.
--
-- AFTER THIS MIGRATION:
--   * `profiles.id` is immutable — never rewritten, never matched against auth.
--   * `profiles.auth_user_id` is the SOLE link to `auth.users(id)`.
--   * `bills.user_id`, `user_supplies.user_id`, `payments.user_id` continue
--     to reference `profiles.id` — but nothing moves on activation.
--   * Activation = a single UPDATE: set auth_user_id on the shadow row.
--   * RLS uses a helper `current_profile_id()` that resolves the caller's
--     `auth.uid()` to their `profiles.id` via `auth_user_id`.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Add the pointer column and indexes
-- -----------------------------------------------------------------------------

alter table public.profiles
    add column if not exists auth_user_id uuid
        references auth.users(id) on delete cascade;

-- Each auth user can map to at most one profile.
do $$
begin
    if not exists (
        select 1 from pg_indexes
        where schemaname='public' and indexname='profiles_auth_user_id_key'
    ) then
        create unique index profiles_auth_user_id_key
            on public.profiles(auth_user_id)
            where auth_user_id is not null;
    end if;
end$$;

create index if not exists profiles_auth_user_id_idx on public.profiles(auth_user_id);

-- -----------------------------------------------------------------------------
-- 2. Backfill auth_user_id for existing rows
-- -----------------------------------------------------------------------------

-- 2a. For "direct signup" profiles, `profiles.id` is already the auth UUID.
--     Set auth_user_id = id so existing users keep working under the new RLS.
update public.profiles p
set auth_user_id = p.id
where p.auth_user_id is null
  and exists (
      select 1 from auth.users u where u.id = p.id
  );

-- 2b. For shadow profiles whose owner has already activated (an auth.users row
--     exists with matching codice_cliente in metadata), set auth_user_id to
--     the real auth UUID. This recovers users currently stuck in the broken
--     activate_shadow_profile() flow.
update public.profiles p
set auth_user_id = u.id,
    is_shadow = false
from auth.users u
where p.auth_user_id is null
  and p.is_shadow = true
  and p.codice_cliente is not null
  and (
        coalesce(u.raw_app_meta_data->>'codice_cliente', '') = p.codice_cliente
     or coalesce(u.raw_user_meta_data->>'codice_cliente', '') = p.codice_cliente
  );

-- 2c. Clean up any orphan profile rows that the failed merge RPC may have
--     created (profile rows whose id matches an auth.users row but
--     auth_user_id is NULL because the activation rolled back). Skip rows
--     that have any children — those are real direct signups.
--     Each table guarded individually so the migration works even if some
--     optional child tables don't exist yet.
do $$
declare
    v_has_bills    boolean := to_regclass('public.bills')          is not null;
    v_has_supplies boolean := to_regclass('public.user_supplies')  is not null;
    v_has_payments boolean := to_regclass('public.payments')       is not null;
    v_sql          text    := 'delete from public.profiles p '
                           || 'where p.auth_user_id is null '
                           || '  and exists (select 1 from auth.users u where u.id = p.id) ';
begin
    if v_has_bills    then v_sql := v_sql || '  and not exists (select 1 from public.bills          b where b.user_id = p.id) '; end if;
    if v_has_supplies then v_sql := v_sql || '  and not exists (select 1 from public.user_supplies  s where s.user_id = p.id) '; end if;
    if v_has_payments then v_sql := v_sql || '  and not exists (select 1 from public.payments       y where y.user_id = p.id) '; end if;

    execute v_sql;
end$$;

-- -----------------------------------------------------------------------------
-- 3. Helper: current_profile_id()
--    Resolves the calling auth.uid() to its profiles.id via auth_user_id.
--    All RLS policies use this instead of `auth.uid() = id`.
-- -----------------------------------------------------------------------------

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
    select id from public.profiles where auth_user_id = auth.uid() limit 1;
$$;

revoke all on function public.current_profile_id() from public;
grant execute on function public.current_profile_id() to authenticated, anon;

-- -----------------------------------------------------------------------------
-- 4. Rewrite is_admin() to gate via auth_user_id
-- -----------------------------------------------------------------------------

create or replace function public.is_admin(user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
    return exists (
        select 1 from public.profiles
        where auth_user_id = user_id
          and role in ('admin', 'superadmin', 'super_admin')
    );
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Rewrite all RLS policies that referenced `auth.uid() = id`
--    or `auth.uid() = user_id` to use the new pointer / helper.
-- -----------------------------------------------------------------------------

-- 5a. profiles
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "Admins can manage profiles" on public.profiles;

create policy "Users can view own profile"
    on public.profiles for select
    to authenticated
    using ( auth_user_id = auth.uid() );

create policy "Users can update own profile"
    on public.profiles for update
    to authenticated
    using ( auth_user_id = auth.uid() )
    with check ( auth_user_id = auth.uid() );

create policy "Admins can view all profiles"
    on public.profiles for select
    to authenticated
    using ( is_admin(auth.uid()) );

create policy "Admins can manage profiles"
    on public.profiles for all
    to authenticated
    using ( is_admin(auth.uid()) )
    with check ( is_admin(auth.uid()) );

-- 5b. bills
do $$
begin
    if to_regclass('public.bills') is not null then
        execute 'drop policy if exists "Users can view own bills"  on public.bills';
        execute 'drop policy if exists "Admins can view all bills" on public.bills';
        execute 'drop policy if exists "Admins can manage bills"   on public.bills';

        execute $p$
            create policy "Users can view own bills"
                on public.bills for select
                to authenticated
                using ( user_id = current_profile_id() )
        $p$;

        execute $p$
            create policy "Admins can view all bills"
                on public.bills for select
                to authenticated
                using ( is_admin(auth.uid()) )
        $p$;

        execute $p$
            create policy "Admins can manage bills"
                on public.bills for all
                to authenticated
                using ( is_admin(auth.uid()) )
                with check ( is_admin(auth.uid()) )
        $p$;
    end if;
end$$;

-- 5c. user_supplies
do $$
begin
    if to_regclass('public.user_supplies') is not null then
        execute 'drop policy if exists "Users can read own supplies" on public.user_supplies';
        execute 'drop policy if exists "Admins can manage supplies"   on public.user_supplies';

        execute $p$
            create policy "Users can read own supplies"
                on public.user_supplies for select
                to authenticated
                using ( user_id = current_profile_id() )
        $p$;

        execute $p$
            create policy "Admins can manage supplies"
                on public.user_supplies for all
                to authenticated
                using ( is_admin(auth.uid()) )
                with check ( is_admin(auth.uid()) )
        $p$;
    end if;
end$$;

-- 5d. payments
do $$
begin
    if to_regclass('public.payments') is not null then
        execute 'drop policy if exists "Users can view own payments"           on public.payments';
        execute 'drop policy if exists "Users can insert own pending payments" on public.payments';
        execute 'drop policy if exists "Admins can view all payments"          on public.payments';
        execute 'drop policy if exists "Admins can manage payments"            on public.payments';

        execute $p$
            create policy "Users can view own payments"
                on public.payments for select
                to authenticated
                using ( user_id = current_profile_id() )
        $p$;

        execute $p$
            create policy "Users can insert own pending payments"
                on public.payments for insert
                to authenticated
                with check ( user_id = current_profile_id() and status = 'pending' )
        $p$;

        execute $p$
            create policy "Admins can view all payments"
                on public.payments for select
                to authenticated
                using ( is_admin(auth.uid()) )
        $p$;

        execute $p$
            create policy "Admins can manage payments"
                on public.payments for all
                to authenticated
                using ( is_admin(auth.uid()) )
                with check ( is_admin(auth.uid()) )
        $p$;
    end if;
end$$;

-- 5e. tenants — owner check now via current_profile_id().
--     Wrapped in an existence guard because this table is optional in some
--     environments.
do $$
begin
    if to_regclass('public.tenants') is not null then
        execute 'drop policy if exists "Users can view their own tenant" on public.tenants';
        execute $p$
            create policy "Users can view their own tenant"
                on public.tenants for select
                to authenticated
                using (
                    id in (select tenant_id from public.profiles where auth_user_id = auth.uid())
                 or is_admin(auth.uid())
                )
        $p$;
    end if;
end$$;

-- 5f. tenant_admins — same guard.
do $$
begin
    if to_regclass('public.tenant_admins') is not null then
        execute 'drop policy if exists "Users can view own staff profile" on public.tenant_admins';
        execute 'drop policy if exists "Admins can manage tenant staff" on public.tenant_admins';

        execute $p$
            create policy "Users can view own staff profile"
                on public.tenant_admins for select
                to authenticated
                using ( id = auth.uid() or id = current_profile_id() )
        $p$;

        execute $p$
            create policy "Admins can manage tenant staff"
                on public.tenant_admins for all
                to authenticated
                using ( is_admin(auth.uid()) )
                with check ( is_admin(auth.uid()) )
        $p$;
    end if;
end$$;

-- 5g. import_logs — admin-only as before; is_admin() now uses auth_user_id.
do $$
begin
    if to_regclass('public.import_logs') is not null then
        execute 'drop policy if exists "Admins can manage import logs" on public.import_logs';
        execute 'drop policy if exists "Admins can view import logs"   on public.import_logs';
        execute 'drop policy if exists "Admins can insert import logs" on public.import_logs';
        execute 'drop policy if exists "Admins can update import logs" on public.import_logs';

        execute $p$
            create policy "Admins can manage import logs"
                on public.import_logs for all
                to authenticated
                using ( is_admin(auth.uid()) )
                with check ( is_admin(auth.uid()) )
        $p$;
    end if;
end$$;

-- -----------------------------------------------------------------------------
-- 6. Rewrite handle_new_user trigger
--    Two cases:
--      (a) Shadow profile exists for the codice_cliente -> UPDATE its
--          auth_user_id, flip is_shadow=false. No new row, no merge.
--      (b) No shadow -> INSERT a new profile with id = auth_user_id = new.id
--          (the classic direct-signup case).
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    _codice_cliente text;
    _username       text;
    _cif            text;
    _shadow_id      uuid;
begin
    if (new.raw_app_meta_data->>'role' = 'admin')
       or (new.raw_app_meta_data->>'role' = 'super_admin')
       or (new.raw_user_meta_data->>'is_admin' = 'true') then
        return new;
    end if;

    begin
        _codice_cliente := coalesce(
            nullif(new.raw_app_meta_data->>'codice_cliente', ''),
            nullif(new.raw_user_meta_data->>'codice_cliente', '')
        );
        _username := coalesce(new.raw_user_meta_data->>'username', new.email);
        _cif      := nullif(new.raw_user_meta_data->>'cif', '');

        -- (a) Activate an existing shadow profile (most common path for
        --     legacy customers using the invite flow).
        if _codice_cliente is not null then
            select id into _shadow_id
            from public.profiles
            where codice_cliente = _codice_cliente
              and is_shadow = true
              and auth_user_id is null
            limit 1
            for update;

            if _shadow_id is not null then
                update public.profiles
                set auth_user_id = new.id,
                    is_shadow    = false,
                    email        = coalesce(public.profiles.email, new.email)
                where id = _shadow_id;
                return new;
            end if;
        end if;

        -- (b) Direct signup — create a fresh profile row. Skip if either the
        --     id, username, or cif already collides.
        if exists (
            select 1 from public.profiles
            where id = new.id
               or (username is not null and username = _username)
               or (cif is not null and _cif is not null and cif = _cif)
        ) then
            return new;
        end if;

        insert into public.profiles (
            id, auth_user_id, email, name, username, cfpi, cif, codice_cliente
        )
        values (
            new.id,
            new.id,
            new.email,
            coalesce(new.raw_user_meta_data->>'full_name', ''),
            _username,
            nullif(new.raw_user_meta_data->>'cfpi', ''),
            _cif,
            _codice_cliente
        )
        on conflict (id) do update set
            auth_user_id = excluded.auth_user_id,
            is_shadow    = false;

    exception when others then
        raise warning 'handle_new_user trigger failed for user %: %', new.id, sqlerrm;
    end;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 7. Replace activate_shadow_profile with a thin wrapper that just sets
--    auth_user_id on the shadow row (no more row migration).
-- -----------------------------------------------------------------------------

create or replace function public.activate_shadow_profile(
    p_real_user_id   uuid,
    p_codice_cliente text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_shadow_id uuid;
begin
    -- Idempotent: if the auth user is already linked to a profile, succeed.
    if exists (select 1 from public.profiles where auth_user_id = p_real_user_id) then
        return jsonb_build_object('status', 'already_activated');
    end if;

    select id into v_shadow_id
    from public.profiles
    where codice_cliente = p_codice_cliente
      and is_shadow = true
      and auth_user_id is null
    limit 1
    for update;

    if v_shadow_id is null then
        return jsonb_build_object(
            'status', 'no_shadow_found',
            'message', 'No shadow profile available for this codice_cliente.'
        );
    end if;

    update public.profiles
    set auth_user_id = p_real_user_id,
        is_shadow    = false
    where id = v_shadow_id;

    return jsonb_build_object(
        'status', 'success',
        'profile_id', v_shadow_id,
        'auth_user_id', p_real_user_id
    );
end;
$$;

grant execute on function public.activate_shadow_profile(uuid, text) to service_role;
revoke execute on function public.activate_shadow_profile(uuid, text) from anon, authenticated;

comment on function public.activate_shadow_profile is
    'Idempotent: links a shadow profile to an authenticated user via auth_user_id. No row migration.';

-- -----------------------------------------------------------------------------
-- 8. Done
-- -----------------------------------------------------------------------------

notify pgrst, 'reload schema';

commit;
