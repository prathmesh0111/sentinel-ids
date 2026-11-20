import { NextResponse } from 'next/server'
import { guard } from '@/lib/guard'
import { db } from '@/lib/db'

/** Credential Ledger page — all login attempts with metadata */
export async function GET(req: Request) {
  const g = await guard(req, { requireAdmin: true })
  if (!g.ok) return g.response
  const url = new URL(req.url)
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
  const outcome = url.searchParams.get('outcome') ?? 'all'

  const where: Record<string, unknown> = {}
  if (q) where.OR = [{ username: { contains: q, mode: 'insensitive' } }, { ip: { contains: q } }]
  if (outcome === 'success') where.success = true
  if (outcome === 'failed') where.success = false

  const [attempts, totals] = await Promise.all([
    db.credentialAttempt.findMany({ where, orderBy: { createdAt: 'desc' }, take: 300 }),
    db.credentialAttempt.groupBy({ by: ['success'], _count: { success: true } }),
  ])

  const successCount = totals.find((t) => t.success)?._count.success ?? 0
  const failedCount = totals.find((t) => !t.success)?._count.success ?? 0

  return NextResponse.json({ attempts, successCount, failedCount })
}
