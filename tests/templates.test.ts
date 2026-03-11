import { describe, it, expect } from 'node:test'
import assert from 'node:assert/strict'
import { renderEmail, extractVariables, validateTemplate } from '../src/lib/templates/engine.js'

describe('Template Engine', () => {
  it('renders simple variables', () => {
    const { subject, body } = renderEmail(
      'Hello {{first_name}}',
      'Hi {{first_name}}, welcome to {{company}}!',
      { email: 'a@b.com', first_name: 'Alice', company: 'Acme' }
    )
    assert.equal(subject, 'Hello Alice')
    assert.ok(body.includes('Hi Alice, welcome to Acme!'))
  })

  it('marks missing variables in brackets', () => {
    const { subject, missingVariables } = renderEmail(
      'Hi {{first_name}}',
      'Your role: {{role}}',
      { email: 'a@b.com' }
    )
    assert.ok(subject.includes('[first_name]'))
    assert.ok(missingVariables.includes('first_name'))
    assert.ok(missingVariables.includes('role'))
  })

  it('appends footer when provided', () => {
    const { body } = renderEmail('Sub', 'Body text', { email: 'a@b.com' }, 'Footer here')
    assert.ok(body.includes('Body text'))
    assert.ok(body.includes('Footer here'))
  })

  it('extracts all variables from templates', () => {
    const vars = extractVariables('Hello {{first_name}}, at {{company}} doing {{role}}')
    assert.deepEqual(vars.sort(), ['company', 'first_name', 'role'])
  })

  it('validates empty templates', () => {
    const { valid, errors } = validateTemplate('', '')
    assert.equal(valid, false)
    assert.ok(errors.length >= 2)
  })

  it('validates unclosed variables', () => {
    const { valid, errors } = validateTemplate('Hi {{name', 'Body')
    assert.equal(valid, false)
    assert.ok(errors.some(e => e.includes('unclosed')))
  })
})
