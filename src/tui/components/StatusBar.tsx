import React from 'react'
import { Box, Text } from 'ink'
import { c, kbd } from '../theme.js'

interface StatusBarProps {
  hints: Array<{ key: string; label: string }>
  extra?: string
}

export function StatusBar({ hints, extra }: StatusBarProps) {
  return (
    <Box marginTop={1} gap={2} justifyContent="space-between">
      <Box gap={2} flexWrap="wrap">
        {hints.map(({ key, label }) => (
          <Text key={key}>{kbd(key)} {c.muted(label)}</Text>
        ))}
      </Box>
      {extra && <Text>{c.muted(extra)}</Text>}
    </Box>
  )
}
