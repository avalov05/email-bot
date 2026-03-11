import chalk from 'chalk'

// ── Palette ─────────────────────────────────────────────────────────────────
export const c = {
  // Brand gradient
  violet:  (s: string) => chalk.hex('#8B5CF6')(s),
  purple:  (s: string) => chalk.hex('#A855F7')(s),
  indigo:  (s: string) => chalk.hex('#6366F1')(s),
  // Semantic
  success: (s: string) => chalk.hex('#22C55E')(s),
  warn:    (s: string) => chalk.hex('#F59E0B')(s),
  danger:  (s: string) => chalk.hex('#EF4444')(s),
  info:    (s: string) => chalk.hex('#38BDF8')(s),
  // Text
  bright:  (s: string) => chalk.white.bold(s),
  muted:   (s: string) => chalk.hex('#71717A')(s),
  dim:     (s: string) => chalk.dim(s),
  // Accents
  cyan:    (s: string) => chalk.hex('#06B6D4')(s),
  pink:    (s: string) => chalk.hex('#EC4899')(s),
  amber:   (s: string) => chalk.hex('#FBBF24')(s),
  lime:    (s: string) => chalk.hex('#84CC16')(s),
  // Raw
  bold:    (s: string) => chalk.bold(s),
  italic:  (s: string) => chalk.italic(s),
  strike:  (s: string) => chalk.strikethrough(s),
  under:   (s: string) => chalk.underline(s),
}

// ── Gradient text (left→right through a color list) ─────────────────────────
export function gradient(text: string, colors: string[] = ['#8B5CF6','#6366F1','#38BDF8']): string {
  const chars = [...text]
  if (chars.length === 0) return ''
  return chars.map((ch, i) => {
    if (ch === ' ') return ' '
    const t = chars.length === 1 ? 0 : i / (chars.length - 1)
    const ci = Math.min(Math.floor(t * (colors.length - 1)), colors.length - 2)
    const lt = t * (colors.length - 1) - ci
    const hex1 = colors[ci], hex2 = colors[ci + 1]
    const lerp = (a: number, b: number) => Math.round(a + (b - a) * lt)
    const p1 = parseInt(hex1.slice(1), 16), p2 = parseInt(hex2.slice(1), 16)
    const r = lerp((p1 >> 16) & 0xff, (p2 >> 16) & 0xff)
    const g = lerp((p1 >> 8) & 0xff, (p2 >> 8) & 0xff)
    const b = lerp(p1 & 0xff, p2 & 0xff)
    return chalk.rgb(r, g, b)(ch)
  }).join('')
}

// ── Box drawing ──────────────────────────────────────────────────────────────
export const box = {
  tl: '╭', tr: '╮', bl: '╰', br: '╯',
  h: '─', v: '│', cross: '┼',
  ltee: '├', rtee: '┤', ttee: '┬', btee: '┴',
  // Heavy
  Htl: '┌', Htr: '┐', Hbl: '└', Hbr: '┘', Hh: '─', Hv: '│',
  // Double
  Dtl: '╔', Dtr: '╗', Dbl: '╚', Dbr: '╝', Dh: '═', Dv: '║',
}

// ── Status badges ────────────────────────────────────────────────────────────
export function statusBadge(status: string): string {
  const map: Record<string, [string, (s: string) => string]> = {
    draft:        ['◌ draft',        c.muted],
    running:      ['◉ running',      c.success],
    paused:       ['◐ paused',       c.warn],
    completed:    ['● done',         c.success],
    failed:       ['✗ failed',       c.danger],
    archived:     ['◻ archived',     c.muted],
    pending:      ['○ pending',      c.muted],
    sending:      ['◈ sending',      c.info],
    sent:         ['✓ sent',         c.success],
    draft_created:['✦ drafted',      c.cyan],
    suppressed:   ['⊘ suppressed',   c.muted],
    stopped:      ['◫ stopped',      c.warn],
    dry_run:      ['⬡ dry run',      c.purple],
    queued:       ['◎ queued',       c.info],
  }
  const [label, fn] = map[status] || [`· ${status}`, c.muted]
  return fn(label)
}

// ── Spinner frames ───────────────────────────────────────────────────────────
export const SPINNER_FRAMES = ['◐','◓','◑','◒']
export const DOTS_FRAMES    = ['⣾','⣽','⣻','⢿','⡿','⣟','⣯','⣷']
export const PULSE_FRAMES   = ['·','●','◉','●','·']
export const BARS_FRAMES    = ['▏','▎','▍','▌','▋','▊','▉','█','▉','▊','▋','▌','▍','▎','▏']

// ── Progress bar ─────────────────────────────────────────────────────────────
export function progressBar(value: number, width = 20, colors = { filled: '#8B5CF6', empty: '#3F3F46' }): string {
  const filled = Math.round(value * width)
  const empty  = width - filled
  const filledStr = '█'.repeat(filled)
  const emptyStr  = '░'.repeat(empty)
  return chalk.hex(colors.filled)(filledStr) + chalk.hex(colors.empty)(emptyStr)
}

// ── Borders ──────────────────────────────────────────────────────────────────
export function drawBox(lines: string[], width: number, color: (s: string) => string = c.muted, title = ''): string {
  const titleStr = title ? ` ${title} ` : ''
  const topFill  = box.h.repeat(Math.max(0, width - 2 - titleStr.length))
  const top    = color(box.tl + titleStr + topFill + box.tr)
  const bottom = color(box.bl + box.h.repeat(width - 2) + box.br)
  const middle = lines.map(l => {
    const stripped = stripAnsi(l)
    const pad = Math.max(0, width - 2 - stripped.length)
    return color(box.v) + l + ' '.repeat(pad) + color(box.v)
  })
  return [top, ...middle, bottom].join('\n')
}

export function stripAnsi(s: string): string {
  return s.replace(/\u001b\[[0-9;]*m/g, '')
}

// ── Kbd shortcut display ─────────────────────────────────────────────────────
export function kbd(key: string): string {
  return chalk.bgHex('#27272A').hex('#A1A1AA')(` ${key} `)
}
