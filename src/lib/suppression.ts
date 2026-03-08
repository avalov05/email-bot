import { db } from '@/lib/db/client'
import { suppressionList } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

export async function isSuppress(email: string): Promise<boolean> {
  const entry = await db.select().from(suppressionList)
    .where(eq(suppressionList.email, email.toLowerCase().trim())).limit(1)
  return entry.length > 0
}

export async function addToSuppressionList(email: string, reason: string, campaignId?: string) {
  try {
    await db.insert(suppressionList).values({
      id: uuidv4(), email: email.toLowerCase().trim(),
      reason, campaignId: campaignId ?? null, addedAt: Date.now(),
    }).onConflictDoNothing()
  } catch {}
}

export async function removeFromSuppressionList(email: string) {
  await db.delete(suppressionList).where(eq(suppressionList.email, email.toLowerCase().trim()))
}

export async function getSuppressionList() {
  return db.select().from(suppressionList).orderBy(suppressionList.addedAt)
}
