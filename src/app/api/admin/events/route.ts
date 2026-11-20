import { NextResponse } from 'next/server'
import { guard } from '@/lib/guard'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  const g = await guard(req, { requireAdmin: true })
  if (!g.ok) return g.response
  const url = new URL(req.url)
  const limit = Math.min(100, Number(url.searchParams.get('limit') ?? 30))
  const type = url.searchParams.get('type') ?? ''
  const severity = url.searchParams.get('severity') ?? ''

  const where: Record<string, unknown> = {}
  if (type) where.type = type
  if (severity) where.severity = severity

  const events = await db.securityEvent.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit })
  return NextResponse.json({ events })
}
