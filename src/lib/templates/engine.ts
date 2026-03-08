export interface RecipientData {
  email: string
  first_name?: string
  last_name?: string
  company?: string
  [key: string]: string | undefined
}

export interface RenderResult {
  subject: string
  body: string
  variables: string[]
  missingVariables: string[]
}

const VARIABLE_REGEX = /\{\{([^}]+)\}\}/g

export function extractVariables(template: string): string[] {
  const matches = new Set<string>()
  const regex = new RegExp(VARIABLE_REGEX.source, 'g')
  let match: RegExpExecArray | null
  while ((match = regex.exec(template)) !== null) {
    matches.add(match[1].trim())
  }
  return Array.from(matches)
}

export function renderTemplate(template: string, data: RecipientData): { rendered: string; missing: string[] } {
  const missing: string[] = []
  const rendered = template.replace(new RegExp(VARIABLE_REGEX.source, 'g'), (_, key: string) => {
    const trimmedKey = key.trim()
    const value = data[trimmedKey]
    if (value === undefined || value === null || value === '') {
      missing.push(trimmedKey)
      return `[${trimmedKey}]`
    }
    return String(value)
  })
  return { rendered, missing }
}

export function renderEmail(
  subjectTemplate: string,
  bodyTemplate: string,
  recipient: RecipientData,
  footer?: string
): RenderResult {
  const subjectVars = extractVariables(subjectTemplate)
  const bodyVars = extractVariables(bodyTemplate)
  const allVars = Array.from(new Set([...subjectVars, ...bodyVars]))
  const { rendered: subject, missing: subjectMissing } = renderTemplate(subjectTemplate, recipient)
  const { rendered: bodyRendered, missing: bodyMissing } = renderTemplate(bodyTemplate, recipient)
  const body = footer ? `${bodyRendered}\n\n---\n${footer}` : bodyRendered
  const missingVariables = Array.from(new Set([...subjectMissing, ...bodyMissing]))
  return { subject, body, variables: allVars, missingVariables }
}

export function validateTemplate(subject: string, body: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (!subject.trim()) errors.push('Subject template is required')
  if (!body.trim()) errors.push('Body template is required')
  const unclosedSubject = subject.match(/\{\{[^}]*$/g)
  if (unclosedSubject) errors.push(`Subject has unclosed variable: ${unclosedSubject[0]}`)
  const unclosedBody = body.match(/\{\{[^}]*$/g)
  if (unclosedBody) errors.push(`Body has unclosed variable: ${unclosedBody[0]}`)
  return { valid: errors.length === 0, errors }
}
