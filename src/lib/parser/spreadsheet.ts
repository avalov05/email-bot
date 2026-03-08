import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export interface ParsedRow {
  email: string
  first_name?: string
  last_name?: string
  company?: string
  [key: string]: string | undefined
}

export interface ParseResult {
  rows: ParsedRow[]
  headers: string[]
  errors: string[]
  warnings: string[]
  duplicates: string[]
  invalidEmails: string[]
  totalRaw: number
}

export interface ColumnMapping {
  email: string
  first_name?: string
  last_name?: string
  company?: string
  [key: string]: string | undefined
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim())
}

export function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = { email: '' }
  const hl = headers.map(h => h.toLowerCase().trim())

  for (const c of ['email', 'email address', 'e-mail', 'mail', 'emailaddress']) {
    const i = hl.indexOf(c); if (i !== -1) { mapping.email = headers[i]; break }
  }
  for (const c of ['first_name', 'firstname', 'first name', 'given name', 'fname']) {
    const i = hl.indexOf(c); if (i !== -1) { mapping.first_name = headers[i]; break }
  }
  for (const c of ['last_name', 'lastname', 'last name', 'surname', 'lname']) {
    const i = hl.indexOf(c); if (i !== -1) { mapping.last_name = headers[i]; break }
  }
  for (const c of ['company', 'company name', 'organization', 'org', 'employer']) {
    const i = hl.indexOf(c); if (i !== -1) { mapping.company = headers[i]; break }
  }
  return mapping
}

function applyMapping(rawRows: Record<string, string>[], mapping: ColumnMapping): ParsedRow[] {
  const mappedValues = new Set(Object.values(mapping).filter(Boolean))
  return rawRows.map(row => {
    const mapped: ParsedRow = { email: (row[mapping.email] || '').trim().toLowerCase() }
    if (mapping.first_name) mapped.first_name = row[mapping.first_name]?.trim()
    if (mapping.last_name) mapped.last_name = row[mapping.last_name]?.trim()
    if (mapping.company) mapped.company = row[mapping.company]?.trim()
    for (const [key, value] of Object.entries(row)) {
      if (!mappedValues.has(key)) {
        const nk = key.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
        if (nk) mapped[nk] = String(value || '').trim()
      }
    }
    return mapped
  })
}

function validateAndClean(rows: ParsedRow[], headers: string[], existingErrors: string[]): ParseResult {
  const errors = [...existingErrors]
  const warnings: string[] = []
  const seenEmails = new Set<string>()
  const duplicates: string[] = []
  const invalidEmails: string[] = []
  const cleanRows: ParsedRow[] = []
  const totalRaw = rows.length

  for (const row of rows) {
    if (!row.email) { warnings.push('Skipped row with empty email'); continue }
    if (!isValidEmail(row.email)) { invalidEmails.push(row.email); continue }
    if (seenEmails.has(row.email)) { duplicates.push(row.email); continue }
    seenEmails.add(row.email)
    cleanRows.push(row)
  }

  if (invalidEmails.length > 0) warnings.push(`${invalidEmails.length} invalid email(s) removed`)
  if (duplicates.length > 0) warnings.push(`${duplicates.length} duplicate(s) removed`)
  return { rows: cleanRows, headers, errors, warnings, duplicates, invalidEmails, totalRaw }
}

export function parseCSV(content: string, mapping?: ColumnMapping): ParseResult {
  const result = Papa.parse<Record<string, string>>(content, {
    header: true, skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })
  const headers = result.meta.fields || []
  const errors: string[] = result.errors.map(e => e.message)
  const autoMapping = mapping || autoDetectMapping(headers)
  if (!autoMapping.email) {
    return { rows: [], headers, errors: [...errors, 'Could not detect email column. Map it manually.'], warnings: [], duplicates: [], invalidEmails: [], totalRaw: 0 }
  }
  const rows = applyMapping(result.data, autoMapping)
  return validateAndClean(rows, headers, errors)
}

export function parseXLSX(buffer: ArrayBuffer, mapping?: ColumnMapping): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rawData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '', raw: false })
  const headers = rawData.length > 0 ? Object.keys(rawData[0]) : []
  const autoMapping = mapping || autoDetectMapping(headers)
  if (!autoMapping.email) {
    return { rows: [], headers, errors: ['Could not detect email column. Map it manually.'], warnings: [], duplicates: [], invalidEmails: [], totalRaw: 0 }
  }
  const rows = applyMapping(rawData, autoMapping)
  return validateAndClean(rows, headers, [])
}
