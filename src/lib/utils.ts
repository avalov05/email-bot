import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(timestamp: number | null | undefined): string {
  if (!timestamp) return '—'
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp))
}

export function formatRelative(timestamp: number | null | undefined): string {
  if (!timestamp) return '—'
  const now = Date.now()
  const diff = now - timestamp
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    draft: 'text-zinc-400',
    queued: 'text-blue-400',
    running: 'text-emerald-400',
    paused: 'text-amber-400',
    completed: 'text-green-400',
    failed: 'text-red-400',
    archived: 'text-zinc-500',
    pending: 'text-zinc-400',
    sending: 'text-blue-400',
    sent: 'text-green-400',
    draft_created: 'text-sky-400',
    suppressed: 'text-zinc-500',
    skipped: 'text-zinc-500',
    stopped: 'text-amber-400',
    dry_run: 'text-violet-400',
  }
  return map[status] || 'text-zinc-400'
}

export function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    draft: 'bg-zinc-800 text-zinc-300 border-zinc-700',
    queued: 'bg-blue-950 text-blue-300 border-blue-800',
    running: 'bg-emerald-950 text-emerald-300 border-emerald-800',
    paused: 'bg-amber-950 text-amber-300 border-amber-800',
    completed: 'bg-green-950 text-green-300 border-green-800',
    failed: 'bg-red-950 text-red-300 border-red-800',
    archived: 'bg-zinc-900 text-zinc-500 border-zinc-800',
    pending: 'bg-zinc-800 text-zinc-300 border-zinc-700',
    sending: 'bg-blue-950 text-blue-300 border-blue-800',
    sent: 'bg-green-950 text-green-300 border-green-800',
    draft_created: 'bg-sky-950 text-sky-300 border-sky-800',
    suppressed: 'bg-zinc-900 text-zinc-500 border-zinc-800',
    stopped: 'bg-amber-950 text-amber-300 border-amber-800',
    dry_run: 'bg-violet-950 text-violet-300 border-violet-800',
  }
  return map[status] || 'bg-zinc-800 text-zinc-300 border-zinc-700'
}
