import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { c, gradient, kbd } from '../theme.js'
import { Spinner } from '../components/Spinner.js'
import { StatusBar } from '../components/StatusBar.js'
import { db } from '../../lib/db/client.js'
import { campaigns } from '../../lib/db/schema.js'
import { v4 as uuidv4 } from 'uuid'
import { audit } from '../../lib/audit.js'

interface Props { onNavigate: (screen: string, data?: unknown) => void }

export function NewCampaign({ onNavigate }: Props) {
  const [step, setStep] = useState<'name' | 'mode' | 'creating'>('name')
  const [name, setName] = useState('')
  const [modeIdx, setModeIdx] = useState(0)
  const [error, setError] = useState('')

  const modes = [
    { value: 'draft', icon: '◌', label: 'Draft Mode', desc: 'Create email drafts for review — nothing is sent (recommended)' },
    { value: 'dry_run', icon: '⬡', label: 'Dry Run', desc: 'Simulate without sending anything — great for testing' },
    { value: 'send', icon: '⚡', label: 'Live Send', desc: '⚠ Send emails directly — use only with permission-based lists' },
  ]

  useInput((input, key) => {
    if (step === 'name') {
      if (key.backspace || key.delete) { setName(n => n.slice(0, -1)); return }
      if (key.return) {
        if (!name.trim()) { setError('Name is required'); return }
        setError(''); setStep('mode'); return
      }
      if (key.escape) { onNavigate('campaigns'); return }
      if (!key.ctrl && !key.meta && input) setName(n => n + input)
    }
    if (step === 'mode') {
      if (key.upArrow)   setModeIdx(i => Math.max(0, i - 1))
      if (key.downArrow) setModeIdx(i => Math.min(modes.length - 1, i + 1))
      if (key.return)    createCampaign()
      if (key.escape)    setStep('name')
    }
  })

  async function createCampaign() {
    setStep('creating')
    const id = uuidv4(); const now = Date.now()
    await db.insert(campaigns).values({
      id, name: name.trim(), description: null, status: 'draft',
      sendMode: modes[modeIdx].value, accountId: null,
      subjectTemplate: '', bodyTemplate: '',
      footerText: 'You received this because of an existing relationship or prior permission.', includeFooter: true,
      complianceConfirmed: false, throttleMs: 2000, maxRetries: 3,
      columnMapping: null, createdAt: now, updatedAt: now,
    })
    await audit('campaign.created', { entityType: 'campaign', entityId: id, details: { name } })
    onNavigate('campaign', id)
  }

  return (
    <Box flexDirection="column" gap={2}>
      <Text>{gradient('  NEW CAMPAIGN', ['#8B5CF6','#38BDF8'])}</Text>

      {step === 'name' && (
        <Box flexDirection="column" gap={1}>
          <Text>{c.muted('What should this campaign be called?')}</Text>
          <Box borderStyle="round" borderColor="#8B5CF6" paddingX={2} paddingY={0} gap={1}>
            <Text>{c.violet('▶')}</Text>
            <Text bold color="#FFFFFF">{name || c.dim('Type a name and press Enter…')}</Text>
            <Text>{c.violet('█')}</Text>
          </Box>
          {error && <Text>{c.danger('✗ ' + error)}</Text>}
          <Text>{c.muted('Examples:')} {c.dim('"Spring 2025 Outreach"  ·  "CS Club Recruits"  ·  "Fellowship Applications"')}</Text>
        </Box>
      )}

      {step === 'mode' && (
        <Box flexDirection="column" gap={1}>
          <Text>{c.muted('Choose sending mode:')}</Text>
          {modes.map((m, i) => (
            <Box key={m.value} borderStyle="round" borderColor={i === modeIdx ? (m.value === 'send' ? '#EF4444' : '#8B5CF6') : '#27272A'} paddingX={3} paddingY={1} flexDirection="column">
              <Box gap={2}>
                <Text>{i === modeIdx ? c.violet('▶') : ' '}</Text>
                <Text bold={i === modeIdx} color={i === modeIdx ? (m.value === 'send' ? '#EF4444' : '#A855F7') : undefined}>{m.icon}  {m.label}</Text>
              </Box>
              <Box paddingLeft={4}><Text color="#52525B">{m.desc}</Text></Box>
            </Box>
          ))}
          <Text>{c.muted('You can change the mode later in campaign settings.')}</Text>
        </Box>
      )}

      {step === 'creating' && <Spinner label="Creating campaign..." />}

      <StatusBar hints={step === 'name'
        ? [{ key: 'Enter', label: 'next' }, { key: 'Esc', label: 'cancel' }]
        : [{ key: '↑↓', label: 'select mode' }, { key: 'Enter', label: 'create' }, { key: 'Esc', label: 'back' }]
      } />
    </Box>
  )
}
