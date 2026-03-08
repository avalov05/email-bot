import { createClient } from '@libsql/client'
import path from 'path'
import fs from 'fs'

export async function runMigrations() {
  const dataDir = path.join(process.cwd(), 'data')
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  const dbUrl = process.env.DATABASE_URL || `file:${path.join(dataDir, 'outreach.db')}`
  const client = createClient({ url: dbUrl })

  const statements = [
    `CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY, provider TEXT NOT NULL, email TEXT NOT NULL,
      display_name TEXT, access_token TEXT NOT NULL, refresh_token TEXT,
      expires_at INTEGER, scope TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
      status TEXT NOT NULL DEFAULT 'draft', send_mode TEXT NOT NULL DEFAULT 'draft',
      account_id TEXT REFERENCES accounts(id), subject_template TEXT NOT NULL DEFAULT '',
      body_template TEXT NOT NULL DEFAULT '', footer_text TEXT DEFAULT '',
      include_footer INTEGER NOT NULL DEFAULT 1, compliance_confirmed INTEGER NOT NULL DEFAULT 0,
      throttle_ms INTEGER NOT NULL DEFAULT 2000, max_retries INTEGER NOT NULL DEFAULT 3,
      column_mapping TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS recipients (
      id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      email TEXT NOT NULL, first_name TEXT, last_name TEXT, company TEXT, custom_fields TEXT,
      status TEXT NOT NULL DEFAULT 'pending', draft_id TEXT, message_id TEXT,
      sent_at INTEGER, error TEXT, row_index INTEGER,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS send_jobs (
      id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id),
      status TEXT NOT NULL DEFAULT 'pending', started_at INTEGER, completed_at INTEGER,
      total_count INTEGER NOT NULL DEFAULT 0, sent_count INTEGER NOT NULL DEFAULT 0,
      draft_count INTEGER NOT NULL DEFAULT 0, failed_count INTEGER NOT NULL DEFAULT 0,
      skipped_count INTEGER NOT NULL DEFAULT 0, current_index INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS send_attempts (
      id TEXT PRIMARY KEY, recipient_id TEXT NOT NULL REFERENCES recipients(id),
      job_id TEXT NOT NULL REFERENCES send_jobs(id),
      attempt_number INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL,
      provider_response TEXT, error_message TEXT, sent_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS suppression_list (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, reason TEXT,
      campaign_id TEXT, added_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY, action TEXT NOT NULL, entity_type TEXT,
      entity_id TEXT, details TEXT, timestamp INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_recipients_campaign ON recipients(campaign_id)`,
    `CREATE INDEX IF NOT EXISTS idx_recipients_email ON recipients(email)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp)`,
  ]

  for (const sql of statements) {
    await client.execute(sql)
  }
  client.close()
}
