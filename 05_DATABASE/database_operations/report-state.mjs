import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
;(async () => {
  const byLabel = await p.trainingSample.groupBy({ by: ['label'], _count: { label: true } })
  const total = await p.trainingSample.count()
  const artifacts = await p.modelArtifact.findMany({ where: { active: true }, select: { kind: true, version: true, samples: true, metrics: true, trainedAt: true } })
  const ips = await p.ipAddress.groupBy({ by: ['status'], _count: { status: true } })
  const users = await p.user.count()
  const orders = await p.order.count()
  const events = await p.securityEvent.groupBy({ by: ['type'], _count: { type: true }, orderBy: { _count: { type: 'desc' } } })
  console.log('TRAINING CORPUS:', total, JSON.stringify(byLabel.map((s) => ({ label: s.label, n: s._count.label }))))
  for (const a of artifacts) {
    console.log(`ACTIVE ${a.kind} v${a.version} (trained ${a.trainedAt.toISOString()}, rows ${a.samples})`)
    console.log('  metrics:', JSON.stringify(a.metrics).slice(0, 600))
  }
  console.log('IP STATUS:', JSON.stringify(ips.map((s) => ({ status: s.status, n: s._count.status }))))
  console.log('users:', users, 'orders:', orders)
  console.log('EVENTS:', events.map((e) => `${e.type}:${e._count.type}`).join(' '))
  await p.$disconnect()
})().catch((e) => { console.error(e.message); process.exit(1) })
