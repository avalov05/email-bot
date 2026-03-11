import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { c, gradient, kbd } from '../theme.js'
import { Spinner } from '../components/Spinner.js'
import { StatusBar } from '../components/StatusBar.js'
import { db } from '../../lib/db/client.js'
import { suppressionList } from '../../lib/db/schema.js'
import { addToSuppressionList, removeFromSuppressionList, getSuppressionList } from '../../lib/suppression.js'
import { audit } from '../../lib/audit.js'

interface Props { onNavigate: (s: string, d?: unknown) => void }

type Step = 'list' | 'add-email' | 'add-reason'

function fmt(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function Suppression({ onNavigate }: Props) {
  const [list, setList] = useState<typeof suppressionList.$inferSelect[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(0)
  const [step, setStep] = useState<Step>('list')
  const [email, setEmail] = useState('')
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  async function load() { setList(await getSuppressionList()); setLoading(false) }
  useEffect(() => { load() }, [])

  useInput((input, key) => {
    if (step === 'list') {
      if (key.upArrow)   setSelected(s => Math.max(0, s - 1))
      if (key.downArrow) setSelected(s => Math.min(list.length - 1, s + 1))
      if (input === 'a' || input === 'A') { setStep('add-email'); setEmail(''); setReason(''); setError('') }
      if (input === '1') { onNavigate('dashboard'); return }
      if (input === '2') { onNavigate('connect'); return }
      if (input === '4') { onNavigate('logs'); return }
      if (input === '5') { onNavigate('settings'); return }
      if (input === 'd' && list.length > 0) {
        const entry = list[selected]
        removeFromSuppressionList(entry.email)
          .then(() => audit('suppression.removed', { details: { email: entry.email } }))
          .then(() => load())
          .then(() => { setMsg(`Removed: ${entry.email}`); setSelected(s => Math.min(s, list.length - 2)) })
          .catch(e => setError(e instanceof Error ? e.message : String(e)))
      }
      if (key.escape || input === 'q') onNavigate('dashboard')
    }
    if (step === 'add-email') {
      if (key.backspace || key.delete) { setEmail(e => e.slice(0, -1)); return }
      if (key.return) {
        if (!email.includes('@')) { setError('Invalid email'); return }
        setError(''); setStep('add-reason'); return
      }
      if (key.escape) { setStep('list'); return }
      if (!key.ctrl && !key.meta && input) setEmail(e => e + input)
    }
    if (step === 'add-reason') {
      if (key.backspace || key.delete) { setReason(r => r.slice(0, -1)); return }
      if (key.return) {
        addToSuppressionList(email, reason || 'manual')
          .then(() => audit('suppression.added', { details: { email, reason } }))
          .then(() => load())
          .then(() => { setMsg(`Suppressed: ${email}`); setStep('list') })
          .catch(e => setError(e instanceof Error ? e.message : String(e)))
        return
      }
      if (key.escape) { setStep('add-email'); return }
      if (!key.ctrl && !key.meta && input) setReason(r => r + input)
    }
  })

  return (
    <Box flexDirection="column" gap={1}>
      <Text>{gradient('  SUPPRESSION LIST', ['#8B5CF6','#38BDF8'])}</Text>
      <Text>{c.muted('Addresses here will never receive outreach from any campaign.')}</Text>

      {msg && <Text>{c.success('✓ ' + msg)}</Text>}
      {error && <Text>{c.danger('✗ ' + error)}</Text>}

      {step === 'add-email' && (
        <Box flexDirection="column" gap={1} borderStyle="round" borderColor="#8B5CF6" paddingX={2} paddingY={1}>
          <Text>{c.violet('ADD EMAIL  step 1/2')}</Text>
          <Box gap={1}>
            <Text>{c.muted('Email:')}</Text>
            <Text bold color="#FFFFFF">{email}{c.violet('█')}</Text>
          </Box>
          <Box gap={3}><Text>{kbd('Enter')} next</Text><Text>{kbd('Esc')} cancel</Text></Box>
        </Box>
      )}

      {step === 'add-reason' && (
        <Box flexDirection="column" gap={1} borderStyle="round" borderColor="#8B5CF6" paddingX={2} paddingY={1}>
          <Text>{c.violet('ADD EMAIL  step 2/2')}</Text>
          <Text>{c.muted('Email:')} {c.bright(email)}</Text>
          <Box gap={1}>
            <Text>{c.muted('Reason:')}</Text>
            <Text bold color="#FFFFFF">{reason || c.dim('manual')}{c.violet('█')}</Text>
          </Box>
          <Text>{c.dim('Leave blank for "manual". Examples: bounce, unsubscribe, opted-out')}</Text>
          <Box gap={3}><Text>{kbd('Enter')} {c.success('save')}</Text><Text>{kbd('Esc')} back</Text></Box>
        </Box>
      )}

      {step === 'list' && (
        <>
          <Box paddingX={1}>
            <Text>{c.muted('EMAIL                                   ')} {c.muted('REASON        ')} {c.muted('ADDED')}</Text>
          </Box>
          <Text>{c.muted('─'.repeat(72))}</Text>
          {loading && <Spinner label="Loading…" />}
          {!loading && list.length === 0 && (
            <Box paddingX={1} paddingY={1}><Text>{c.muted('Empty — press ')}{kbd('a')}{c.muted(' to add an address')}</Text></Box>
          )}
          {list.map((entry, i) => (
            <Box key={entry.id} paddingX={1} borderStyle={i === selected ? 'round' : undefined} borderColor={i === selected ? '#EF4444' : undefined}>
              <Text>
                <Text color={i === selected ? '#EF4444' : undefined}>{i === selected ? '▶ ' : '  '}</Text>
                <Text>{entry.email.padEnd(40)}</Text>
                <Text color="#52525B">{(entry.reason || 'manual').padEnd(16)}</Text>
                <Text color="#52525B">{fmt(entry.addedAt)}</Text>
              </Text>
            </Box>
          ))}
        </>
      )}

      {step === 'list' && <StatusBar hints={[
        { key: '↑↓', label: 'select' }, { key: 'a', label: 'add' },
        { key: 'd', label: 'remove' }, { key: 'Esc', label: 'back' },
      ]} extra={`${list.length} suppressed`} />}
    </Box>
  )
}
