/**
 * Orchestrates ML retraining:
 *  1. exports recent training samples from Postgres → ml/data/current.json
 *  2. runs 03_MACHINE_LEARNING_MODELS/model_training/train.py (scikit-learn: RandomForest + IsolationForest)
 *  3. stores the exported trees as active ModelArtifact rows
 *  4. marks samples consumed + emits ML_TRAINED event
 * Triggered by the background worker (auto) and the admin "Retrain Now" button.
 */
import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs/promises'
import { db } from '@/lib/db'
import { engine } from '@/lib/security/engine'
import { invalidateModelCache } from './infer'

const ROOT = process.cwd()
const DATA_DIR = path.join(ROOT, '04_DATASET_AND_DATA_PROCESSING', 'training_datasets')
const EXPORT_PATH = path.join(DATA_DIR, 'current.json')
const MODEL_PATH = path.join(DATA_DIR, 'model.json')
const TRAIN_SCRIPT = path.join(ROOT, '03_MACHINE_LEARNING_MODELS', 'model_training', 'train.py')

export interface TrainResult {
  ok: boolean
  error?: string
  rfTrained?: boolean
  ifTrained?: boolean
  samples?: number
  version?: number
  trainingMs?: number
}

let running: Promise<TrainResult> | null = null

export function isTraining(): boolean {
  return running != null
}

export async function retrainModels(opts: { minSamples: number; force?: boolean }): Promise<Promise<TrainResult>> {
  if (running) return running.then(() => ({ ok: false, error: 'Training already in progress' }))
  const p = runTraining(opts).finally(() => { running = null })
  running = p
  return p
}

async function runTraining(opts: { minSamples: number; force?: boolean }): Promise<TrainResult> {
  const started = Date.now()
  try {
    const samples = await db.trainingSample.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6000,
      select: { features: true, label: true },
    })
    const named = Object.keys((samples[0]?.features ?? {}) as object)
    if (samples.length < opts.minSamples) {
      return { ok: false, error: `Not enough training samples yet (${samples.length}/${opts.minSamples}). Interact with the store to accumulate real traffic samples.` }
    }
    const featureNames = named.length ? named : undefined
    const payload = {
      version: (await db.modelArtifact.aggregate({ _max: { version: true } }))._max.version ?? 0 + 1,
      featureNames,
      samples: samples.map((s) => {
        const fObj = s.features as Record<string, number>
        const f = featureNames
          ? featureNames.map((n) => Number(fObj[n] ?? 0))
          : Object.values(fObj).map(Number)
        return { f, label: s.label }
      }),
    }
    await fs.mkdir(DATA_DIR, { recursive: true })
    await fs.writeFile(EXPORT_PATH, JSON.stringify(payload))

    const res = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
      // Render images ship `python`; most systems have `python3` — detect once
      const probe = spawnSync('python3', ['--version'], { timeout: 5000 })
      const PYBIN = probe.status === 0 ? 'python3' : 'python'
      const proc = spawn(PYBIN, [TRAIN_SCRIPT, EXPORT_PATH, MODEL_PATH], {
        cwd: ROOT,
        env: process.env,
      })
      let stdout = ''
      let stderr = ''
      proc.stdout.on('data', (d) => { stdout += d })
      proc.stderr.on('data', (d) => { stderr += d })
      proc.on('error', (e) => resolve({ code: -1, stdout, stderr: stderr + String(e) }))
      const timer = setTimeout(() => { try { proc.kill('SIGKILL') } catch {} }, 120_000)
      proc.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout, stderr }) })
    })

    if (res.code !== 0) {
      return { ok: false, error: `python trainer failed: ${res.stderr.slice(0, 400) || res.stdout.slice(0, 400)}` }
    }

    const model = JSON.parse(await fs.readFile(MODEL_PATH, 'utf8'))
    const version = (await db.modelArtifact.aggregate({ _max: { version: true } }))._max.version ?? 0
    const nextVersion = version + 1
    const now = new Date()
    const marked: string[] = []

    if (model.rf) {
      marked.push('RANDOM_FOREST')
      await db.modelArtifact.updateMany({ where: { kind: 'RANDOM_FOREST' }, data: { active: false } })
      await db.modelArtifact.create({
        data: {
          kind: 'RANDOM_FOREST',
          version: nextVersion,
          samples: samples.length,
          attackSamples: samples.filter((s) => s.label === 1).length,
          normalSamples: samples.filter((s) => s.label === 0).length,
          metrics: model.rf.metrics as never,
          model: model.rf as never,
          active: true,
          trainingMs: Date.now() - started,
        },
      })
    }
    if (model.if) {
      marked.push('ISOLATION_FOREST')
      await db.modelArtifact.updateMany({ where: { kind: 'ISOLATION_FOREST' }, data: { active: false } })
      await db.modelArtifact.create({
        data: {
          kind: 'ISOLATION_FOREST',
          version: nextVersion,
          samples: model.if.metrics.trainedOn ?? samples.length,
          attackSamples: samples.filter((s) => s.label === 1).length,
          normalSamples: samples.filter((s) => s.label === 0).length,
          metrics: model.if.metrics as never,
          model: model.if as never,
          active: true,
          trainingMs: Date.now() - started,
        },
      })
    }

    // mark the exported batch as consumed
    const keepIds = samples.slice(0, samples.length - 0)
    void keepIds
    await db.trainingSample.updateMany({
      where: { consumed: false },
      data: { consumed: true },
    })

    invalidateModelCache()
    engine.emit({
      ip: 'system',
      type: 'ML_TRAINED',
      severity: 'LOW',
      title: `Models retrained (v${nextVersion}): ${marked.join(' + ') || 'none'} on ${samples.length} real samples`,
      details: { version: nextVersion, kinds: marked, samples: samples.length, rf: model.rf?.metrics ?? null, if: model.if?.metrics ?? null },
    })
    await engine.flush()

    return {
      ok: marked.length > 0,
      error: marked.length ? undefined : 'No model could be trained yet (need ≥20 labeled samples incl. both classes, ≥10 for anomaly detection)',
      rfTrained: marked.includes('RANDOM_FOREST'),
      ifTrained: marked.includes('ISOLATION_FOREST'),
      samples: samples.length,
      version: nextVersion,
      trainingMs: Date.now() - started,
    }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}
