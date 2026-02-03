-- Consolidated fix for handle_new_user trigger
-- 1. Handles the dropped 'surname' column (uses 'name'/'full_name' instead)
-- 2. Includes exception handling to prevent auth.createUser 500 errors if trigger fails
-- 3. Handles admin role checks to prevent profile creation for admins
-- 4. Handles unique checks for CIF and Username

create or replace function public.handle_new_user() 
returns trigger as $$
declare
  _cif text;
  _username text;
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

      -- Insert with correct columns (NO surname)
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
      raise warning 'handle_new_user trigger failed: %', SQLERRM;
  end;
  
  return new;
end;
$$ language plpgsql security definer;

-- Ensure the trigger is correctly bound
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
