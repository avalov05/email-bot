import React from 'react'
import { Text } from 'ink'
import { statusBadge } from '../theme.js'

interface BadgeProps { status: string }
export function Badge({ status }: BadgeProps) {
  return <Text>{statusBadge(status)}</Text>
}
