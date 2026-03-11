import React from 'react'
import { Box, Text } from 'ink'
import { gradient, c, kbd } from '../theme.js'

interface HeaderProps {
  account?: string
  provider?: string
  version?: string
}

const LOGO_LINES = [
  '  ╔═╗ ╦ ╦ ╔╦╗ ╦═╗ ╔═╗ ╔═╗ ╔═╗ ╦ ╦',
  '  ║ ║ ║ ║  ║  ╠╦╝ ║╣  ╠═╣ ║   ╠═╣',
  '  ╚═╝ ╚═╝  ╩  ╩╚═ ╚═╝ ╩ ╩ ╚═╝ ╩ ╩',
]

export function Header({ account, provider, version = '1.0.0' }: HeaderProps) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      {LOGO_LINES.map((l, i) => (
        <Text key={i}>{gradient(l, ['#8B5CF6','#6366F1','#06B6D4'])}</Text>
      ))}
      <Box marginTop={1} gap={3} justifyContent="space-between">
        <Text>{c.muted('  Permission-based outreach console  ·  local-first  ·  safe by default')}</Text>
        <Box gap={2}>
          {account && <Text>{c.success('◉')} {c.muted('connected:')} {c.bright(account)}{provider ? c.muted(` (${provider})`) : ''}</Text>}
          {!account && <Text>{c.dim('◌')} {c.muted('no account connected')}</Text>}
          <Text>{c.muted(`v${version}`)}</Text>
        </Box>
      </Box>
    </Box>
  )
}
