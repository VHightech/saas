
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

// Load env from .env.local
const envConfig = dotenv.parse(fs.readFileSync('.env.local'))
const url = envConfig.NEXT_PUBLIC_SUPABASE_URL
const key = envConfig.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
    console.error('Missing Supabase creds in .env.local')
    process.exit(1)
}

const supabase = createClient(url, key)

async function checkFile(filename: string) {
    console.log(`--- Checking ${filename} ---`)

    // 1. Check Local File
    const localPath = path.join(process.cwd(), 'public', 'invoices', filename)
    const exists = fs.existsSync(localPath)
    console.log(`Local File Exists: ${exists}`)
    if (exists) {
        console.log('Size:', fs.statSync(localPath).size)
    }

    // 2. Check DB
    const { data, error } = await supabase
        .from('bills')
        .select('*')
        .ilike('nome_pdf', filename)

    // 3. Check Global Stats
    const { count, error: countError } = await supabase
        .from('bills')
        .select('*', { count: 'exact', head: true })
        .ilike('pdf_url', '/invoices/%')

    if (countError) {
        console.error('Count Error:', countError)
    } else {
        console.log(`TOTAL BILLS WITH LOCAL LINKS (/invoices/...): ${count}`)
    }
}

// checkFile('20260006566.pdf')
checkFile('20260006566.pdf')
