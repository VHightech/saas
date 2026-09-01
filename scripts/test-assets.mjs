import fs from 'node:fs'
import path from 'node:path'

const ASSETS_DIR = path.resolve('presentations/manual_assets')
const files = fs.readdirSync(ASSETS_DIR)
console.log(`Found ${files.length} asset files in ${ASSETS_DIR}`)
