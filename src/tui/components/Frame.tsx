import React from 'react'
import { Box, Text } from 'ink'
import { c, gradient, box } from '../theme.js'

interface FrameProps {
  title?: string
  titleColor?: 'violet' | 'cyan' | 'success' | 'warn' | 'danger'
  children: React.ReactNode
  width?: number
  padding?: number
  dimBorder?: boolean
}

export function Frame({ title, titleColor = 'violet', children, padding = 1, dimBorder }: FrameProps) {
  const borderColor = dimBorder ? '#3F3F46' : '#52525B'
  const titleEl = title
    ? <Text bold color={titleColor === 'violet' ? '#8B5CF6' : titleColor === 'cyan' ? '#06B6D4' : titleColor === 'success' ? '#22C55E' : titleColor === 'warn' ? '#F59E0B' : '#EF4444'}>{ title }</Text>
    : undefined

  return (
    <Box borderStyle="round" borderColor={borderColor} flexDirection="column" paddingX={padding} paddingY={Math.floor(padding / 2)}>
      {titleEl && <Box marginBottom={1}><Text> </Text>{titleEl}</Box>}
      {children}
    </Box>
  )
}
