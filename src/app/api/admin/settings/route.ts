import { NextResponse } from 'next/server'
import { guard } from '@/lib/guard'
import { getSettings, invalidateSettingsCache } from '@/lib/settings'

export async function GET(req: Request) {
  const g = await guard(req, { requireAdmin: true })
  if (!g.ok) return g.response
  const s = await getSettings(true)
  return NextResponse.json({
    settings: {
      riskThreshold: s.riskThreshold,
      autoBlock: s.autoBlock,
      ddosRpm: s.ddosRpm,
      bruteForceAttempts: s.bruteForceAttempts,
      retrainMinSamples: s.retrainMinSamples,
      retrainIntervalMin: s.retrainIntervalMin,
    },
  })
}

export async function POST(req: Request) {
  const g = await guard(req, { requireAdmin: true })
  if (!g.ok) return g.response
  const body = await req.json()
  const { db } = await import('@/lib/db')

  const updates: { key: string; value: string }[] = []
  if (body.riskThreshold != null) {
    const v = Math.max(30, Math.min(99, Number(body.riskThreshold)))
    updates.push({ key: 'RISK_THRESHOLD', value: String(v) })
  }
  if (body.autoBlock != null) updates.push({ key: 'AUTO_BLOCK_ENABLED', value: String(!!body.autoBlock) })
  if (body.ddosRpm != null) {
    const v = Math.max(30, Math.min(2000, Number(body.ddosRpm)))
    updates.push({ key: 'DDOS_RPM', value: String(v) })
  }
  if (body.bruteForceAttempts != null) {
    const v = Math.max(3, Math.min(50, Number(body.bruteForceAttempts)))
    updates.push({ key: 'BRUTE_FORCE_ATTEMPTS', value: String(v) })
  }
  if (body.retrainMinSamples != null) {
    const v = Math.max(10, Math.min(500, Number(body.retrainMinSamples)))
    updates.push({ key: 'RETRAIN_MIN_SAMPLES', value: String(v) })
  }
  for (const u of updates) {
    await db.systemSetting.upsert({ where: { key: u.key }, update: { value: u.value }, create: u })
  }
  invalidateSettingsCache()
  return NextResponse.json({ ok: true, updated: updates.length })
}
