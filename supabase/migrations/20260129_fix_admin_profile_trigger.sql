-- Update the trigger to check user_metadata (which we CAN set during invite)
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  -- IF the user is flagged as admin in metadata, DO NOT create a public profile
  if (new.raw_user_meta_data->>'is_admin' = 'true') then
    return new;
  end if;

  -- Default behavior: Insert into profiles
  -- We use 'full_name' for 'name' and leave surname empty for now
  insert into public.profiles (id, email, name, surname)
  values (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', ''), 
    ''
  )
  on conflict (id) do nothing;
  
  return new;
end;
$$ language plpgsql security definer;
