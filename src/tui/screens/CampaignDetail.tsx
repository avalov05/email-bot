import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import { c, gradient, statusBadge, progressBar, kbd } from '../theme.js'
import { Spinner } from '../components/Spinner.js'
import { ProgressBar } from '../components/ProgressBar.js'
import { StatusBar } from '../components/StatusBar.js'
import { Confirm } from '../components/Confirm.js'
import { useKeymap } from '../hooks/useKeymap.js'
import { useInterval } from '../hooks/useInterval.js'
import { db } from '../../lib/db/client.js'
import { campaigns, recipients, sendJobs, accounts } from '../../lib/db/schema.js'
import { eq, count, desc, and } from 'drizzle-orm'
import { getQueueState, startCampaign, pauseQueue, resumeQueue, stopQueue } from '../../lib/queue/engine.js'
import { renderEmail } from '../../lib/templates/engine.js'
import { audit } from '../../lib/audit.js'

type Tab = 'overview' | 'compose' | 'contacts' | 'send' | 'log'

interface Props {
  campaignId: string
  onNavigate: (screen: string, data?: unknown) => void
}

function pad(s: string, n: number) { const str = String(s).slice(0, n); return str + ' '.repeat(n - str.length) }
function age(ts: number | null) {
  if (!ts) return '—'
  const d = Date.now() - ts
  if (d < 60000) return 'just now'
  if (d < 3600000) return `${Math.floor(d/60000)}m ago`
  return `${Math.floor(d/3600000)}h ago`
}

export function CampaignDetail({ campaignId, onNavigate }: Props) {
  const [campaign, setCampaign] = useState<typeof campaigns.$inferSelect | null>(null)
  const [recipientRows, setRecipientRows] = useState<typeof recipients.$inferSelect[]>([])
  const [accountRows, setAccountRows] = useState<typeof accounts.$inferSelect[]>([])
  const [latestJob, setLatestJob] = useState<typeof sendJobs.$inferSelect | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('overview')
  const [queueState, setQueueState] = useState(getQueueState())
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [confirmStop, setConfirmStop] = useState(false)
  const [confirmSend, setConfirmSend] = useState(false)
  const [recipientPage, setRecipientPage] = useState(0)
  const [logPage, setLogPage] = useState(0)
  const [logSelected, setLogSelected] = useState(0)
  const [logDetail, setLogDetail] = useState<typeof recipients.$inferSelect | null>(null)
  const PAGE = 15

  async function load() {
    const camp = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1).then(r => r[0])
    if (!camp) { onNavigate('campaigns'); return }
    const recs = await db.select().from(recipients).where(eq(recipients.campaignId, campaignId)).orderBy(recipients.rowIndex)
    const accs = await db.select().from(accounts).orderBy(accounts.createdAt)
    const job  = await db.select().from(sendJobs).where(eq(sendJobs.campaignId, campaignId)).orderBy(desc(sendJobs.createdAt)).limit(1).then(r => r[0] || null)
    setCampaign(camp); setRecipientRows(recs); setAccountRows(accs); setLatestJob(job)
    setLoading(false)
  }

  useEffect(() => { load() }, [campaignId])
  useInterval(() => { load(); setQueueState(getQueueState()) }, 2000)

  const isMine = queueState.campaignId === campaignId
  const isRunning = isMine && queueState.status === 'running'
  const isPaused  = isMine && queueState.status === 'paused'

  useInput((input, key) => {
    if (confirmStop || confirmSend) return

    // Close log detail overlay first
    if (logDetail) {
      if (key.escape || input === 'q') { setLogDetail(null); return }
      return
    }

    // ← → and Tab / [ ] switch tabs
    const tabList: Tab[] = ['overview','compose','contacts','send','log']
    if (key.rightArrow || key.tab || input === ']') {
      setTab(tabList[(tabList.indexOf(tab) + 1) % tabList.length]); return
    }
    if (key.leftArrow || input === '[') {
      setTab(tabList[(tabList.indexOf(tab) - 1 + tabList.length) % tabList.length]); return
    }

    // s = settings everywhere; stop only when send is actively running/paused
    if (input === 's') {
      if (tab === 'send' && (isRunning || isPaused)) setConfirmStop(true)
      else onNavigate('settings', campaignId)
      return
    }

    // Send tab controls
    if (tab === 'send') {
      if ((input === ' ' || key.return) && !isRunning && !isPaused) setConfirmSend(true)
      if (input === 'p' && isRunning) doPause()
      if (input === 'r' && isPaused)  doResume()
    }

    // Contacts pagination: n = next page, b = back page
    if (tab === 'contacts') {
      if (input === 'n') setRecipientPage(pg => Math.min(totalPages - 1, pg + 1))
      if (input === 'b') setRecipientPage(pg => Math.max(0, pg - 1))
    }

    // Log tab: ↑↓ select, Enter = detail, n/b = page
    if (tab === 'log') {
      if (key.upArrow)   setLogSelected(s => Math.max(0, s - 1))
      if (key.downArrow) setLogSelected(s => Math.min(PAGE - 1, s + 1))
      if (input === 'n') setLogPage(p => { const next = Math.min(logTotalPages - 1, p + 1); setLogSelected(0); return next })
      if (input === 'b') setLogPage(p => { const prev = Math.max(0, p - 1); setLogSelected(0); return prev })
      if (key.return) {
        const rec = logPageRecs[logSelected]
        if (rec) setLogDetail(rec)
      }
    }
  })

  useKeymap({
    escape: () => { if (logDetail) { setLogDetail(null) } else { onNavigate('campaigns') } },
    q:      () => onNavigate('campaigns'),
    i:      () => onNavigate('import', campaignId),
    '1':    () => setTab('overview'),
    '2':    () => setTab('compose'),
    '3':    () => setTab('contacts'),
    '4':    () => setTab('send'),
    '5':    () => setTab('log'),
  })

  async function doStart() {
    if (!campaign) return
    setError(''); setMsg('')
    try {
      await startCampaign(campaignId)
      setMsg(campaign.sendMode === 'draft' ? 'Creating drafts...' : 'Campaign started!')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function doPause() { await pauseQueue(); setMsg('Paused') }
  async function doResume() { await resumeQueue(); setMsg('Resumed') }
  async function doStop() { await stopQueue(); setMsg('Stopped') }

  if (loading || !campaign) {
    return <Box><Spinner label="Loading campaign..." /></Box>
  }

  const pendingCount  = recipientRows.filter(r => r.status === 'pending').length
  const sentCount     = recipientRows.filter(r => r.status === 'sent' || r.status === 'draft_created').length
  const failedCount   = recipientRows.filter(r => r.status === 'failed').length
  const job = latestJob
  const jobDone = job ? job.sentCount + job.draftCount + job.failedCount + job.skippedCount : 0
  const jobPct  = job && job.totalCount > 0 ? jobDone / job.totalCount : 0
  const connAccount = accountRows.find(a => a.id === campaign.accountId)
  const pageRecs = recipientRows.slice(recipientPage * PAGE, (recipientPage + 1) * PAGE)
  const totalPages = Math.ceil(recipientRows.length / PAGE)
  const hasPerRowContent = recipientRows.some(r => r.subjectOverride && r.bodyOverride)

  // Log tab: show all non-pending recipients (sent/draft/failed/suppressed)
  const logRows = recipientRows.filter(r => r.status !== 'pending')
  const logTotalPages = Math.max(1, Math.ceil(logRows.length / PAGE))
  const logPageRecs = logRows.slice(logPage * PAGE, (logPage + 1) * PAGE)

  // Preview (first recipient)
  const previewRec = recipientRows[0]
  let preview = { subject: campaign.subjectTemplate || '(no subject)', body: campaign.bodyTemplate || '(empty)', missingVariables: [] as string[] }
  if (previewRec) {
    const subj = previewRec.subjectOverride || campaign.subjectTemplate
    const body = previewRec.bodyOverride || campaign.bodyTemplate
    if (subj && body) {
      const cf = previewRec.customFields ? JSON.parse(previewRec.customFields) : {}
      const data = { email: previewRec.email, first_name: previewRec.firstName || '', last_name: previewRec.lastName || '', company: previewRec.company || '', ...cf }
      preview = renderEmail(subj, body, data, campaign.includeFooter ? campaign.footerText || '' : undefined)
    }
  }

  const tabs: Tab[] = ['overview', 'compose', 'contacts', 'send', 'log']
  const tabLabels: Record<Tab, string> = { overview: '1 Overview', compose: '2 Compose', contacts: '3 Contacts', send: '4 Send', log: `5 Log${logRows.length > 0 ? ` (${logRows.length})` : ''}` }

  return (
    <Box flexDirection="column" gap={1}>
      {/* Title */}
      <Box justifyContent="space-between" alignItems="center">
        <Box gap={2} alignItems="center">
          <Text>{c.muted('Campaigns')}{c.muted(' / ')}</Text>
          <Text bold color="#A855F7">{campaign.name}</Text>
          <Text>{statusBadge(campaign.status)}</Text>
          {campaign.sendMode === 'send' && <Text>{c.danger('⚡ LIVE SEND')}</Text>}
          {campaign.sendMode === 'dry_run' && <Text>{c.purple('⬡ DRY RUN')}</Text>}
          {campaign.sendMode === 'draft' && <Text>{c.cyan('◌ DRAFT MODE')}</Text>}
        </Box>
        {connAccount && <Text>{c.muted('from:')} {c.bright(connAccount.email)}</Text>}
      </Box>

      {/* Tab bar */}
      <Box gap={1}>
        {tabs.map(t => (
          <Text key={t}>
            {tab === t
              ? <Text bold color="#8B5CF6">{`[ ${tabLabels[t]} ]`}</Text>
              : <Text color="#52525B">{`  ${tabLabels[t]}  `}</Text>}
          </Text>
        ))}
      </Box>
      <Text>{c.muted('─'.repeat(70))}</Text>

      {msg && <Text>{c.success('✓')} {c.muted(msg)}</Text>}
      {error && <Text>{c.danger('✗')} {c.danger(error)}</Text>}

      {/* Live job progress */}
      {isMine && job && (
        <Box borderStyle="round" borderColor={isRunning ? '#22C55E' : '#F59E0B'} paddingX={2} paddingY={0} flexDirection="column" gap={0}>
          <Box justifyContent="space-between">
            <Box gap={2}>
              <Text color={isRunning ? '#22C55E' : '#F59E0B'}>{isRunning ? '◉ Running' : '◐ Paused'}</Text>
              <Text>{c.muted(`${jobDone}/${job.totalCount}`)}</Text>
            </Box>
            <Box gap={2}>
              {isRunning && <Text>{kbd('p')} {c.muted('pause')}</Text>}
              {isPaused  && <Text>{kbd('r')} {c.muted('resume')}</Text>}
              <Text>{kbd('s')} {c.muted('stop')}</Text>
            </Box>
          </Box>
          <Text>{progressBar(jobPct, 40)} {c.muted(`${Math.round(jobPct * 100)}%`)}</Text>
          <Box gap={3}>
            <Text>{c.success(`✓ ${job.sentCount + job.draftCount}`)}</Text>
            <Text>{c.danger(`✗ ${job.failedCount}`)}</Text>
            <Text>{c.muted(`⊘ ${job.skippedCount} skipped`)}</Text>
          </Box>
        </Box>
      )}

      {/* ─── OVERVIEW ─── */}
      {tab === 'overview' && (
        <Box flexDirection="column" gap={1}>
          <Box gap={4} flexWrap="wrap">
            {[
              { l: 'Total',   v: recipientRows.length, col: '#A855F7' },
              { l: 'Pending', v: pendingCount,           col: '#71717A' },
              { l: 'Done',    v: sentCount,              col: '#22C55E' },
              { l: 'Failed',  v: failedCount,            col: failedCount > 0 ? '#EF4444' : '#52525B' },
            ].map(s => (
              <Box key={s.l} borderStyle="round" borderColor="#27272A" paddingX={3} paddingY={0} flexDirection="column">
                <Text color="#52525B">{s.l.toUpperCase()}</Text>
                <Text bold color={s.col}>{s.v}</Text>
              </Box>
            ))}
          </Box>
          {job && (
            <Box flexDirection="column" borderStyle="round" borderColor="#27272A" paddingX={2} paddingY={1} gap={0}>
              <Text>{c.muted('LAST RUN')} {c.dim(`· ${age(job.startedAt)}`)}</Text>
              <Box gap={2} marginTop={1}>
                <Text>{c.muted('Status:')} {statusBadge(job.status)}</Text>
                <Text>{c.muted('Sent+Drafted:')} {c.success(String(job.sentCount + job.draftCount))}</Text>
                <Text>{c.muted('Failed:')} {c.danger(String(job.failedCount))}</Text>
              </Box>
              {job.totalCount > 0 && <Box marginTop={1}><Text>{progressBar(jobPct, 30)}</Text></Box>}
            </Box>
          )}
          {!job && <Text>{c.muted('No runs yet.')}</Text>}
          {/* Quick-action hints */}
          <Box gap={3} marginTop={1}>
            <Text>{kbd('i')} {c.muted('import contacts')} {recipientRows.length === 0 ? c.warn('← start here') : c.dim(`(${recipientRows.length} loaded)`)}</Text>
            <Text>{kbd('s')} {c.muted('settings')}</Text>
            <Text>{kbd('4')} {c.muted('send tab')}</Text>
          </Box>
        </Box>
      )}

      {/* ─── COMPOSE ─── */}
      {tab === 'compose' && (
        <Box gap={3}>
          <Box flexDirection="column" gap={1} flexGrow={1}>
            {hasPerRowContent && (
              <Box borderStyle="round" borderColor="#22C55E" paddingX={2} paddingY={0}>
                <Text color="#22C55E">✓ Per-row mode: each contact has its own Subject + Body from the imported file</Text>
              </Box>
            )}
            <Text>{c.muted('SUBJECT:')}</Text>
            <Box borderStyle="round" borderColor="#3F3F46" paddingX={2} paddingY={0}>
              <Text>{campaign.subjectTemplate || (hasPerRowContent ? c.dim('(per-row — see preview →)') : c.dim('(not set — edit in Settings)'))}</Text>
            </Box>
            <Text>{c.muted('BODY:')}</Text>
            <Box borderStyle="round" borderColor="#3F3F46" paddingX={2} paddingY={1}>
              <Text>{campaign.bodyTemplate ? campaign.bodyTemplate.slice(0, 400) + (campaign.bodyTemplate.length > 400 ? '…' : '') : (hasPerRowContent ? c.dim('(per-row — see preview →)') : c.dim('(not set)'))}</Text>
            </Box>
            {campaign.includeFooter && campaign.footerText && (
              <>
                <Text>{c.muted('FOOTER:')}</Text>
                <Box borderStyle="round" borderColor="#27272A" paddingX={2} paddingY={0}>
                  <Text color="#52525B">{campaign.footerText.slice(0, 120)}</Text>
                </Box>
              </>
            )}
          </Box>
          <Box flexDirection="column" gap={1} width={36}>
            <Text>{c.muted('PREVIEW')} {previewRec ? c.dim(`(${previewRec.email})`) : c.dim('(no contacts yet)')}</Text>
            <Box borderStyle="round" borderColor="#6366F1" paddingX={2} paddingY={1} flexDirection="column" gap={0}>
              <Text>{c.cyan('Sub:')} {preview.subject.slice(0, 32)}</Text>
              <Text>{c.muted('─'.repeat(34))}</Text>
              <Text>{preview.body.slice(0, 200)}{preview.body.length > 200 ? '…' : ''}</Text>
              {preview.missingVariables.length > 0 && (
                <Text>{c.warn('⚠ missing:')} {c.warn(preview.missingVariables.join(', '))}</Text>
              )}
            </Box>
            <Text>{c.muted('Edit templates:')}</Text>
            <Text>{kbd('e')} {c.muted('open in $EDITOR (coming soon)')}</Text>
          </Box>
        </Box>
      )}

      {/* ─── CONTACTS ─── */}
      {tab === 'contacts' && (
        <Box flexDirection="column" gap={1}>
          <Box justifyContent="space-between">
            <Text>{c.muted('CONTACTS')} {c.dim(`· ${recipientRows.length} total`)}</Text>
            <Text>{c.muted(`Page ${recipientPage + 1}/${Math.max(1, totalPages)}`)}</Text>
          </Box>
          <Box paddingX={1}>
            <Text>{c.muted(pad('EMAIL', 34))} {c.muted(pad('NAME', 20))} {c.muted(pad('COMPANY', 18))} {c.muted('STATUS')}</Text>
          </Box>
          <Text>{c.muted('─'.repeat(90))}</Text>
          {pageRecs.map((r, i) => (
            <Box key={r.id} paddingX={1}>
              <Text>
                {pad(r.email, 34)} {pad([r.firstName, r.lastName].filter(Boolean).join(' ') || '—', 20)} {pad(r.company || '—', 18)} {statusBadge(r.status)}
                {r.error ? c.danger(` ✗ ${r.error.slice(0,30)}`) : ''}
              </Text>
            </Box>
          ))}
          {recipientRows.length === 0 && <Text>{c.muted('  No contacts yet.  Press ')}{kbd('i')}{c.muted(' to import a CSV/XLSX.')}</Text>}
          {recipientRows.length > 0 && hasPerRowContent && <Text>{c.dim('  ✓ Per-row Subject/Body detected')}</Text>}
          {totalPages > 1 && (
            <Box gap={3} marginTop={1}>
              {recipientPage > 0 && <Text>{kbd('b')} {c.muted('prev page')}</Text>}
              {recipientPage < totalPages - 1 && <Text>{kbd('n')} {c.muted('next page')}</Text>}
            </Box>
          )}
        </Box>
      )}

      {/* ─── SEND ─── */}
      {tab === 'send' && (
        <Box flexDirection="column" gap={1}>
          {confirmStop && <Confirm message="Stop the running campaign?" danger onYes={() => { doStop(); setConfirmStop(false) }} onNo={() => setConfirmStop(false)} />}
          {confirmSend && (
            <Confirm
              message={campaign.sendMode === 'send' ? `⚡ SEND to ${pendingCount} recipients. This is real.` : campaign.sendMode === 'dry_run' ? `Dry-run for ${pendingCount} recipients` : `Create ${pendingCount} drafts`}
              detail={campaign.sendMode === 'send' ? 'Emails will be sent immediately and cannot be recalled.' : undefined}
              danger={campaign.sendMode === 'send'}
              onYes={() => { doStart(); setConfirmSend(false) }}
              onNo={() => setConfirmSend(false)}
            />
          )}

          {/* Checklist */}
          <Box flexDirection="column" gap={0} borderStyle="round" borderColor="#27272A" paddingX={2} paddingY={1}>
            <Text>{c.muted('READINESS CHECK')}</Text>
            <Box marginTop={1} flexDirection="column" gap={0}>
              {[
                { ok: !!campaign.accountId, label: 'Account connected' },
                { ok: !!campaign.subjectTemplate || hasPerRowContent, label: hasPerRowContent ? 'Subject set (per-row)' : 'Subject set' },
                { ok: !!campaign.bodyTemplate || hasPerRowContent, label: hasPerRowContent ? 'Body set (per-row)' : 'Body set' },
                { ok: pendingCount > 0, label: `Contacts ready (${pendingCount} pending)` },
                { ok: campaign.complianceConfirmed, label: 'Compliance confirmed' },
              ].map(({ ok, label }) => (
                <Text key={label}>{ok ? c.success('✓') : c.danger('✗')} {ok ? label : c.danger(label)}</Text>
              ))}
            </Box>
          </Box>

          {/* Mode */}
          <Box gap={3}>
            {[
              { value: 'draft', icon: '◌', label: 'Draft Mode', desc: 'Creates drafts only (safest)' },
              { value: 'dry_run', icon: '⬡', label: 'Dry Run', desc: 'Simulates, nothing sent' },
              { value: 'send', icon: '⚡', label: 'Live Send', desc: '⚠ Sends real emails' },
            ].map(m => (
              <Box key={m.value} borderStyle="round" borderColor={campaign.sendMode === m.value ? (m.value === 'send' ? '#EF4444' : '#8B5CF6') : '#27272A'} paddingX={2} paddingY={0} flexDirection="column">
                <Text bold={campaign.sendMode === m.value} color={campaign.sendMode === m.value ? (m.value === 'send' ? '#EF4444' : '#A855F7') : '#52525B'}>{m.icon} {m.label}</Text>
                <Text color="#52525B">{m.desc}</Text>
              </Box>
            ))}
          </Box>
          <Text>{c.muted('Change mode via Settings (')}{kbd('s')}{c.muted(')')}</Text>

          {/* Action */}
          {!isRunning && !isPaused && (
            <Box marginTop={1}>
              <Text>{kbd('Space / Enter')} {c.violet('▶ ')}
                {campaign.sendMode === 'draft' ? c.cyan('Create Drafts') : campaign.sendMode === 'dry_run' ? c.purple('Start Dry Run') : c.danger('Send Campaign')}
                {c.muted(` · ${pendingCount} pending`)}
              </Text>
            </Box>
          )}
          {isRunning && (
            <Box gap={3} marginTop={1}>
              <Text>{kbd('p')} {c.warn('Pause')}</Text>
              <Text>{kbd('s')} {c.danger('Stop')}</Text>
            </Box>
          )}
          {isPaused && (
            <Box gap={3} marginTop={1}>
              <Text>{kbd('r')} {c.success('Resume')}</Text>
              <Text>{kbd('s')} {c.danger('Stop')}</Text>
            </Box>
          )}
        </Box>
      )}

      {/* ─── LOG ─── */}
      {tab === 'log' && !logDetail && (
        <Box flexDirection="column" gap={1}>
          <Box justifyContent="space-between">
            <Text>{c.muted('SEND LOG')} {c.dim(`· ${logRows.length} processed`)}</Text>
            {logTotalPages > 1 && <Text>{c.muted(`page ${logPage + 1}/${logTotalPages}`)}</Text>}
          </Box>
          {logRows.length === 0 ? (
            <Box paddingX={1} paddingY={1}>
              <Text>{c.muted('No emails processed yet. Run the campaign to see results here.')}</Text>
            </Box>
          ) : (
            <>
              <Box paddingX={1}>
                <Text>
                  {c.muted(pad('EMAIL', 34))}
                  {c.muted(pad('STATUS', 16))}
                  {c.muted(pad('SUBJECT', 38))}
                  {c.muted('SENT')}
                </Text>
              </Box>
              <Text>{c.muted('─'.repeat(100))}</Text>
              {logPageRecs.map((r, i) => {
                const isSelected = i === logSelected
                const sentTime = r.sentAt ? new Date(r.sentAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
                return (
                  <Box key={r.id} paddingX={1} borderStyle={isSelected ? 'round' : undefined} borderColor={isSelected ? '#8B5CF6' : undefined}>
                    <Text>
                      <Text color={isSelected ? '#A855F7' : undefined}>{isSelected ? '▶ ' : '  '}</Text>
                      <Text color={isSelected ? '#A855F7' : undefined}>{pad(r.email, 32)}</Text>
                      <Text> </Text>
                      <Text>{statusBadge(r.status)}</Text>
                      <Text>{' '.repeat(Math.max(0, 14 - r.status.length))}</Text>
                      <Text color={r.sentSubject ? '#E4E4E7' : '#52525B'}>{pad(r.sentSubject || '(not recorded)', 38)}</Text>
                      <Text color="#52525B">{sentTime}</Text>
                    </Text>
                  </Box>
                )
              })}
            </>
          )}
          {logTotalPages > 1 && (
            <Box gap={3} marginTop={1}>
              {logPage > 0 && <Text>{kbd('b')} {c.muted('prev page')}</Text>}
              {logPage < logTotalPages - 1 && <Text>{kbd('n')} {c.muted('next page')}</Text>}
            </Box>
          )}
        </Box>
      )}

      {/* Log detail overlay */}
      {tab === 'log' && logDetail && (
        <Box flexDirection="column" gap={1} borderStyle="round" borderColor="#8B5CF6" paddingX={2} paddingY={1}>
          <Box justifyContent="space-between">
            <Text>{c.violet('EMAIL DETAIL')} {c.dim(`· ${logDetail.email}`)}</Text>
            <Text>{statusBadge(logDetail.status)}</Text>
          </Box>
          <Text>{c.muted('─'.repeat(70))}</Text>
          <Box gap={2}>
            <Text>{c.muted('To:')}</Text>
            <Text color="#E4E4E7">{logDetail.email}</Text>
          </Box>
          {logDetail.sentAt && (
            <Box gap={2}>
              <Text>{c.muted('Sent:')}</Text>
              <Text color="#E4E4E7">{new Date(logDetail.sentAt).toLocaleString()}</Text>
            </Box>
          )}
          <Box gap={2}>
            <Text>{c.muted('Subject:')}</Text>
            <Text bold color={logDetail.sentSubject ? '#FFFFFF' : '#52525B'}>
              {logDetail.sentSubject || '(not recorded — run campaign again to capture)'}
            </Text>
          </Box>
          <Text>{c.muted('─'.repeat(70))}</Text>
          <Text>{c.muted('Body:')}</Text>
          <Box borderStyle="round" borderColor="#3F3F46" paddingX={2} paddingY={1}>
            <Text color={logDetail.sentBody ? '#E4E4E7' : '#52525B'} wrap="wrap">
              {logDetail.sentBody || '(not recorded — run campaign again to capture)'}
            </Text>
          </Box>
          {logDetail.error && (
            <Text>{c.danger('Error: ')} {c.danger(logDetail.error)}</Text>
          )}
          <Text>{kbd('Esc')} {c.muted('close')}</Text>
        </Box>
      )}

      <StatusBar hints={[
        { key: '← →', label: 'switch tab' },
        ...(tab !== 'log' ? [{ key: 'i', label: 'import' }] : []),
        ...(tab !== 'log' ? [{ key: 's', label: tab === 'send' && (isRunning || isPaused) ? 'stop' : 'settings' }] : []),
        ...(tab === 'send' && !isRunning && !isPaused ? [{ key: 'Space', label: 'start' }] : []),
        ...(tab === 'send' && isRunning ? [{ key: 'p', label: 'pause' }] : []),
        ...(tab === 'send' && isPaused  ? [{ key: 'r', label: 'resume' }] : []),
        ...(tab === 'log' && !logDetail ? [{ key: '↑↓', label: 'select' }, { key: 'Enter', label: 'view email' }] : []),
        ...(tab === 'log' && logDetail ? [{ key: 'Esc', label: 'close' }] : []),
        ...(!logDetail ? [{ key: 'Esc', label: 'campaigns' }] : []),
      ]} />
    </Box>
  )
}
