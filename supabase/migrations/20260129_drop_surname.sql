-- Drop surname column from profiles table as requested
alter table public.profiles drop column if exists surname;
