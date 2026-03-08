import { google } from 'googleapis'
import { db } from '@/lib/db/client'
import { accounts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { ProviderAdapter, EmailMessage, SendResult, DraftResult } from './types'

type Account = typeof accounts.$inferSelect

function buildRaw(to: string, from: string, subject: string, body: string): string {
  const msg = [`To: ${to}`, `From: ${from}`, `Subject: ${subject}`,
    'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', '', body].join('\n')
  return Buffer.from(msg).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export class GmailAdapter implements ProviderAdapter {
  private account: Account
  private gmail: ReturnType<typeof google.gmail>

  constructor(account: Account) {
    this.account = account
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )
    auth.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken ?? undefined,
      expiry_date: account.expiresAt ?? undefined,
    })
    auth.on('tokens', async (tokens) => {
      const u: Partial<typeof accounts.$inferSelect> = { updatedAt: Date.now() }
      if (tokens.access_token) u.accessToken = tokens.access_token
      if (tokens.expiry_date) u.expiresAt = tokens.expiry_date
      if (tokens.refresh_token) u.refreshToken = tokens.refresh_token
      await db.update(accounts).set(u).where(eq(accounts.id, account.id))
    })
    this.gmail = google.gmail({ version: 'v1', auth })
  }

  async refreshTokenIfNeeded() {}

  async createDraft(msg: EmailMessage): Promise<DraftResult> {
    const raw = buildRaw(msg.to, this.account.email, msg.subject, msg.body)
    const r = await this.gmail.users.drafts.create({ userId: 'me', requestBody: { message: { raw } } })
    return { id: r.data.id! }
  }

  async sendEmail(msg: EmailMessage): Promise<SendResult> {
    const raw = buildRaw(msg.to, this.account.email, msg.subject, msg.body)
    const r = await this.gmail.users.messages.send({ userId: 'me', requestBody: { raw } })
    return { id: r.data.id!, threadId: r.data.threadId ?? undefined }
  }
}
