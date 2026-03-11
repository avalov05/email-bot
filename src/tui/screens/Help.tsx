import React from 'react'
import { Box, Text } from 'ink'
import { c, gradient, kbd } from '../theme.js'
import { StatusBar } from '../components/StatusBar.js'
import { useKeymap } from '../hooks/useKeymap.js'

interface Props { onNavigate: (s: string, d?: unknown) => void }

const SECTIONS = [
  {
    title: 'NAVIGATION',
    rows: [
      ['↑ ↓', 'Move up / down in any list'],
      ['Enter', 'Select / confirm / open'],
      ['Esc / q', 'Go back / cancel'],
      ['Tab / [ ]', 'Cycle through tabs in campaign view'],
      ['1–5', 'Quick-jump: 1=Dashboard 2=Accounts 3=Suppress 4=Log 5=Settings'],
    ],
  },
  {
    title: 'CAMPAIGNS',
    rows: [
      ['n', 'New campaign (from Dashboard or Campaigns list)'],
      ['D', 'Duplicate selected campaign'],
      ['a', 'Archive selected campaign'],
      ['d', 'Delete selected campaign'],
      ['Enter', 'Open campaign detail'],
    ],
  },
  {
    title: 'INSIDE A CAMPAIGN',
    rows: [
      ['1', 'Overview tab — stats and last run'],
      ['2', 'Compose tab — view template & preview'],
      ['3', 'Contacts tab — browse imported contacts'],
      ['4', 'Send tab — start / pause / stop'],
      ['Space/Enter', 'Start campaign (from Send tab)'],
      ['p', 'Pause running campaign'],
      ['r', 'Resume paused campaign'],
      ['s', 'Stop campaign immediately'],
      ['i', 'Import contacts (CSV / XLSX)'],
      ['S', 'Open campaign settings'],
    ],
  },
  {
    title: 'SENDING MODES',
    rows: [
      ['draft',   'Creates email drafts in your inbox. Nothing is sent. (Default & safest)'],
      ['dry_run', 'Simulates the full run — logs output but sends nothing.'],
      ['send',    '⚠ Sends real emails immediately. Requires compliance confirmation.'],
    ],
  },
  {
    title: 'COMPLIANCE & SAFETY',
    rows: [
      ['', 'You must confirm compliance before running any campaign.'],
      ['', 'Suppressed addresses are skipped automatically across all campaigns.'],
      ['', 'Campaign auto-pauses if failure rate exceeds 30%.'],
      ['', 'Exponential backoff + jitter on 429/5xx errors.'],
      ['', 'Every action is logged in the Audit Log.'],
    ],
  },
  {
    title: 'PERSONALIZATION VARIABLES',
    rows: [
      ['{{first_name}}', 'First name of recipient'],
      ['{{last_name}}',  'Last name of recipient'],
      ['{{company}}',    'Company / organization'],
      ['{{email}}',      'Email address'],
      ['{{any_field}}',  'Any column from your imported spreadsheet'],
    ],
  },
]

export function Help({ onNavigate }: Props) {
  useKeymap({
    escape: () => onNavigate('dashboard'), q: () => onNavigate('dashboard'),
    '1': () => onNavigate('dashboard'), '2': () => onNavigate('connect'),
    '3': () => onNavigate('suppression'), '4': () => onNavigate('logs'), '5': () => onNavigate('settings'),
  })

  return (
    <Box flexDirection="column" gap={1}>
      <Text>{gradient('  HELP & KEYBOARD SHORTCUTS', ['#8B5CF6','#38BDF8'])}</Text>

      {SECTIONS.map(section => (
        <Box key={section.title} flexDirection="column" gap={0} marginTop={1}>
          <Text>{c.violet('▸ ' + section.title)}</Text>
          <Text>{c.muted('  ' + '─'.repeat(60))}</Text>
          {section.rows.map(([key, desc], i) => (
            <Box key={i} paddingLeft={2} gap={2}>
              <Box width={20}>{key ? <Text>{kbd(key)}</Text> : <Text>{'  '}</Text>}</Box>
              <Text color="#A1A1AA">{desc}</Text>
            </Box>
          ))}
        </Box>
      ))}

      <Box marginTop={2} borderStyle="round" borderColor="#27272A" paddingX={3} paddingY={1}>
        <Text>{c.muted('Need more help? See ')}{c.cyan('README.md')}{c.muted(' and ')}{c.cyan('TROUBLESHOOTING.md')}{c.muted(' in the project root.')}</Text>
      </Box>

      <StatusBar hints={[{ key: 'Esc / q', label: 'close help' }]} />
    </Box>
  )
}
