import { NextResponse } from 'next/server'
import { guard, engine } from '@/lib/guard'
import { db } from '@/lib/db'

/** Live monitoring overview — everything the dashboard needs in one call */
export async function GET(req: Request) {
  const g = await guard(req, { requireAdmin: true })
  if (!g.ok) return g.response
  const now = Date.now()

  const [ipCount, blockedCount, watchCount, invalidCount, eventCount24h, attackCount24h, sampleCount, activeModels, lastMinTraffic] = await Promise.all([
    db.ipAddress.count(),
    db.ipAddress.count({ where: { status: 'BLOCKED' } }),
    db.ipAddress.count({ where: { status: 'WATCHLIST' } }),
    db.ipAddress.count({ where: { isValid: false } }),
    db.securityEvent.count({ where: { createdAt: { gte: new Date(now - 24 * 3600_000) } } }),
    db.securityEvent.count({
      where: {
        createdAt: { gte: new Date(now - 24 * 3600_000) },
        type: { in: ['BRUTE_FORCE', 'DDOS_SUSPECTED', 'CREDENTIAL_STUFFING', 'GEO_JUMP', 'INVALID_IP', 'AUTO_BLOCK', 'RATE_BURST'] },
      },
    }),
    db.trainingSample.count(),
    db.modelArtifact.findMany({ where: { active: true }, select: { kind: true, version: true, trainedAt: true, metrics: true } }),
    db.trafficMinute.findMany({ where: { minute: { gte: new Date(now - 60_000) } } }),
  ])

  // top-risk IPs
  const topRisk = await db.ipAddress.findMany({
    orderBy: [{ riskScore: 'desc' }, { lastSeen: 'desc' }],
    take: 8,
    select: { ip: true, riskScore: true, threatLabel: true, status: true, country: true, city: true, failedLogins: true, totalRequests: true, isValid: true },
  })

  // severity distribution (24h)
  const severityCounts = await db.securityEvent.groupBy({
    by: ['severity'],
    where: { createdAt: { gte: new Date(now - 24 * 3600_000) } },
    _count: { severity: true },
  })

  // attack vector breakdown (24h)
  const typeCounts = await db.securityEvent.groupBy({
    by: ['type'],
    where: {
      createdAt: { gte: new Date(now - 24 * 3600_000) },
      type: { in: ['BRUTE_FORCE', 'DDOS_SUSPECTED', 'CREDENTIAL_STUFFING', 'GEO_JUMP', 'INVALID_IP', 'AUTO_BLOCK', 'RATE_BURST', 'LOGIN_FAILED'] },
    },
    _count: { type: true },
  })

  // requests per minute — last 30 minutes from TrafficMinute buckets
  const minutes = await db.trafficMinute.findMany({
    where: { minute: { gte: new Date(now - 30 * 60_000) } },
    orderBy: { minute: 'asc' },
  })

  // live geo distribution
  const geoDist = await db.ipAddress.groupBy({
    by: ['country'],
    where: { country: { not: null } },
    _count: { country: true },
  })

  const stats = engine.stats()

  // store side — orders, revenue, catalog health
  const [orderCount24h, revenueAgg, lowStock, userCount, productCount] = await Promise.all([
    db.order.count({ where: { createdAt: { gte: new Date(now - 24 * 3600_000) } } }),
    db.order.aggregate({ where: { status: { not: 'CANCELLED' } }, _sum: { total: true }, _count: { id: true } }),
    db.product.count({ where: { stock: { lt: 10 } } }),
    db.user.count(),
    db.product.count(),
  ])

  return NextResponse.json({
    cards: {
      trackedIps: ipCount,
      blockedIps: blockedCount,
      watchlistIps: watchCount,
      invalidIps: invalidCount,
      events24h: eventCount24h,
      attacks24h: attackCount24h,
      trainingSamples: sampleCount,
      requestsLastMinute: lastMinTraffic.reduce((a, t) => a + t.requests, 0) || stats.requestsLastMinute,
      liveTracked: stats.trackedIps,
    },
    store: {
      orders24h: orderCount24h,
      totalOrders: revenueAgg._count.id,
      revenue: revenueAgg._sum.total ?? 0,
      lowStock,
      customers: userCount,
      products: productCount,
    },
    models: activeModels,
    topRisk,
    severityCounts: severityCounts.map((s) => ({ severity: s.severity, count: s._count.severity })),
    typeCounts: typeCounts.map((t) => ({ type: t.type, count: t._count.type })),
    timeline: minutes.map((m) => ({ minute: m.minute, requests: m.requests, blocked: m.blocked, failedLogins: m.failedLogins })),
    geoDist: geoDist.map((x) => ({ country: x.country ?? 'Unknown', count: x._count.country })),
  })
}
