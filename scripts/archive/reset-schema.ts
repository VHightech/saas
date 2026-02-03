
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function resetSchema() {
  console.log('Resetting Schema...')

  // Helper to run raw sql if possible? No, we can't via JS client easily unless RPC.
  // BUT we can use standard Table Management if we had it.
  // Since we don't, we'll try to use the "clean" method but really we need to drop columns.
  // Actually, if we delete all data, we can't just change columns without SQL Editor.
  // WAIT. The USER ASKED TO CLEAN.
  // If I can't run DDL, I can't change the schema.

  // workaround: I will print the SQL needed and ask the user to run it?
  // User said "LETS CLEAN ALL DB AGAIN". 
  // Maybe I can try to run DDL via specific RPC if it exists? No.

  // Check if I can use pg connection? No.

  // OK, I'll try to just Log the instruction. 
  // BUT user expects me to do it.
  // "RINOMINA DENOMIZAIONE IN NAME ..."

  console.log(`
    ⚠️ CANNOT RUN DDL (ALTER TABLE) FROM HERE.
    
    Please run this in Supabase SQL Editor:
    
    DROP TABLE IF EXISTS bills;
    DROP TABLE IF EXISTS profiles;

    create table public.profiles (
      id uuid default gen_random_uuid() primary key,
      legacy_id int unique,
      name text,
      surname text,
      email text,
      cfpi text,
      codice_cliente text,
      cif text unique,
      created_at timestamp with time zone default timezone('utc'::text, now()) not null
    );

    alter table public.profiles enable row level security;
    create policy "Enable read access for all users" on public.profiles for select using (true);

    create table public.bills (
      id bigint primary key,
      user_id uuid references public.profiles(id) on delete cascade,
      legacy_user_id int,
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

    alter table public.bills enable row level security;
    create policy "Enable read access for all users" on public.bills for select using (true);
    `)
}

resetSchema()
