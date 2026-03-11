import React from 'react'
import { Box, Text } from 'ink'
import { progressBar, c } from '../theme.js'

interface ProgressBarProps {
  value: number   // 0–1
  width?: number
  label?: string
  counts?: { done: number; total: number }
}

export function ProgressBar({ value, width = 24, label, counts }: ProgressBarProps) {
  const pct = Math.round(value * 100)
  return (
    <Box gap={1} alignItems="center">
      {label && <Text>{c.muted(label)}</Text>}
      <Text>{progressBar(value, width)}</Text>
      {counts
        ? <Text>{c.muted(`${counts.done}/${counts.total}`)}</Text>
        : <Text>{c.muted(`${pct}%`)}</Text>}
    </Box>
  )
}
