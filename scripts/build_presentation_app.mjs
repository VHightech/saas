import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const execFileAsync = promisify(execFile)
const ROOT = path.resolve('.')
const OUT_DIR = path.join(ROOT, 'out')
const imgs = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'imgs.json'), 'utf-8'))

console.log('Building Animated Interactive Presentation...')
