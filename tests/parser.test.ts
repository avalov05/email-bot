import { describe, it, expect } from 'node:test'
import assert from 'node:assert/strict'
import { parseCSV, autoDetectMapping } from '../src/lib/parser/spreadsheet.js'

describe('Spreadsheet Parser', () => {
  it('parses basic CSV', () => {
    const csv = 'email,first_name\nalice@test.com,Alice\nbob@test.com,Bob'
    const result = parseCSV(csv)
    assert.equal(result.rows.length, 2)
    assert.equal(result.rows[0].email, 'alice@test.com')
    assert.equal(result.rows[0].first_name, 'Alice')
  })

  it('removes duplicates', () => {
    const csv = 'email\nalice@test.com\nalice@test.com\nbob@test.com'
    const result = parseCSV(csv)
    assert.equal(result.rows.length, 2)
    assert.equal(result.duplicates.length, 1)
    assert.ok(result.warnings.some(w => w.includes('duplicate')))
  })

  it('removes invalid emails', () => {
    const csv = 'email\nalice@test.com\nnot-an-email\nbob@test.com'
    const result = parseCSV(csv)
    assert.equal(result.rows.length, 2)
    assert.equal(result.invalidEmails.length, 1)
    assert.ok(result.invalidEmails.includes('not-an-email'))
  })

  it('auto-detects email column variations', () => {
    for (const header of ['email', 'Email', 'EMAIL', 'e-mail', 'mail']) {
      const mapping = autoDetectMapping([header, 'name'])
      assert.equal(mapping.email, header, `Failed for: ${header}`)
    }
  })

  it('reports error when no email column found', () => {
    const result = parseCSV('name,phone\nAlice,555-1234')
    assert.ok(result.errors.length > 0)
    assert.equal(result.rows.length, 0)
  })

  it('normalises emails to lowercase', () => {
    const csv = 'email\nALICE@TEST.COM'
    const result = parseCSV(csv)
    assert.equal(result.rows[0].email, 'alice@test.com')
  })
})
