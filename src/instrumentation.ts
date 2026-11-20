/**
 * Next.js instrumentation — starts the background security worker exactly once:
 *  - engine timers (event flush → Postgres, blocklist refresh, geo resolution)
 *  - auto-retraining checker (trains RF + IF when enough new real samples exist)
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const g = globalThis as unknown as { __secWorkerStarted?: boolean }
  if (g.__secWorkerStarted) return
  g.__secWorkerStarted = true

  const { engine } = await import('@/lib/security/engine')
  const { getSettings } = await import('@/lib/settings')
  const { retrainModels, isTraining } = await import('@/lib/ml/train')

  engine.ensureTimers()
  console.log('[worker] security engine background worker started')

  const checkRetrain = async () => {
    try {
      const settings = await getSettings()
      const unconsumed = await globalThis.__prismaCountUnconsumed()
      if (unconsumed >= settings.retrainMinSamples && !isTraining()) {
        console.log(`[worker] auto-retraining ML models (${unconsumed} new samples)...`)
        const res = await retrainModels({ minSamples: settings.retrainMinSamples, force: true })
        console.log('[worker] auto-retrain result:', JSON.stringify(res))
      }
    } catch (e) {
      console.error('[worker] retrain check failed:', e)
    }
  }

  // helper installed on globalThis by lib/db consumers? simpler: import db here
  const { db } = await import('@/lib/db')
  ;(globalThis as unknown as { __prismaCountUnconsumed: () => Promise<number> }).__prismaCountUnconsumed =
    () => db.trainingSample.count({ where: { consumed: false } })

  setInterval(() => { void checkRetrain() }, 60_000).unref()
  setTimeout(() => { void checkRetrain() }, 20_000).unref()
}
