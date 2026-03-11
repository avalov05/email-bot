import React, { useState, useEffect } from 'react'
import { Box, Text } from 'ink'
import { c, gradient, progressBar, statusBadge, kbd } from '../theme.js'
import { Frame } from '../components/Frame.js'
import { Spinner } from '../components/Spinner.js'
import { ProgressBar } from '../components/ProgressBar.js'
import { StatusBar } from '../components/StatusBar.js'
import { useInterval } from '../hooks/useInterval.js'
import { useKeymap } from '../hooks/useKeymap.js'
import { db } from '../../lib/db/client.js'
import { campaigns, accounts, sendJobs, recipients } from '../../lib/db/schema.js'
import { desc, count, eq } from 'drizzle-orm'

interface Account { id: string; provider: string; email: string; displayName: string | null; expiresAt: number | null }
interface CampaignRow { id: string; name: string; status: string; sendMode: string; recipientCount: number; latestJob: { sentCount: number; draftCount: number; failedCount: number; totalCount: number; status: string } | null }

interface DashboardProps {
  onNavigate: (screen: string, data?: unknown) => void
}

function formatAge(ts: number | null): string {
  if (!ts) return '—'
  const d = Date.now() - ts
  if (d < 60000) return 'just now'
  if (d < 3600000) return `${Math.floor(d/60000)}m ago`
  if (d < 86400000) return `${Math.floor(d/3600000)}h ago`
  return `${Math.floor(d/86400000)}d ago`
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [accs, setAccs] = useState<Account[]>([])
  const [camps, setCamps] = useState<CampaignRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(0)
  const [tick, setTick] = useState(0)

  useInterval(() => setTick(t => t + 1), 3000)

  async function load() {
    const accRows = await db.select({ id: accounts.id, provider: accounts.provider, email: accounts.email, displayName: accounts.displayName, expiresAt: accounts.expiresAt }).from(accounts).orderBy(accounts.createdAt)
    const campRows = await db.select().from(campaigns).orderBy(desc(campaigns.createdAt)).limit(8)
    const enriched: CampaignRow[] = await Promise.all(campRows.map(async c => {
      const [rc] = await db.select({ count: count() }).from(recipients).where(eq(recipients.campaignId, c.id))
      const latestJob = await db.select().from(sendJobs).where(eq(sendJobs.campaignId, c.id)).orderBy(desc(sendJobs.createdAt)).limit(1).then(r => r[0] || null)
      return { ...c, recipientCount: Number(rc.count), latestJob }
    }))
    setAccs(accRows)
    setCamps(enriched)
    setLoading(false)
  }

  useEffect(() => { load() }, [tick])

  useKeymap({
    up:    () => setSelected(s => Math.max(0, s - 1)),
    down:  () => setSelected(s => Math.min(camps.length - 1, s + 1)),
    enter: () => { if (camps[selected]) onNavigate('campaign', camps[selected].id) },
    '1': () => onNavigate('campaigns'),
    '2': () => onNavigate('connect'),
    '3': () => onNavigate('suppression'),
    '4': () => onNavigate('logs'),
    '5': () => onNavigate('settings'),
    'n': () => onNavigate('new-campaign'),
    h:   () => onNavigate('help'),
    q:   () => process.exit(0),
  })

  const totalSent     = camps.reduce((s, c) => s + (c.latestJob?.sentCount || 0), 0)
  const totalDrafts   = camps.reduce((s, c) => s + (c.latestJob?.draftCount || 0), 0)
  const totalFailed   = camps.reduce((s, c) => s + (c.latestJob?.failedCount || 0), 0)
  const totalR        = camps.reduce((s, c) => s + c.recipientCount, 0)
  const running       = camps.filter(c => c.status === 'running')

  return (
    <Box flexDirection="column" gap={1}>
      {/* Stats row */}
      <Box gap={2} flexWrap="wrap">
        {[
          { label: 'CAMPAIGNS', value: camps.length, color: '#8B5CF6' },
          { label: 'RECIPIENTS', value: totalR, color: '#38BDF8' },
          { label: 'SENT + DRAFTED', value: totalSent + totalDrafts, color: '#22C55E' },
          { label: 'FAILED', value: totalFailed, color: totalFailed > 0 ? '#EF4444' : '#52525B' },
          { label: 'ACCOUNTS', value: accs.length, color: '#A855F7' },
        ].map(s => (
          <Frame key={s.label} dimBorder>
            <Box flexDirection="column" paddingX={1}>
              <Text color="#52525B">{s.label}</Text>
              <Text bold color={s.color}>{loading ? '…' : String(s.value)}</Text>
            </Box>
          </Frame>
        ))}
      </Box>

      {/* Running banner */}
      {running.length > 0 && (
        <Box borderStyle="round" borderColor="#22C55E" paddingX={2} paddingY={0}>
          <Text>{c.success('◉')} <Text bold color="#22C55E">{running.length} campaign{running.length > 1 ? 's' : ''} running</Text> {c.muted('—')} {c.dim('press Enter to open')}</Text>
        </Box>
      )}

      {/* No account warning */}
      {accs.length === 0 && !loading && (
        <Box borderStyle="round" borderColor="#F59E0B" paddingX={2} paddingY={0}>
          <Text>{c.warn('⚠')} {c.warn('No account connected')} {c.muted('—')} {c.dim('press ')} {kbd('2')} {c.dim(' to connect Gmail or Microsoft')}</Text>
        </Box>
      )}

      <Box gap={2}>
        {/* Recent campaigns */}
        <Box flexDirection="column" gap={1} flexGrow={1}>
          <Text>{gradient('  RECENT CAMPAIGNS', ['#8B5CF6','#38BDF8'])}</Text>
          {loading && <Spinner label="Loading campaigns..." />}
          {!loading && camps.length === 0 && (
            <Box borderStyle="round" borderColor="#3F3F46" paddingX={2} paddingY={1}>
              <Text>{c.muted('No campaigns yet.  ')} {kbd('n')} {c.muted(' to create one')}</Text>
            </Box>
          )}
          {camps.map((camp, i) => {
            const job = camp.latestJob
            const done = job ? job.sentCount + job.draftCount + job.failedCount : 0
            const pct  = job && job.totalCount > 0 ? done / job.totalCount : 0
            const isSel = i === selected
            return (
              <Box key={camp.id} flexDirection="column" borderStyle="round"
                borderColor={isSel ? '#8B5CF6' : '#27272A'} paddingX={2} paddingY={0}>
                <Box justifyContent="space-between">
                  <Box gap={2}>
                    <Text>{isSel ? c.violet('▶') : ' '}</Text>
                    <Text bold={isSel} color={isSel ? '#A855F7' : undefined}>{camp.name}</Text>
                    <Text>{statusBadge(camp.status)}</Text>
                    {camp.sendMode === 'send' && <Text>{c.danger('⚡ LIVE')}</Text>}
                    {camp.sendMode === 'dry_run' && <Text>{c.purple('⬡ dry')}</Text>}
                  </Box>
                  <Text>{c.muted(`${camp.recipientCount} recipients`)}</Text>
                </Box>
                {job && job.totalCount > 0 && (
                  <Box gap={2} marginTop={0} paddingLeft={3}>
                    <Text>{progressBar(pct, 20)}</Text>
                    <Text>{c.muted(`${done}/${job.totalCount}`)}</Text>
                    {job.failedCount > 0 && <Text>{c.danger(`${job.failedCount} failed`)}</Text>}
                  </Box>
                )}
              </Box>
            )
          })}
        </Box>

        {/* Connected accounts */}
        <Box flexDirection="column" gap={1} width={36}>
          <Text>{gradient('  ACCOUNTS', ['#8B5CF6','#38BDF8'])}</Text>
          {accs.map(a => {
            const expired = a.expiresAt && a.expiresAt < Date.now()
            return (
              <Box key={a.id} flexDirection="column" borderStyle="round" borderColor={expired ? '#F59E0B' : '#27272A'} paddingX={2} paddingY={0}>
                <Box gap={2}>
                  <Text>{a.provider === 'gmail' ? c.info('G') : c.violet('M')}</Text>
                  <Text bold>{a.displayName || a.email}</Text>
                </Box>
                <Box paddingLeft={4}>
                  <Text>{c.muted(a.email)}</Text>
                </Box>
                {expired && <Box paddingLeft={4}><Text>{c.warn('⚠ token expired')}</Text></Box>}
              </Box>
            )
          })}
          <Box borderStyle="round" borderColor="#27272A" paddingX={2} paddingY={0}>
            <Text>{kbd('2')} {c.muted('connect account')}</Text>
          </Box>
        </Box>
      </Box>

      <StatusBar hints={[
        { key: '↑↓', label: 'navigate' }, { key: 'Enter', label: 'open campaign' },
        { key: 'n', label: 'new campaign' }, { key: '1-5', label: 'quick nav' },
        { key: '?', label: 'help' }, { key: 'q', label: 'quit' },
      ]} extra={`auto-refresh 3s`} />
    </Box>
  )
}
