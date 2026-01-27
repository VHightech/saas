
-- Reset Schema (Optional, use with caution)
-- drop table if exists public.bills;
-- drop table if exists public.profiles;

create table if not exists public.profiles (
  id uuid default gen_random_uuid() primary key,
  legacy_id int unique, -- Maps to 'Id' from utenti.csv
  name text, -- New First Name field
  surname text, -- New Last Name field
  email text, -- Re-added for sync from Auth
  phone text, -- New Phone field
  cfpi text,
  codice_cliente text,
  cif text unique, -- ✅ Unique constraint for upsert
  username text unique, -- ✅ Unique Username
  is_shadow boolean default false, -- ✅ Shadow Profile Flag
  address text, -- New Address field
  city text, -- New City field
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Trigger to sync email from auth.users to public.profiles
create or replace function public.handle_auth_user_update()
returns trigger as $$
begin
  update public.profiles
  set email = new.email
  where id = new.id;
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_updated
  after update on auth.users
  for each row execute procedure public.handle_auth_user_update();

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_auth_user_update();


-- Enable Row Level Security (RLS)
alter table public.profiles enable row level security;

create table if not exists public.bills (
  id bigint primary key, -- Maps to 'Id' from bolletta.csv
  user_id uuid references public.profiles(id) on delete cascade,
  legacy_user_id int, -- Maps to 'IdUser' from bolletta.csv
  cfpi text,
  codice_cliente text,
  nome_pdf text,
  tipo_servizio text,
  data_emissione date,
  scadenza date,
  importo numeric(10,2),
  consumo numeric(10,2),
  codice_cliente_old text,
  cif text,
  pdf_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.bills enable row level security;

-- Policies
create policy "Enable read access for all users" on public.profiles for select using (true);
create policy "Enable read access for all users" on public.bills for select using (true);
-- add insert/update policies as needed for service role (service role bypasses RLS anyway)

create table if not exists public.import_logs (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('pending', 'processing', 'completed', 'error')),
  total_files int default 0,
  processed_files int default 0,
  current_file text,
  errors jsonb default '[]'::jsonb,
  created_at timestamp with time zone default now()
);

alter table public.import_logs enable row level security;

create policy "Allow read access to authenticated users"
  on public.import_logs for select
  to authenticated
  using (true);
