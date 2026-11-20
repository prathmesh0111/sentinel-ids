import { NextResponse } from 'next/server'
import { guard } from '@/lib/guard'
import { db } from '@/lib/db'
import { loadModels } from '@/lib/ml/infer'

export async function GET(req: Request) {
  const g = await guard(req, { requireAdmin: true })
  if (!g.ok) return g.response

  const [artifacts, sampleStats, unconsumed] = await Promise.all([
    db.modelArtifact.findMany({ orderBy: { trainedAt: 'desc' }, take: 12 }),
    // _all counts rows with NULL labels too (_count on a column skips nulls)
    db.trainingSample.groupBy({ by: ['label'], _count: { _all: true } }),
    db.trainingSample.count({ where: { consumed: false } }),
  ])

  const attack = sampleStats.find((s) => s.label === 1)?._count._all ?? 0
  const normal = sampleStats.find((s) => s.label === 0)?._count._all ?? 0
  const unlabeled = sampleStats.find((s) => s.label === null)?._count._all ?? 0

  // live cache check
  const cache = await loadModels()
  const live = {
    rf: cache.rf ? { version: cache.rf.version, trainedAt: cache.rf.trainedAt, metrics: cache.rf.metrics } : null,
    if: cache.if ? { version: cache.if.version, trainedAt: cache.if.trainedAt, metrics: cache.if.metrics } : null,
  }

  return NextResponse.json({
    artifacts: artifacts.map((a) => ({
      id: a.id, kind: a.kind, version: a.version, trainedAt: a.trainedAt,
      samples: a.samples, attackSamples: a.attackSamples, normalSamples: a.normalSamples,
      metrics: a.metrics, active: a.active, trainingMs: a.trainingMs,
    })),
    samples: { attack, normal, unlabeled, total: attack + normal + unlabeled, unconsumed },
    live,
  })
}
