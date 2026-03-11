import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { c, gradient, statusBadge, progressBar, kbd } from '../theme.js'
import { Spinner } from '../components/Spinner.js'
import { StatusBar } from '../components/StatusBar.js'
import { useKeymap } from '../hooks/useKeymap.js'
import { useInterval } from '../hooks/useInterval.js'
import { db } from '../../lib/db/client.js'
import { campaigns, recipients, sendJobs } from '../../lib/db/schema.js'
import { desc, count, eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { audit } from '../../lib/audit.js'

interface Campaign { id: string; name: string; status: string; sendMode: string; recipientCount: number; createdAt: number; latestJob: { sentCount: number; draftCount: number; failedCount: number; totalCount: number; status: string } | null }

interface Props { onNavigate: (screen: string, data?: unknown) => void }

function age(ts: number) {
  const d = Date.now() - ts
  if (d < 60000) return 'now'
  if (d < 3600000) return `${Math.floor(d/60000)}m`
  if (d < 86400000) return `${Math.floor(d/3600000)}h`
  return `${Math.floor(d/86400000)}d`
}

function pad(s: string, n: number) { return s.length >= n ? s.slice(0,n) : s + ' '.repeat(n - s.length) }

export function Campaigns({ onNavigate }: Props) {
  const [rows, setRows] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(0)
  const [confirm, setConfirm] = useState<{ action: string; id: string; name: string } | null>(null)
  const [msg, setMsg] = useState('')

  async function load() {
    const campRows = await db.select().from(campaigns).orderBy(desc(campaigns.createdAt))
    const enriched = await Promise.all(campRows.map(async c => {
      const [rc] = await db.select({ count: count() }).from(recipients).where(eq(recipients.campaignId, c.id))
      const latestJob = await db.select().from(sendJobs).where(eq(sendJobs.campaignId, c.id)).orderBy(desc(sendJobs.createdAt)).limit(1).then(r => r[0] || null)
      return { ...c, recipientCount: Number(rc.count), latestJob }
    }))
    setRows(enriched); setLoading(false)
  }

  useEffect(() => { load() }, [])

  useInput((input, key) => {
    if (confirm) {
      if (input === 'y' || input === 'Y') { execConfirm(); return }
      if (input === 'n' || input === 'N' || key.escape) { setConfirm(null); return }
    }
  })

  useKeymap(confirm ? {} : {
    up:    () => setSelected(s => Math.max(0, s - 1)),
    down:  () => setSelected(s => Math.min(rows.length - 1, s + 1)),
    enter: () => { if (rows[selected]) onNavigate('campaign', rows[selected].id) },
    n:     () => onNavigate('new-campaign'),
    d:     () => { const r = rows[selected]; if (r) setConfirm({ action: 'delete', id: r.id, name: r.name }) },
    D:     () => { const r = rows[selected]; if (r) setConfirm({ action: 'duplicate', id: r.id, name: r.name }) },
    a:     () => { const r = rows[selected]; if (r) archive(r.id) },
    escape:() => onNavigate('dashboard'),
    q:     () => onNavigate('dashboard'),
    '1':   () => onNavigate('dashboard'),
    '2':   () => onNavigate('connect'),
    '3':   () => onNavigate('suppression'),
    '4':   () => onNavigate('logs'),
    '5':   () => onNavigate('settings'),
  })

  async function execConfirm() {
    if (!confirm) return
    if (confirm.action === 'delete') {
      await db.delete(campaigns).where(eq(campaigns.id, confirm.id))
      await audit('campaign.deleted', { entityType: 'campaign', entityId: confirm.id })
      setMsg(`Deleted "${confirm.name}"`)
    } else if (confirm.action === 'duplicate') {
      const orig = rows.find(r => r.id === confirm.id)
      if (orig) {
        const newId = uuidv4(); const now = Date.now()
        await db.insert(campaigns).values({ ...orig, id: newId, name: `${orig.name} (copy)`, status: 'draft', complianceConfirmed: false, recipientCount: undefined as unknown as number, latestJob: undefined as unknown as null, createdAt: now, updatedAt: now } as unknown as typeof campaigns.$inferInsert)
        await audit('campaign.duplicated', { entityType: 'campaign', entityId: newId })
        setMsg(`Duplicated as "${orig.name} (copy)"`)
      }
    }
    setConfirm(null); await load()
  }

  async function archive(id: string) {
    await db.update(campaigns).set({ status: 'archived', updatedAt: Date.now() }).where(eq(campaigns.id, id))
    await audit('campaign.archived', { entityType: 'campaign', entityId: id })
    setMsg('Archived'); await load()
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Text>{gradient('  CAMPAIGNS', ['#8B5CF6','#38BDF8'])}</Text>

      {confirm && (
        <Box borderStyle="round" borderColor={confirm.action === 'delete' ? '#EF4444' : '#8B5CF6'} paddingX={2} paddingY={1} flexDirection="column" gap={1}>
          <Text bold color={confirm.action === 'delete' ? '#EF4444' : '#A855F7'}>
            {confirm.action === 'delete' ? '⚠  Delete' : '◈  Duplicate'} "{confirm.name}"?
          </Text>
          <Box gap={3}><Text>{kbd('y')} confirm</Text><Text>{kbd('n')} cancel</Text></Box>
        </Box>
      )}

      {msg && <Text>{c.success('✓')} {c.muted(msg)}</Text>}

      {/* Column headers */}
      <Box paddingX={1}>
        <Text>{c.muted(pad('NAME', 32))} {c.muted(pad('STATUS', 14))} {c.muted(pad('RECIPIENTS', 12))} {c.muted(pad('PROGRESS', 24))} {c.muted('AGE')}</Text>
      </Box>
      <Text>{c.muted('─'.repeat(100))}</Text>

      {loading && <Spinner label="Loading..." />}
      {!loading && rows.length === 0 && (
        <Box paddingX={1} paddingY={1}>
          <Text>{c.muted('No campaigns.  ')}{kbd('n')}{c.muted(' to create one')}</Text>
        </Box>
      )}

      {rows.map((row, i) => {
        const job = row.latestJob
        const done = job ? job.sentCount + job.draftCount + job.failedCount : 0
        const pct  = job && job.totalCount > 0 ? done / job.totalCount : 0
        const isSel = i === selected
        return (
          <Box key={row.id} paddingX={1}
            borderStyle={isSel ? 'round' : undefined}
            borderColor={isSel ? '#8B5CF6' : undefined}>
            <Text>
              <Text color={isSel ? '#A855F7' : undefined}>{isSel ? '▶ ' : '  '}</Text>
              <Text bold={isSel} color={isSel ? '#A855F7' : undefined}>{pad(row.name, 30)} </Text>
              <Text>{pad(statusBadge(row.status), 14)} </Text>
              <Text>{c.muted(pad(String(row.recipientCount), 12))} </Text>
              <Text>{job && job.totalCount > 0 ? progressBar(pct, 16) + c.muted(` ${done}/${job.totalCount}`) : c.muted(pad('—', 22))} </Text>
              <Text>{c.muted(age(row.createdAt))}</Text>
            </Text>
          </Box>
        )
      })}

      <StatusBar hints={[
        { key: '↑↓', label: 'select' }, { key: 'Enter', label: 'open' },
        { key: 'n', label: 'new' }, { key: 'D', label: 'duplicate' },
        { key: 'a', label: 'archive' }, { key: 'd', label: 'delete' },
        { key: 'Esc', label: 'back' },
      ]} />
    </Box>
  )
}
