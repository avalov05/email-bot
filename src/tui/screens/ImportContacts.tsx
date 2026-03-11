import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { c, gradient, kbd } from '../theme.js'
import { Spinner } from '../components/Spinner.js'
import { ProgressBar } from '../components/ProgressBar.js'
import { StatusBar } from '../components/StatusBar.js'
import { db } from '../../lib/db/client.js'
import { recipients, campaigns } from '../../lib/db/schema.js'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { parseCSV, parseXLSX } from '../../lib/parser/spreadsheet.js'
import { isSuppress } from '../../lib/suppression.js'
import { audit } from '../../lib/audit.js'
import * as fs from 'fs'
import * as path from 'path'

interface Props { campaignId: string; onNavigate: (screen: string, data?: unknown) => void }

export function ImportContacts({ campaignId, onNavigate }: Props) {
  const [step, setStep] = useState<'path' | 'parsing' | 'preview' | 'importing' | 'done'>('path')
  const [filePath, setFilePath] = useState('')
  const [parseResult, setParseResult] = useState<{ rows: unknown[]; warnings: string[]; errors: string[]; duplicates: string[]; invalidEmails: string[]; totalRaw: number; hasPerRowContent: boolean } | null>(null)
  const [imported, setImported] = useState(0)
  const [suppressed, setSuppressed] = useState(0)
  const [error, setError] = useState('')
  const [pendingAction, setPendingAction] = useState<'parse' | 'import' | null>(null)

  useEffect(() => {
    if (pendingAction === 'parse') { setPendingAction(null); parseFile() }
    else if (pendingAction === 'import') { setPendingAction(null); doImport() }
  }, [pendingAction])

  useInput((input, key) => {
    if (step === 'path') {
      if (key.backspace || key.delete) { setFilePath(p => p.slice(0, -1)); return }
      if (key.return) { setPendingAction('parse'); return }
      if (key.escape) { onNavigate('campaign', campaignId); return }
      if (!key.ctrl && !key.meta && input) setFilePath(p => p + input)
    }
    if (step === 'preview') {
      if (key.return || input === 'y') { setPendingAction('import'); return }
      if (key.escape || input === 'n') { onNavigate('campaign', campaignId); return }
    }
    if (step === 'done') {
      onNavigate('campaign', campaignId)
    }
  })

  async function parseFile() {
    if (!filePath.trim()) { setError('Enter a file path'); return }
    const fp = path.resolve(filePath.trim().replace(/^~/, process.env.HOME || ''))
    if (!fs.existsSync(fp)) { setError(`File not found: ${fp}`); return }
    setError(''); setStep('parsing')
    try {
      const ext = path.extname(fp).toLowerCase()
      let result
      if (ext === '.csv') {
        result = parseCSV(fs.readFileSync(fp, 'utf8'))
      } else {
        result = parseXLSX(fs.readFileSync(fp).buffer)
      }
      if (result.errors.length > 0 && result.rows.length === 0) {
        setError(result.errors[0]); setStep('path'); return
      }
      setParseResult(result); setStep('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e)); setStep('path')
    }
  }

  async function doImport() {
    if (!parseResult) return
    setStep('importing')
    const now = Date.now()
    let importedCount = 0; let suppressedCount = 0
    await db.delete(recipients).where(eq(recipients.campaignId, campaignId))
    for (let i = 0; i < parseResult.rows.length; i++) {
      const row = parseResult.rows[i] as Record<string, string>
      if (await isSuppress(row.email)) { suppressedCount++; continue }
      const { email, first_name, last_name, company, subjectOverride, bodyOverride, ...rest } = row
      const cf: Record<string, string> = {}
      for (const [k, v] of Object.entries(rest)) { if (v) cf[k] = v }
      await db.insert(recipients).values({
        id: uuidv4(), campaignId, email, firstName: first_name || null, lastName: last_name || null,
        company: company || null, customFields: Object.keys(cf).length ? JSON.stringify(cf) : null,
        subjectOverride: subjectOverride || null, bodyOverride: bodyOverride || null,
        status: 'pending', rowIndex: i, createdAt: now, updatedAt: now,
      })
      importedCount++
    }
    await audit('recipient.imported', { entityType: 'campaign', entityId: campaignId, details: { count: importedCount, suppressed: suppressedCount } })
    setImported(importedCount); setSuppressed(suppressedCount); setStep('done')
  }

  return (
    <Box flexDirection="column" gap={2}>
      <Text>{gradient('  IMPORT CONTACTS', ['#8B5CF6','#38BDF8'])}</Text>

      {step === 'path' && (
        <Box flexDirection="column" gap={1}>
          <Text>{c.muted('Enter the path to your CSV or XLSX file:')}</Text>
          <Box borderStyle="round" borderColor="#8B5CF6" paddingX={2} paddingY={0} gap={1}>
            <Text>{c.violet('▶')}</Text>
            <Text bold color="#FFFFFF">{filePath || c.dim('~/Desktop/contacts.csv')}</Text>
            <Text>{c.violet('█')}</Text>
          </Box>
          {error && <Text>{c.danger('✗ ' + error)}</Text>}
          <Box flexDirection="column" gap={0} marginTop={1}>
            <Text>{c.muted('Required column:')}{c.dim(' email')}</Text>
            <Text>{c.muted('Optional:')}{c.dim(' first_name, last_name, company, Subject, Email Body, and any custom fields')}</Text>
            <Text>{c.muted('Formats:')}{c.dim(' .csv (comma-separated) or .xlsx (Excel)')}</Text>
          </Box>
        </Box>
      )}

      {step === 'parsing' && <Spinner label="Parsing file..." />}

      {step === 'preview' && parseResult && (
        <Box flexDirection="column" gap={1}>
          <Box borderStyle="round" borderColor="#22C55E" paddingX={3} paddingY={1} flexDirection="column" gap={0}>
            <Text bold color="#22C55E">✓ File parsed successfully</Text>
            <Box gap={4} marginTop={1}>
              <Text>{c.muted('Total raw:')} {c.bright(String(parseResult.totalRaw))}</Text>
              <Text>{c.muted('Valid:')} {c.success(String(parseResult.rows.length))}</Text>
              {parseResult.duplicates.length > 0 && <Text>{c.warn(`${parseResult.duplicates.length} dupes removed`)}</Text>}
              {parseResult.invalidEmails.length > 0 && <Text>{c.danger(`${parseResult.invalidEmails.length} invalid removed`)}</Text>}
            </Box>
            {parseResult.hasPerRowContent && <Text>{c.violet('✦ Per-row Subject + Body detected — will use individual content per recipient')}</Text>}
            {parseResult.warnings.map((w, i) => <Text key={i}>{c.warn('⚠ ' + w)}</Text>)}
          </Box>

          {/* Preview rows */}
          <Text>{c.muted('First 5 rows:')}</Text>
          <Box borderStyle="round" borderColor="#27272A" paddingX={2} paddingY={1} flexDirection="column">
            {(parseResult.rows as Record<string, string>[]).slice(0, 5).map((r, i) => (
              <Text key={i}>{c.dim(`${i+1}.`)} {c.bright(r.email)}{r.first_name ? c.muted(` · ${r.first_name}`) : ''}{r.company ? c.muted(` @ ${r.company}`) : ''}</Text>
            ))}
            {parseResult.rows.length > 5 && <Text>{c.dim(`… and ${parseResult.rows.length - 5} more`)}</Text>}
          </Box>

          <Text>{c.muted('Replace existing contacts and import?')}</Text>
          <Box gap={3}><Text>{kbd('y / Enter')} {c.success('Yes, import')}</Text><Text>{kbd('n / Esc')} {c.muted('Cancel')}</Text></Box>
        </Box>
      )}

      {step === 'importing' && (
        <Box flexDirection="column" gap={1}>
          <Spinner label="Importing contacts..." color="#22C55E" />
        </Box>
      )}

      {step === 'done' && (
        <Box flexDirection="column" gap={1}>
          <Box borderStyle="round" borderColor="#22C55E" paddingX={3} paddingY={1}>
            <Text bold color="#22C55E">✓ Import complete</Text>
          </Box>
          <Box gap={4}>
            <Text>{c.success(`✓ ${imported} imported`)}</Text>
            {suppressed > 0 && <Text>{c.muted(`⊘ ${suppressed} suppressed`)}</Text>}
          </Box>
          <Text>{c.muted('Press any key to return to campaign…')}</Text>
        </Box>
      )}

      <StatusBar hints={step === 'path'
        ? [{ key: 'Enter', label: 'parse file' }, { key: 'Esc', label: 'cancel' }]
        : step === 'preview'
        ? [{ key: 'y/Enter', label: 'import' }, { key: 'n/Esc', label: 'cancel' }]
        : []}
      />
    </Box>
  )
}
