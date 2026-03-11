import React, { useState, useEffect } from 'react'
import { Box, Text, useApp } from 'ink'
import { gradient, c, PULSE_FRAMES, DOTS_FRAMES } from '../theme.js'
import { useInterval } from '../hooks/useInterval.js'

const BIG_LOGO = [
  '  ██████╗ ██╗   ██╗████████╗██████╗ ███████╗ █████╗  ██████╗██╗  ██╗',
  '  ██╔══██╗██║   ██║╚══██╔══╝██╔══██╗██╔════╝██╔══██╗██╔════╝██║  ██║',
  '  ██║  ██║██║   ██║   ██║   ██████╔╝█████╗  ███████║██║     ███████║',
  '  ██║  ██║██║   ██║   ██║   ██╔══██╗██╔══╝  ██╔══██║██║     ██╔══██║',
  '  ██████╔╝╚██████╔╝   ██║   ██║  ██║███████╗██║  ██║╚██████╗██║  ██║',
  '  ╚═════╝  ╚═════╝    ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝',
  '',
  '  ██████╗ ██████╗ ███╗   ██╗███████╗ ██████╗ ██╗     ███████╗',
  '  ██╔════╝██╔═══██╗████╗  ██║██╔════╝██╔═══██╗██║     ██╔════╝',
  '  ██║     ██║   ██║██╔██╗ ██║███████╗██║   ██║██║     █████╗',
  '  ██║     ██║   ██║██║╚██╗██║╚════██║██║   ██║██║     ██╔══╝',
  '  ╚██████╗╚██████╔╝██║ ╚████║███████║╚██████╔╝███████╗███████╗',
  '   ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚══════╝╚══════╝',
]

const COLORS_A = ['#8B5CF6','#A855F7','#6366F1']
const COLORS_B = ['#6366F1','#38BDF8','#06B6D4']

interface SplashProps {
  onDone: () => void
}

export function Splash({ onDone }: SplashProps) {
  const [phase, setPhase] = useState(0) // 0=draw, 1=tagline, 2=ready
  const [linesShown, setLinesShown] = useState(0)
  const [dotFrame, setDotFrame] = useState(0)
  const [colorShift, setColorShift] = useState(0)

  useInterval(() => {
    if (linesShown < BIG_LOGO.length) setLinesShown(n => n + 1)
    else if (phase === 0) setPhase(1)
  }, 40)

  useInterval(() => setColorShift(n => n + 1), 150)
  useInterval(() => setDotFrame(n => (n + 1) % DOTS_FRAMES.length), 80)
  useEffect(() => { if (phase >= 1) { const t = setTimeout(onDone, 1800); return () => clearTimeout(t) } }, [phase])

  const colors = colorShift % 2 === 0 ? COLORS_A : COLORS_B

  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" minHeight={30} gap={0}>
      <Box flexDirection="column">
        {BIG_LOGO.slice(0, linesShown).map((line, i) => (
          <Text key={i}>{gradient(line, colors)}</Text>
        ))}
      </Box>

      {phase >= 1 && (
        <Box flexDirection="column" alignItems="center" marginTop={2} gap={1}>
          <Text>{gradient('  Permission-based outreach  ·  local-first  ·  safe by default', ['#A855F7','#38BDF8'])}</Text>
          <Text>{c.muted(DOTS_FRAMES[dotFrame])} {c.dim('Loading...')}</Text>
        </Box>
      )}
    </Box>
  )
}
