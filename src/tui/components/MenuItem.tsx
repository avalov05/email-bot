import React from 'react'
import { Box, Text } from 'ink'
import { c, gradient } from '../theme.js'

interface MenuItemProps {
  label: string
  icon?: string
  selected?: boolean
  badge?: string
  hint?: string
}

export function MenuItem({ label, icon, selected, badge, hint }: MenuItemProps) {
  return (
    <Box gap={2} alignItems="center">
      <Text>{selected ? c.violet('▶') : c.muted(' ')}</Text>
      {icon && <Text>{selected ? c.violet(icon) : c.muted(icon)}</Text>}
      <Text bold={selected} color={selected ? '#A855F7' : undefined}>{label}</Text>
      {badge && <Text>{c.info(`[${badge}]`)}</Text>}
      {hint && !selected && <Text>{c.dim(hint)}</Text>}
    </Box>
  )
}
