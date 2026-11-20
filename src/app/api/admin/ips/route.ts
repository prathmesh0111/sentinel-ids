import { NextResponse } from 'next/server'
import { guard } from '@/lib/guard'
import { db } from '@/lib/db'

/** Credential Ledger — every tracked IP with its metadata, plus optional credential history */
export async function GET(req: Request) {
  const g = await guard(req, { requireAdmin: true })
  if (!g.ok) return g.response
  const url = new URL(req.url)
  const q = (url.searchParams.get('q') ?? '').trim()
  const filter = url.searchParams.get('filter') ?? 'all' // all | blocked | watchlist | active | valid | invalid
  const sort = url.searchParams.get('sort') ?? 'risk'
  const withCredentials = url.searchParams.get('credentials') === '1'

  const where: Record<string, unknown> = {}
  if (q) where.ip = { contains: q }
  switch (filter) {
    case 'blocked': where.status = 'BLOCKED'; break
    case 'watchlist': where.status = 'WATCHLIST'; break
    case 'active': where.status = 'ACTIVE'; break
    case 'valid': where.isValid = true; break
    case 'invalid': where.isValid = false; break
  }

  const orderBy =
    sort === 'risk' ? { riskScore: 'desc' as const }
    : sort === 'recent' ? { lastSeen: 'desc' as const }
    : sort === 'requests' ? { totalRequests: 'desc' as const }
    : sort === 'failed' ? { failedLogins: 'desc' as const }
    : { firstSeen: 'desc' as const }

  const ips = await db.ipAddress.findMany({
    where,
    orderBy: [orderBy, { lastSeen: 'desc' }],
    take: 300,
  })

  let credentials: Record<string, { username: string; success: boolean; at: Date; reason: string | null }[]> = {}
  if (withCredentials) {
    const attempts = await db.credentialAttempt.findMany({ orderBy: { createdAt: 'desc' }, take: 400 })
    for (const a of attempts) {
      if (!credentials[a.ip]) credentials[a.ip] = []
      if (credentials[a.ip].length < 8) {
        credentials[a.ip].push({ username: a.username, success: a.success, at: a.createdAt, reason: a.reason })
      }
    }
  }

  return NextResponse.json({ ips, credentials })
}
