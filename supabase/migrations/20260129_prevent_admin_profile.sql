-- Existing trigger might be inserting into profiles. 
-- We want to PREVENT this for admins.

create or replace function public.handle_new_user() 
returns trigger as $$
begin
  -- IF the user is an admin (checked via metadata), DO NOT create a public profile
  if new.raw_app_meta_data->>'role' = 'admin' or new.raw_app_meta_data->>'role' = 'super_admin' then
    return new;
  end if;

  -- Default behavior: Insert into profiles
  insert into public.profiles (id, email, name, surname)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', '');
  
  return new;
end;
$$ language plpgsql security definer;

-- Ensure the trigger uses this function (if a different one was used, we replace it)
-- Note: You might need to check the actual name of your trigger in the dashboard if it differs.
-- Standard naming:
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
