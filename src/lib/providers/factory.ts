import { db } from '@/lib/db/client'
import { accounts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { ProviderAdapter } from './types'

export async function getProvider(accountId: string): Promise<ProviderAdapter> {
  const account = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1).then(r => r[0])
  if (!account) throw new Error(`Account ${accountId} not found`)
  if (account.provider === 'gmail') {
    const { GmailAdapter } = await import('./gmail')
    return new GmailAdapter(account)
  }
  if (account.provider === 'microsoft') {
    const { MicrosoftAdapter } = await import('./microsoft')
    return new MicrosoftAdapter(account)
  }
  throw new Error(`Unknown provider: ${account.provider}`)
}
