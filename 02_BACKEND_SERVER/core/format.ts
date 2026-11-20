/** Money is stored in paise — format like Flipkart (₹ with Indian grouping) */
export function formatINR(paise: number): string {
  return '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

export function discountPercent(price: number, mrp: number): number {
  if (mrp <= price) return 0
  return Math.round(((mrp - price) / mrp) * 100)
}

export function timeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const secs = Math.floor((Date.now() - d.getTime()) / 1000)
  if (secs < 5) return 'just now'
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

export const SEVERITY_COLORS: Record<string, string> = {
  LOW: 'bg-slate-700/15 text-slate-300 border-slate-600/40',
  MEDIUM: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  HIGH: 'bg-orange-600/15 text-orange-300 border-orange-600/40',
  CRITICAL: 'bg-red-600/15 text-red-300 border-red-600/50',
}

export const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-zinc-800 text-zinc-200 border-zinc-600',
  WATCHLIST: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  BLOCKED: 'bg-red-600/15 text-red-300 border-red-600/50',
}
