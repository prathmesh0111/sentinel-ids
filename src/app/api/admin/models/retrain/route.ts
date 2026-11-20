import { NextResponse } from 'next/server'
import { guard } from '@/lib/guard'
import { retrainModels, isTraining } from '@/lib/ml/train'
import { getSettings } from '@/lib/settings'

export async function POST(req: Request) {
  const g = await guard(req, { requireAdmin: true })
  if (!g.ok) return g.response
  if (isTraining()) return NextResponse.json({ ok: false, error: 'Training is already in progress.' }, { status: 409 })

  const settings = await getSettings(true)
  const result = await retrainModels({ minSamples: settings.retrainMinSamples, force: true })
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
