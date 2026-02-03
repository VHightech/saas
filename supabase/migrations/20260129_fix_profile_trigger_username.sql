-- Fix for "Database error creating new user"
-- We wrap the logic in an exception block to ensure that if the trigger fails (e.g. schema mismatch, unknown column), 
-- the Auth User creation still succeeds.
-- The application code (actions.ts) is robust enough to handle the profile creation/linking step if the trigger skips it.

create or replace function public.handle_new_user() 
returns trigger as $$
declare
  _cif text;
  _username text;
  _log text;
begin
  -- IF the user is an admin (checked via metadata), DO NOT create a public profile
  if (new.raw_app_meta_data->>'role' = 'admin') or 
     (new.raw_app_meta_data->>'role' = 'super_admin') or
     (new.raw_user_meta_data->>'is_admin' = 'true') then
    return new;
  end if;

  -- Safe block: Try to insert, but catch ANY error to prevent "Database error creating new user"
  begin
      -- Extract potential unique values
      _cif := NULLIF(new.raw_user_meta_data->>'cif', '');
      _username := COALESCE(new.raw_user_meta_data->>'username', new.email);

      -- Check existence of colliding profile
      if exists (
        select 1 from public.profiles 
        where (cif = _cif and _cif is not null) 
           or (username = _username)
      ) then
        return new; -- Conflict found, skip insert (let app handle it)
      end if;

      -- Use explicit column list matching what we know exists
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
        NULLIF(new.raw_user_meta_data->>'codice_cliente', '')
      )
      on conflict (id) do nothing;

  exception when others then
      -- If ANYTHING fails (column missing, type error, etc.), we swallow the error
      -- This ensures the Auth User is created even if the Profile trigger fails.
      -- Ideally, we would log this, but for now we just want to unblock creation.
      raise warning 'handle_new_user trigger failed: %', SQLERRM;
  end;
  
  return new;
end;
$$ language plpgsql security definer;
