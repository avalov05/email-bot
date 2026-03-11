import React, { useState, useEffect } from 'react'
import { Box, Text } from 'ink'
import { c, gradient, kbd } from '../theme.js'
import { Spinner } from '../components/Spinner.js'
import { StatusBar } from '../components/StatusBar.js'
import { useKeymap } from '../hooks/useKeymap.js'
import { useInterval } from '../hooks/useInterval.js'
import { db } from '../../lib/db/client.js'
import { auditLogs } from '../../lib/db/schema.js'
import { desc } from 'drizzle-orm'

interface Props { onNavigate: (s: string, d?: unknown) => void }

const actionColors: Record<string, string> = {
  'campaign.started':   '#22C55E', 'campaign.completed': '#22C55E',
  'campaign.paused':    '#F59E0B', 'campaign.stopped':   '#F59E0B',
  'campaign.created':   '#38BDF8', 'campaign.deleted':   '#EF4444',
  'send.sent':          '#22C55E', 'send.failed':        '#EF4444',
  'send.draft_created': '#06B6D4', 'account.connected':  '#A855F7',
  'account.disconnected':'#EF4444','suppression.added':  '#F59E0B',
  'settings.updated':   '#71717A',
}

function fmt(ts: number) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function AuditLog({ onNavigate }: Props) {
  const [logs, setLogs] = useState<typeof auditLogs.$inferSelect[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const PAGE = 20

  async function load() {
    const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.timestamp)).limit(200)
    setLogs(rows); setLoading(false)
  }

  useEffect(() => { load() }, [])
  useInterval(load, 5000)

  useKeymap({
    escape: () => onNavigate('dashboard'),
    q:      () => onNavigate('dashboard'),
    right:  () => setPage(p => Math.min(p + 1, Math.floor((logs.length - 1) / PAGE))),
    left:   () => setPage(p => Math.max(0, p - 1)),
    r:      () => load(),
    '1':    () => onNavigate('dashboard'),
    '2':    () => onNavigate('connect'),
    '3':    () => onNavigate('suppression'),
    '4':    () => onNavigate('logs'),
    '5':    () => onNavigate('settings'),
  })

  const totalPages = Math.ceil(logs.length / PAGE)
  const visible = logs.slice(page * PAGE, (page + 1) * PAGE)

  return (
    <Box flexDirection="column" gap={1}>
      <Box justifyContent="space-between">
        <Text>{gradient('  AUDIT LOG', ['#8B5CF6','#38BDF8'])}</Text>
        <Text>{c.muted(`${logs.length} entries  ·  page ${page + 1}/${Math.max(1, totalPages)}  ·  auto-refresh 5s`)}</Text>
      </Box>

      <Box paddingX={1}>
        <Text>{c.muted('TIME         ')} {c.muted('ACTION                    ')} {c.muted('ENTITY              ')} {c.muted('DETAILS')}</Text>
      </Box>
      <Text>{c.muted('─'.repeat(90))}</Text>

      {loading && <Spinner label="Loading…" />}

      {visible.map(log => {
        const col = actionColors[log.action] || '#71717A'
        const details = log.details ? JSON.parse(log.details) : {}
        const detailStr = Object.entries(details).map(([k, v]) => `${k}:${v}`).join(' ').slice(0, 35)
        return (
          <Box key={log.id} paddingX={1}>
            <Text>
              <Text color="#52525B">{fmt(log.timestamp) + '  '}</Text>
              <Text color={col}>{(log.action + ' ').padEnd(28)}</Text>
              <Text color="#52525B">{((log.entityType ? `${log.entityType}/${log.entityId?.slice(0,8)}` : '—') + ' ').padEnd(22)}</Text>
              <Text color="#3F3F46">{detailStr}</Text>
            </Text>
          </Box>
        )
      })}

      {!loading && logs.length === 0 && (
        <Box paddingX={1}><Text>{c.muted('No actions logged yet.')}</Text></Box>
      )}

      <StatusBar hints={[
        { key: '←→', label: 'pages' }, { key: 'r', label: 'refresh' }, { key: 'Esc', label: 'back' },
      ]} />
    </Box>
  )
}
