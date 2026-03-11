#!/usr/bin/env node
import React from 'react'
import { render } from 'ink'
import { App } from './App.js'
import fs from 'fs'
import path from 'path'

// Load .env file manually — tsx/Node don't auto-read it
try {
  const envPath = path.join(process.cwd(), '.env')
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 1) continue
    const key = t.slice(0, eq).trim()
    const val = t.slice(eq + 1).trim()
    if (key && !(key in process.env)) process.env[key] = val
  }
} catch { /* .env not found — rely on shell env */ }

// Log errors to file so crashes can be diagnosed
const LOG_FILE = path.join(process.cwd(), 'data', 'error.log')
function logError(label: string, err: unknown) {
  const msg = `[${new Date().toISOString()}] ${label}: ${err instanceof Error ? err.stack || err.message : String(err)}\n`
  try { fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true }); fs.appendFileSync(LOG_FILE, msg) } catch {}
  process.stdout.write('\x1b[?25h') // show cursor
}

process.on('uncaughtException',  (err) => { logError('uncaughtException', err); process.exit(1) })
process.on('unhandledRejection', (reason) => { logError('unhandledRejection', reason) })

// Handle clean exit
process.on('SIGINT',  () => { process.stdout.write('\x1b[?25h'); process.exit(0) })
process.on('SIGTERM', () => { process.stdout.write('\x1b[?25h'); process.exit(0) })

// Hide cursor
process.stdout.write('\x1b[?25l')

const { waitUntilExit } = render(<App />, {
  exitOnCtrlC: true,
  debug: false,
})

waitUntilExit().then(() => {
  process.stdout.write('\x1b[?25h') // show cursor on exit
  process.exit(0)
}).catch(() => {
  process.stdout.write('\x1b[?25h')
  process.exit(1)
})
