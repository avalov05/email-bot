import React from 'react'
import { Box, Text } from 'ink'
import { c, kbd } from '../theme.js'
import { useInput } from 'ink'

interface ConfirmProps {
  message: string
  detail?: string
  onYes: () => void
  onNo: () => void
  danger?: boolean
}

export function Confirm({ message, detail, onYes, onNo, danger }: ConfirmProps) {
  useInput((input, key) => {
    if (input === 'y' || input === 'Y' || key.return) onYes()
    if (input === 'n' || input === 'N' || key.escape) onNo()
  })

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={danger ? '#EF4444' : '#8B5CF6'} paddingX={2} paddingY={1} gap={1}>
      <Text bold color={danger ? '#EF4444' : '#A855F7'}>{danger ? '⚠  ' : '◈  '}{message}</Text>
      {detail && <Text>{c.muted(detail)}</Text>}
      <Box gap={3} marginTop={1}>
        <Text>{kbd('y')} {danger ? c.danger('Yes, proceed') : c.success('Yes')}</Text>
        <Text>{kbd('n / Esc')} {c.muted('Cancel')}</Text>
      </Box>
    </Box>
  )
}
