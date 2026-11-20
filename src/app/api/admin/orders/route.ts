import { NextResponse } from 'next/server'
import { guard } from '@/lib/guard'
import { db } from '@/lib/db'

/** All customer orders with items, buyer and fraud-relevant metadata — admin only */
export async function GET(req: Request) {
  const g = await guard(req, { requireAdmin: true })
  if (!g.ok) return g.response

  const url = new URL(req.url)
  const status = url.searchParams.get('status') ?? ''
  const q = (url.searchParams.get('q') ?? '').trim()

  const where: Record<string, unknown> = {}
  if (status && status !== 'ALL') where.status = status
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: 'insensitive' } },
      { city: { contains: q, mode: 'insensitive' } },
      { user: { email: { contains: q, mode: 'insensitive' } } },
    ]
  }

  const [orders, statusCounts, totals] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        user: { select: { email: true, name: true } },
        items: { include: { product: { select: { image: true } } } },
      },
    }),
    db.order.groupBy({ by: ['status'], _count: { status: true } }),
    db.order.aggregate({ _sum: { total: true }, _count: { id: true } }),
  ])

  return NextResponse.json({
    orders,
    stats: {
      totalOrders: totals._count.id,
      totalRevenue: totals._sum.total ?? 0,
      byStatus: Object.fromEntries(statusCounts.map((s) => [s.status, s._count.status])),
    },
  })
}
