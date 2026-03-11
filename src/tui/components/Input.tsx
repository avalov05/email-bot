import React from 'react'
import { Box, Text, useInput } from 'ink'
import { c } from '../theme.js'

interface InputProps {
  label: string
  value: string
  onChange: (v: string) => void
  onSubmit?: (v: string) => void
  focused?: boolean
  placeholder?: string
  masked?: boolean
}

export function Input({ label, value, onChange, onSubmit, focused = true, placeholder, masked }: InputProps) {
  useInput((char, key) => {
    if (!focused) return
    if (key.backspace || key.delete) { onChange(value.slice(0, -1)); return }
    if (key.return) { onSubmit?.(value); return }
    if (!key.ctrl && !key.meta && char) onChange(value + char)
  })

  const display = masked ? '•'.repeat(value.length) : value
  const shown = display || placeholder || ''
  const isPlaceholder = !display

  return (
    <Box gap={1} alignItems="center">
      <Text>{c.muted(label + ':')}</Text>
      <Text>
        {c.violet('[')}
        {isPlaceholder ? c.dim(shown) : c.bright(shown)}
        {focused ? c.violet('█') : ' '}
        {c.violet(']')}
      </Text>
    </Box>
  )
}
