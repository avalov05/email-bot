import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { c, gradient, kbd } from '../theme.js'
import { Spinner } from '../components/Spinner.js'
import { StatusBar } from '../components/StatusBar.js'
import { db } from '../../lib/db/client.js'
import { campaigns, accounts, settings as settingsTable } from '../../lib/db/schema.js'
import { eq } from 'drizzle-orm'
import { audit } from '../../lib/audit.js'
import { renderEmail, validateTemplate } from '../../lib/templates/engine.js'

interface Props { campaignId?: string; onNavigate: (screen: string, data?: unknown) => void }

type EditField = 'name' | 'subject' | 'body' | 'footer' | 'throttle' | 'mode' | null

export function Settings({ campaignId, onNavigate }: Props) {
  const [camp, setCamp] = useState<typeof campaigns.$inferSelect | null>(null)
  const [accs, setAccs] = useState<typeof accounts.$inferSelect[]>([])
  const [loading, setLoading] = useState(!!campaignId)
  const [editField, setEditField] = useState<EditField>(null)
  const [editValue, setEditValue] = useState('')
  const [selectedRow, setSelectedRow] = useState(0)
  const [showAccPicker, setShowAccPicker] = useState(false)
  const [accPickerIdx, setAccPickerIdx] = useState(0)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  async function load() {
    const acRows = await db.select().from(accounts).orderBy(accounts.createdAt)
    setAccs(acRows)
    if (!campaignId) { setLoading(false); return }
    const c = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1).then(r => r[0])
    setCamp(c || null); setLoading(false)
  }

  useEffect(() => { load() }, [campaignId])

  const connAcc = accs.find(a => a.id === camp?.accountId)

  const rows = camp ? [
    { key: 'account',   label: 'Sending Account',  value: connAcc ? `${connAcc.email}` : '(not set — required)', hint: 'Gmail/Outlook account' },
    { key: 'name',      label: 'Campaign Name',    value: camp.name, hint: 'Display name' },
    { key: 'subject',   label: 'Subject Template',  value: camp.subjectTemplate || '(not set)', hint: 'Use {{first_name}} etc.' },
    { key: 'body',      label: 'Body Template',     value: (camp.bodyTemplate || '(not set)').slice(0, 60) + '…', hint: 'Personalization vars supported' },
    { key: 'footer',    label: 'Footer Text',       value: camp.footerText?.slice(0, 50) + '…' || '(not set)', hint: 'Opt-out / disclaimer' },
    { key: 'throttle',  label: 'Throttle (ms)',     value: String(camp.throttleMs), hint: 'Delay between emails' },
    { key: 'mode',      label: 'Sending Mode',      value: camp.sendMode, hint: 'draft / dry_run / send' },
    { key: 'compliance',label: 'Compliance',        value: camp.complianceConfirmed ? '✓ confirmed' : '✗ not confirmed', hint: 'Required to run campaign' },
  ] : []

  useInput((input, key) => {
    // Account picker mode
    if (showAccPicker) {
      if (key.upArrow)   { setAccPickerIdx(i => Math.max(0, i - 1)); return }
      if (key.downArrow) { setAccPickerIdx(i => Math.min(accs.length - 1, i + 1)); return }
      if (key.return) {
        const acc = accs[accPickerIdx]
        if (acc && camp) {
          db.update(campaigns).set({ accountId: acc.id, updatedAt: Date.now() }).where(eq(campaigns.id, camp.id))
            .then(() => audit('campaign.updated', { entityType: 'campaign', entityId: camp.id, details: { field: 'account' } }))
            .then(() => load())
            .then(() => { setMsg(`Account set: ${acc.email}`); setShowAccPicker(false) })
            .catch(e => setError(e instanceof Error ? e.message : String(e)))
        }
        return
      }
      if (key.escape) { setShowAccPicker(false); return }
      return
    }

    if (editField !== null) {
      if (key.backspace || key.delete) { setEditValue(v => v.slice(0, -1)); return }
      if (key.return) { saveField(editField, editValue); return }
      if (key.escape) { setEditField(null); return }
      if (!key.ctrl && !key.meta && input) setEditValue(v => v + input)
      return
    }
    if (key.upArrow)   setSelectedRow(s => Math.max(0, s - 1))
    if (key.downArrow) setSelectedRow(s => Math.min(rows.length - 1, s + 1))
    if (key.return || input === 'e') {
      const row = rows[selectedRow]
      if (!row) return
      if (row.key === 'compliance') {
        toggleCompliance(); return
      }
      if (row.key === 'account') {
        if (accs.length === 0) { setError('No accounts connected. Press 2 to connect one.'); return }
        const curIdx = accs.findIndex(a => a.id === camp?.accountId)
        setAccPickerIdx(curIdx >= 0 ? curIdx : 0)
        setShowAccPicker(true); setMsg(''); setError('')
        return
      }
      const fullValue = row.key === 'subject' ? (camp?.subjectTemplate || '')
        : row.key === 'body' ? (camp?.bodyTemplate || '')
        : row.key === 'footer' ? (camp?.footerText || '')
        : row.key === 'name' ? (camp?.name || '')
        : row.key === 'throttle' ? String(camp?.throttleMs || 2000)
        : row.key === 'mode' ? (camp?.sendMode || 'draft')
        : ''
      setEditField(row.key as EditField)
      setEditValue(fullValue)
      setMsg(''); setError('')
    }
    if (input === '1') { onNavigate('dashboard'); return }
    if (input === '2') { onNavigate('connect'); return }
    if (input === '3') { onNavigate('suppression'); return }
    if (input === '4') { onNavigate('logs'); return }
    if (input === '5') { onNavigate('settings'); return }
    if (key.escape || input === 'q') onNavigate(campaignId ? 'campaign' : 'dashboard', campaignId)
  })

  async function toggleCompliance() {
    if (!camp) return
    const next = !camp.complianceConfirmed
    if (next && !camp.complianceConfirmed) {
      await db.update(campaigns).set({ complianceConfirmed: true, updatedAt: Date.now() }).where(eq(campaigns.id, camp.id))
      setMsg('Compliance confirmed ✓')
    } else {
      await db.update(campaigns).set({ complianceConfirmed: false, updatedAt: Date.now() }).where(eq(campaigns.id, camp.id))
      setMsg('Compliance unset')
    }
    await load()
  }

  async function saveField(field: EditField, value: string) {
    if (!camp || !field) return
    let updates: Partial<typeof campaigns.$inferSelect> = { updatedAt: Date.now() }
    if (field === 'name') updates.name = value
    else if (field === 'subject') updates.subjectTemplate = value
    else if (field === 'body') updates.bodyTemplate = value
    else if (field === 'footer') updates.footerText = value
    else if (field === 'throttle') { const n = parseInt(value); if (isNaN(n) || n < 100) { setError('Throttle must be ≥ 100ms'); return }; updates.throttleMs = n }
    else if (field === 'mode') {
      if (!['draft','dry_run','send'].includes(value)) { setError('Mode must be: draft, dry_run, or send'); return }
      updates.sendMode = value
    }
    await db.update(campaigns).set(updates).where(eq(campaigns.id, camp.id))
    await audit('campaign.updated', { entityType: 'campaign', entityId: camp.id, details: { field } })
    setMsg(`Saved: ${field}`)
    setEditField(null)
    await load()
  }

  if (loading) return <Spinner label="Loading settings…" />

  return (
    <Box flexDirection="column" gap={1}>
      <Text>{gradient(campaignId ? '  CAMPAIGN SETTINGS' : '  APP SETTINGS', ['#8B5CF6','#38BDF8'])}</Text>

      {msg && <Text>{c.success('✓ ' + msg)}</Text>}
      {error && <Text>{c.danger('✗ ' + error)}</Text>}

      {/* Account picker */}
      {showAccPicker && (
        <Box flexDirection="column" gap={1} borderStyle="round" borderColor="#8B5CF6" paddingX={2} paddingY={1}>
          <Text>{c.violet('SELECT ACCOUNT')} {c.muted(`(${accs.length} connected)`)}</Text>
          {accs.map((acc, i) => (
            <Box key={acc.id} paddingX={1} borderStyle={i === accPickerIdx ? 'round' : undefined} borderColor={i === accPickerIdx ? '#8B5CF6' : undefined}>
              <Text>
                <Text color={i === accPickerIdx ? '#A855F7' : undefined}>{i === accPickerIdx ? '▶ ' : '  '}</Text>
                <Text bold={i === accPickerIdx} color={i === accPickerIdx ? '#A855F7' : undefined}>{acc.email}</Text>
                <Text color="#52525B"> — {acc.provider}</Text>
                {acc.id === camp?.accountId && <Text color="#22C55E"> ✓ current</Text>}
              </Text>
            </Box>
          ))}
          <Box gap={3}><Text>{kbd('Enter')} {c.success('select')}</Text><Text>{kbd('Esc')} {c.muted('cancel')}</Text></Box>
        </Box>
      )}

      {editField && (
        <Box flexDirection="column" gap={1} borderStyle="round" borderColor="#8B5CF6" paddingX={2} paddingY={1}>
          <Text>{c.violet('EDITING:')} {c.bright(editField)}</Text>
          {(editField === 'body' || editField === 'footer') && (
            <Text>{c.muted('(multi-line: \\n for newline)')}</Text>
          )}
          <Box borderStyle="round" borderColor="#3F3F46" paddingX={2} paddingY={0} gap={1}>
            <Text bold color="#FFFFFF">{editValue.replace(/\\n/g, '\n').slice(0, 200)}</Text>
            <Text>{c.violet('█')}</Text>
          </Box>
          <Box gap={3}><Text>{kbd('Enter')} {c.success('save')}</Text><Text>{kbd('Esc')} {c.muted('cancel')}</Text></Box>
        </Box>
      )}

      {!editField && !showAccPicker && camp && (
        <Box flexDirection="column" gap={0}>
          <Box paddingX={1}>
            <Text>{c.muted('FIELD             ')} {c.muted('VALUE                                 ')} {c.muted('HINT')}</Text>
          </Box>
          <Text>{c.muted('─'.repeat(80))}</Text>
          {rows.map((row, i) => (
            <Box key={row.key} paddingX={1} borderStyle={i === selectedRow ? 'round' : undefined} borderColor={i === selectedRow ? '#8B5CF6' : undefined}>
              <Text>
                <Text color={i === selectedRow ? '#A855F7' : undefined}>{i === selectedRow ? '▶ ' : '  '}</Text>
                <Text bold={i === selectedRow} color={i === selectedRow ? '#A855F7' : undefined}>{(row.label + ' ').padEnd(18)}</Text>
                <Text color={
                  row.value.startsWith('(not set') ? '#EF4444'
                  : row.key === 'compliance' && row.value.startsWith('✗') ? '#EF4444'
                  : row.key === 'compliance' ? '#22C55E'
                  : row.key === 'mode' && row.value === 'send' ? '#EF4444'
                  : row.key === 'account' && connAcc ? '#22C55E'
                  : undefined
                }>{row.value.padEnd(40)}</Text>
                <Text color="#52525B">{row.hint}</Text>
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {!camp && !campaignId && (
        <Box borderStyle="round" borderColor="#27272A" paddingX={3} paddingY={2}>
          <Text>{c.muted('No campaign selected. Open a campaign to edit its settings.')}</Text>
        </Box>
      )}

      <StatusBar hints={[
        { key: '↑↓', label: 'select field' }, { key: 'Enter / e', label: 'edit' },
        { key: 'Esc', label: 'back' },
      ]} />
    </Box>
  )
}
