import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  expiresAt: integer('expires_at'),
  scope: text('scope'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const campaigns = sqliteTable('campaigns', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull().default('draft'),
  sendMode: text('send_mode').notNull().default('draft'),
  accountId: text('account_id').references(() => accounts.id),
  subjectTemplate: text('subject_template').notNull().default(''),
  bodyTemplate: text('body_template').notNull().default(''),
  footerText: text('footer_text').default(''),
  includeFooter: integer('include_footer', { mode: 'boolean' }).notNull().default(true),
  complianceConfirmed: integer('compliance_confirmed', { mode: 'boolean' }).notNull().default(false),
  throttleMs: integer('throttle_ms').notNull().default(2000),
  maxRetries: integer('max_retries').notNull().default(3),
  columnMapping: text('column_mapping'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const recipients = sqliteTable('recipients', {
  id: text('id').primaryKey(),
  campaignId: text('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  company: text('company'),
  customFields: text('custom_fields'),
  status: text('status').notNull().default('pending'),
  subjectOverride: text('subject_override'),
  bodyOverride: text('body_override'),
  sentSubject: text('sent_subject'),
  sentBody: text('sent_body'),
  draftId: text('draft_id'),
  messageId: text('message_id'),
  sentAt: integer('sent_at'),
  error: text('error'),
  rowIndex: integer('row_index'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const sendJobs = sqliteTable('send_jobs', {
  id: text('id').primaryKey(),
  campaignId: text('campaign_id').notNull().references(() => campaigns.id),
  status: text('status').notNull().default('pending'),
  startedAt: integer('started_at'),
  completedAt: integer('completed_at'),
  totalCount: integer('total_count').notNull().default(0),
  sentCount: integer('sent_count').notNull().default(0),
  draftCount: integer('draft_count').notNull().default(0),
  failedCount: integer('failed_count').notNull().default(0),
  skippedCount: integer('skipped_count').notNull().default(0),
  currentIndex: integer('current_index').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const sendAttempts = sqliteTable('send_attempts', {
  id: text('id').primaryKey(),
  recipientId: text('recipient_id').notNull().references(() => recipients.id),
  jobId: text('job_id').notNull().references(() => sendJobs.id),
  attemptNumber: integer('attempt_number').notNull().default(1),
  status: text('status').notNull(),
  providerResponse: text('provider_response'),
  errorMessage: text('error_message'),
  sentAt: integer('sent_at').notNull(),
})

export const suppressionList = sqliteTable('suppression_list', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  reason: text('reason'),
  campaignId: text('campaign_id'),
  addedAt: integer('added_at').notNull(),
})

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value'),
  updatedAt: integer('updated_at').notNull(),
})

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  action: text('action').notNull(),
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  details: text('details'),
  timestamp: integer('timestamp').notNull(),
})
