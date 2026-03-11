import React from 'react'
import { Box, Text } from 'ink'
import { c, stripAnsi } from '../theme.js'

export interface Column<T> {
  key: string
  header: string
  width: number
  render?: (row: T, selected: boolean) => string
}

interface TableProps<T extends Record<string, unknown>> {
  columns: Column<T>[]
  rows: T[]
  selectedIndex?: number
  maxHeight?: number
  emptyMessage?: string
}

function pad(s: string, n: number): string {
  const stripped = stripAnsi(s)
  const visible = [...stripped].length
  if (visible >= n) return s + ' '
  return s + ' '.repeat(n - visible + 1)
}

export function Table<T extends Record<string, unknown>>({ columns, rows, selectedIndex = -1, maxHeight = 20, emptyMessage = 'No data' }: TableProps<T>) {
  const header = columns.map(col => c.muted(pad(col.header.toUpperCase(), col.width))).join(c.muted('  '))
  const separator = c.muted('─'.repeat(columns.reduce((s, c) => s + c.width + 2, 0)))

  const visibleRows = maxHeight > 0 ? rows.slice(0, maxHeight) : rows

  return (
    <Box flexDirection="column">
      <Text>{header}</Text>
      <Text>{separator}</Text>
      {rows.length === 0 && <Text>{c.muted(`  ${emptyMessage}`)}</Text>}
      {visibleRows.map((row, i) => {
        const selected = i === selectedIndex
        const cells = columns.map(col => {
          const raw = col.render ? col.render(row, selected) : String(row[col.key] ?? '')
          return pad(raw, col.width)
        }).join('  ')
        return (
          <Box key={i} gap={0}>
            <Text>{selected ? c.violet('▶ ') : '  '}</Text>
            <Text bold={selected} color={selected ? '#A855F7' : undefined}>{cells}</Text>
          </Box>
        )
      })}
      {rows.length > maxHeight && <Text>{c.muted(`  … and ${rows.length - maxHeight} more`)}</Text>}
    </Box>
  )
}
