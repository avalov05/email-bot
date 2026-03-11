import { db } from '@/lib/db/client'
import { campaigns, recipients, sendJobs, sendAttempts } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { renderEmail } from '@/lib/templates/engine'
import { isSuppress } from '@/lib/suppression'
import { audit } from '@/lib/audit'
import { getProvider } from '@/lib/providers/factory'

export type QueueStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'completed'

interface QueueState {
  jobId: string | null
  campaignId: string | null
  status: QueueStatus
  abortController: AbortController | null
}

const state: QueueState = { jobId: null, campaignId: null, status: 'idle', abortController: null }

export function getQueueState() {
  return { jobId: state.jobId, campaignId: state.campaignId, status: state.status }
}

export async function startCampaign(campaignId: string): Promise<string> {
  if (state.status === 'running') throw new Error('Another campaign is already running')
  const campaign = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1).then(r => r[0])
  if (!campaign) throw new Error('Campaign not found')
  if (!campaign.accountId) throw new Error('Campaign has no connected account')
  if (!campaign.complianceConfirmed) throw new Error('Compliance must be confirmed before sending')

  const pending = await db.select().from(recipients)
    .where(and(eq(recipients.campaignId, campaignId), eq(recipients.status, 'pending')))
    .orderBy(recipients.rowIndex)

  if (pending.length === 0) throw new Error('No pending recipients')

  const jobId = uuidv4()
  const now = Date.now()
  await db.insert(sendJobs).values({
    id: jobId, campaignId, status: 'running', startedAt: now,
    totalCount: pending.length, sentCount: 0, draftCount: 0,
    failedCount: 0, skippedCount: 0, currentIndex: 0,
    createdAt: now, updatedAt: now,
  })
  await db.update(campaigns).set({ status: 'running', updatedAt: now }).where(eq(campaigns.id, campaignId))

  state.jobId = jobId
  state.campaignId = campaignId
  state.status = 'running'
  state.abortController = new AbortController()

  processCampaign(campaign, pending, jobId, state.abortController.signal).catch(console.error)
  await audit('campaign.started', { entityType: 'campaign', entityId: campaignId, details: { jobId } })
  return jobId
}

export async function pauseQueue() {
  if (state.status !== 'running') return
  state.status = 'paused'
  if (state.jobId) await db.update(sendJobs).set({ status: 'paused', updatedAt: Date.now() }).where(eq(sendJobs.id, state.jobId))
  if (state.campaignId) await audit('campaign.paused', { entityType: 'campaign', entityId: state.campaignId })
}

export async function resumeQueue() {
  if (state.status !== 'paused') return
  state.status = 'running'
  if (state.jobId) await db.update(sendJobs).set({ status: 'running', updatedAt: Date.now() }).where(eq(sendJobs.id, state.jobId))
}

export async function stopQueue() {
  state.status = 'stopped'
  state.abortController?.abort()
  if (state.jobId) await db.update(sendJobs).set({ status: 'stopped', completedAt: Date.now(), updatedAt: Date.now() }).where(eq(sendJobs.id, state.jobId))
  if (state.campaignId) {
    await db.update(campaigns).set({ status: 'paused', updatedAt: Date.now() }).where(eq(campaigns.id, state.campaignId))
    await audit('campaign.stopped', { entityType: 'campaign', entityId: state.campaignId })
  }
  state.jobId = null; state.campaignId = null; state.abortController = null
}

async function processCampaign(
  campaign: typeof campaigns.$inferSelect,
  pending: typeof recipients.$inferSelect[],
  jobId: string,
  signal: AbortSignal
) {
  const provider = await getProvider(campaign.accountId!)
  let sentCount = 0, draftCount = 0, failedCount = 0, skippedCount = 0

  for (let i = 0; i < pending.length; i++) {
    if (signal.aborted || state.status === 'stopped') break
    while (state.status === 'paused') { await sleep(300); if (signal.aborted) break }

    const recipient = pending[i]
    if (await isSuppress(recipient.email)) {
      await db.update(recipients).set({ status: 'suppressed', updatedAt: Date.now() }).where(eq(recipients.id, recipient.id))
      skippedCount++
      await db.update(sendJobs).set({ skippedCount, currentIndex: i + 1, updatedAt: Date.now() }).where(eq(sendJobs.id, jobId))
      continue
    }

    const customFields = recipient.customFields ? JSON.parse(recipient.customFields) : {}
    const recipientData = { email: recipient.email, first_name: recipient.firstName || '', last_name: recipient.lastName || '', company: recipient.company || '', ...customFields }
    const footer = campaign.includeFooter ? (campaign.footerText || '') : undefined
    // Use per-row content if present, fall back to campaign template
    const subjectTemplate = recipient.subjectOverride || campaign.subjectTemplate
    const bodyTemplate = recipient.bodyOverride || campaign.bodyTemplate
    const { subject, body } = renderEmail(subjectTemplate, bodyTemplate, recipientData, footer)

    let success = false, lastError = ''
    for (let attempt = 1; attempt <= campaign.maxRetries; attempt++) {
      if (signal.aborted) break
      try {
        await db.update(recipients).set({ status: 'sending', updatedAt: Date.now() }).where(eq(recipients.id, recipient.id))
        if (campaign.sendMode === 'dry_run') {
          await sleep(50)
          await db.update(recipients).set({ status: 'sent', sentAt: Date.now(), sentSubject: subject, sentBody: body, updatedAt: Date.now() }).where(eq(recipients.id, recipient.id))
          await recordAttempt(recipient.id, jobId, attempt, 'success', { dry_run: true })
          sentCount++; success = true; break
        } else if (campaign.sendMode === 'draft') {
          const r = await provider.createDraft({ to: recipient.email, subject, body })
          await db.update(recipients).set({ status: 'draft_created', draftId: r.id, sentSubject: subject, sentBody: body, updatedAt: Date.now() }).where(eq(recipients.id, recipient.id))
          await recordAttempt(recipient.id, jobId, attempt, 'draft_created', r)
          await audit('send.draft_created', { entityType: 'recipient', entityId: recipient.id })
          draftCount++; success = true; break
        } else {
          const r = await provider.sendEmail({ to: recipient.email, subject, body })
          await db.update(recipients).set({ status: 'sent', messageId: r.id, sentAt: Date.now(), sentSubject: subject, sentBody: body, updatedAt: Date.now() }).where(eq(recipients.id, recipient.id))
          await recordAttempt(recipient.id, jobId, attempt, 'success', r)
          await audit('send.sent', { entityType: 'recipient', entityId: recipient.id })
          sentCount++; success = true; break
        }
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : String(err)
        const isRetryable = /429|503|502|timeout/i.test(lastError)
        if (!isRetryable || attempt === campaign.maxRetries) break
        await sleep(Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 30000))
      }
    }

    if (!success) {
      await db.update(recipients).set({ status: 'failed', error: lastError, updatedAt: Date.now() }).where(eq(recipients.id, recipient.id))
      await recordAttempt(recipient.id, jobId, 1, 'failed', undefined, lastError)
      await audit('send.failed', { entityType: 'recipient', entityId: recipient.id, details: { error: lastError } })
      failedCount++
      const processed = sentCount + draftCount + failedCount + skippedCount
      if (processed >= 10 && failedCount / processed > 0.3) {
        state.status = 'paused'
        await db.update(sendJobs).set({ status: 'paused', updatedAt: Date.now() }).where(eq(sendJobs.id, jobId))
      }
    }

    await db.update(sendJobs).set({ sentCount, draftCount, failedCount, skippedCount, currentIndex: i + 1, updatedAt: Date.now() }).where(eq(sendJobs.id, jobId))

    const curStatus: string = state.status
    if (i < pending.length - 1 && curStatus !== 'stopped') {
      await sleep(campaign.throttleMs + Math.random() * campaign.throttleMs * 0.3)
    }
  }

  const finalStatus = signal.aborted ? 'stopped' : 'completed'
  await db.update(sendJobs).set({ status: finalStatus, completedAt: Date.now(), sentCount, draftCount, failedCount, skippedCount, updatedAt: Date.now() }).where(eq(sendJobs.id, jobId))
  await db.update(campaigns).set({ status: finalStatus === 'completed' ? 'completed' : 'paused', updatedAt: Date.now() }).where(eq(campaigns.id, campaign.id))
  if (finalStatus === 'completed') await audit('campaign.completed', { entityType: 'campaign', entityId: campaign.id, details: { jobId, sentCount, failedCount } })
  state.status = 'idle'; state.jobId = null; state.campaignId = null; state.abortController = null
}

async function recordAttempt(recipientId: string, jobId: string, attemptNumber: number, status: string, providerResponse?: unknown, errorMessage?: string) {
  await db.insert(sendAttempts).values({
    id: uuidv4(), recipientId, jobId, attemptNumber, status,
    providerResponse: providerResponse ? JSON.stringify(providerResponse) : null,
    errorMessage: errorMessage ?? null, sentAt: Date.now(),
  })
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }
