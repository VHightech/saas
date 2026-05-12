import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function check() {
  const { data, error } = await supabase
    .from('profiles')
    .select('stato_contratto, count(*)')
    .group('stato_contratto')
  
  if (error) {
    console.error('Error:', error)
  } else {
    console.log('Status distribution in DB:', data)
  }
}

check()
