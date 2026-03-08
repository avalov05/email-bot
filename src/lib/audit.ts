import { db } from '@/lib/db/client'
import { auditLogs } from '@/lib/db/schema'
import { v4 as uuidv4 } from 'uuid'

export type AuditAction =
  | 'account.connected' | 'account.disconnected'
  | 'campaign.created' | 'campaign.updated' | 'campaign.deleted'
  | 'campaign.archived' | 'campaign.duplicated' | 'campaign.started'
  | 'campaign.paused' | 'campaign.stopped' | 'campaign.completed'
  | 'recipient.imported' | 'recipient.suppressed'
  | 'send.draft_created' | 'send.sent' | 'send.failed' | 'send.skipped'
  | 'suppression.added' | 'suppression.removed' | 'settings.updated'

export async function audit(
  action: AuditAction,
  options?: { entityType?: string; entityId?: string; details?: Record<string, unknown> }
) {
  try {
    await db.insert(auditLogs).values({
      id: uuidv4(), action,
      entityType: options?.entityType ?? null,
      entityId: options?.entityId ?? null,
      details: options?.details ? JSON.stringify(options.details) : null,
      timestamp: Date.now(),
    })
  } catch (e) {
    console.error('[Audit]', e)
  }
}
