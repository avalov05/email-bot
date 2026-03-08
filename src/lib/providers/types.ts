export interface EmailMessage {
  to: string
  subject: string
  body: string
}

export interface SendResult {
  id: string
  threadId?: string
}

export interface DraftResult {
  id: string
}

export interface ProviderAdapter {
  createDraft(message: EmailMessage): Promise<DraftResult>
  sendEmail(message: EmailMessage): Promise<SendResult>
  refreshTokenIfNeeded(): Promise<void>
}
