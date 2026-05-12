-- Migration: 20260507000000_fix_invite_trigger_and_skeleton_profile.sql
-- Description: 
--   1. Fix handle_new_user() to read codice_cliente from BOTH app_metadata and user_metadata.
--      (inviteUserByEmail puts `data` in app_metadata, not user_metadata)
--   2. When a shadow profile already exists for the invited codice_cliente,
--      skip creating a duplicate skeleton — setFirstPassword will handle the merge.

create or replace function public.handle_new_user()
returns trigger as $$
declare
  _cif text;
  _username text;
  _codice_cliente text;
begin
  -- Skip profile creation for admin users
  if (new.raw_app_meta_data->>'role' = 'admin') or
     (new.raw_app_meta_data->>'role' = 'super_admin') or
     (new.raw_user_meta_data->>'is_admin' = 'true') then
    return new;
  end if;

  begin
    _cif             := NULLIF(new.raw_user_meta_data->>'cif', '');
    _username        := COALESCE(new.raw_user_meta_data->>'username', new.email);

    -- Read codice_cliente from BOTH metadata locations:
    --   • inviteUserByEmail({ data: { codice_cliente } }) → raw_app_meta_data
    --   • Manual register flows                           → raw_user_meta_data
    _codice_cliente  := COALESCE(
        NULLIF(new.raw_app_meta_data->>'codice_cliente', ''),
        NULLIF(new.raw_user_meta_data->>'codice_cliente', '')
    );

    -- If a shadow profile already owns this codice_cliente, do NOT create a
    -- duplicate skeleton. setFirstPassword() will migrate the shadow row to
    -- the new real auth UUID so all bills/supplies remain linked.
    if _codice_cliente is not null and exists (
        select 1 from public.profiles
        where codice_cliente = _codice_cliente
          and is_shadow = true
        limit 1
    ) then
        return new;
    end if;

    -- Standard collision check
    if exists (
      select 1 from public.profiles
      where (cif = _cif and _cif is not null)
         or (username = _username)
    ) then
      return new;
    end if;

    -- Insert a new profile row
    insert into public.profiles (
      id,
      email,
      name,
      username,
      cfpi,
      cif,
      codice_cliente
    )
    values (
      new.id,
      new.email,
      COALESCE(new.raw_user_meta_data->>'full_name', ''),
      _username,
      NULLIF(new.raw_user_meta_data->>'cfpi', ''),
      _cif,
      _codice_cliente
    )
    on conflict (id) do nothing;

  exception when others then
    raise warning 'handle_new_user trigger failed for user %: %', new.id, SQLERRM;
  end;

  return new;
end;
$$ language plpgsql security definer;

-- Re-bind trigger (idempotent)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Notify PostgREST to reload schema cache
notify pgrst, 'reload schema';
