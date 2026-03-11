import React, { useState } from 'react'
import { Text } from 'ink'
import { useInterval } from '../hooks/useInterval.js'
import { DOTS_FRAMES } from '../theme.js'
import chalk from 'chalk'

interface SpinnerProps {
  label?: string
  color?: string
}

export function Spinner({ label, color = '#8B5CF6' }: SpinnerProps) {
  const [frame, setFrame] = useState(0)
  useInterval(() => setFrame(f => (f + 1) % DOTS_FRAMES.length), 80)
  return (
    <Text>{chalk.hex(color)(DOTS_FRAMES[frame])}{label ? `  ${label}` : ''}</Text>
  )
}
