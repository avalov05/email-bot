import { Client } from '@microsoft/microsoft-graph-client'
import { db } from '@/lib/db/client'
import { accounts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { ProviderAdapter, EmailMessage, SendResult, DraftResult } from './types'

type Account = typeof accounts.$inferSelect

export class MicrosoftAdapter implements ProviderAdapter {
  private account: Account
  private client: Client

  constructor(account: Account) {
    this.account = account
    this.client = this.makeClient(account.accessToken)
  }

  private makeClient(token: string) {
    return Client.init({ authProvider: (done) => done(null, token) })
  }

  async refreshTokenIfNeeded() {
    if (!this.account.expiresAt || Date.now() < this.account.expiresAt - 60000) return
    const params = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID || '',
      client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
      refresh_token: this.account.refreshToken || '',
      grant_type: 'refresh_token',
      scope: 'Mail.ReadWrite Mail.Send offline_access',
    })
    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', { method: 'POST', body: params })
    if (!res.ok) throw new Error('Failed to refresh Microsoft token')
    const data = await res.json()
    const now = Date.now()
    const u = { accessToken: (data as Record<string,string>).access_token, refreshToken: (data as Record<string,string>).refresh_token || this.account.refreshToken, expiresAt: now + (data as Record<string,number>).expires_in * 1000, updatedAt: now }
    await db.update(accounts).set(u).where(eq(accounts.id, this.account.id))
    this.account = { ...this.account, ...u }
    this.client = this.makeClient(this.account.accessToken)
  }

  async createDraft(msg: EmailMessage): Promise<DraftResult> {
    await this.refreshTokenIfNeeded()
    const draft = await this.client.api('/me/messages').post({
      subject: msg.subject, body: { contentType: 'Text', content: msg.body },
      toRecipients: [{ emailAddress: { address: msg.to } }], isDraft: true,
    })
    return { id: draft.id }
  }

  async sendEmail(msg: EmailMessage): Promise<SendResult> {
    await this.refreshTokenIfNeeded()
    const draft = await this.client.api('/me/messages').post({
      subject: msg.subject, body: { contentType: 'Text', content: msg.body },
      toRecipients: [{ emailAddress: { address: msg.to } }],
    })
    await this.client.api(`/me/messages/${draft.id}/send`).post({})
    return { id: draft.id }
  }
}
