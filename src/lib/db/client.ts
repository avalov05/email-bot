import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'
import path from 'path'
import fs from 'fs'

function getDbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const dataDir = path.join(process.cwd(), 'data')
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  return `file:${path.join(dataDir, 'outreach.db')}`
}

const client = createClient({ url: getDbUrl() })
export const db = drizzle(client, { schema })
export type DB = typeof db
