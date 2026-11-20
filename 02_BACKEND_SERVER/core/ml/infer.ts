/**
 * In-process inference for the two trained models:
 *  - Random Forest  → supervised P(attack) from exported sklearn trees
 *  - Isolation Forest → unsupervised anomaly score from path lengths
 * Models are trained by ml/train.py (scikit-learn) on real accumulated traffic
 * and stored as JSON in the ModelArtifact table.
 */
import { db } from '@/lib/db'
import { FEATURE_COUNT } from './features'

export interface RFNode {
  f: number[] // split feature index (-1 = leaf)
  t: number[] // threshold
  l: number[] // left child
  r: number[] // right child
  p: number[][] // class probabilities at each node
}
export interface RFModel {
  classes: number[]
  trees: RFNode[]
  metrics: Record<string, number>
  version: number
  trainedAt: string
}
export interface IFNode {
  f: number[]
  t: number[]
  l: number[]
  r: number[]
}
export interface IFModel {
  nSamples: number
  trees: IFNode[]
  metrics: Record<string, number>
  version: number
  trainedAt: string
}

interface Cache {
  rf?: RFModel
  if?: IFModel
  loadedAt: number
}

const g = globalThis as unknown as { __mlCache?: Cache }
const CACHE_TTL = 30_000

export async function loadModels(force = false): Promise<Cache> {
  if (!g.__mlCache) g.__mlCache = { loadedAt: 0 }
  const cache = g.__mlCache
  if (!force && Date.now() - cache.loadedAt < CACHE_TTL) return cache
  try {
    const rows = await db.modelArtifact.findMany({
      where: { active: true },
      orderBy: { trainedAt: 'desc' },
    })
    for (const row of rows) {
      if (row.kind === 'RANDOM_FOREST') cache.rf = row.model as unknown as RFModel
      if (row.kind === 'ISOLATION_FOREST') cache.if = row.model as unknown as IFModel
    }
    cache.loadedAt = Date.now()
  } catch {
    // DB not ready yet — keep empty cache
  }
  return cache
}

export function invalidateModelCache() {
  if (g.__mlCache) g.__mlCache.loadedAt = 0
}

/** Random Forest probability of "attack" (class 1) */
export function rfPredictAttackProb(model: RFModel, x: number[]): number {
  const attackIdx = model.classes.indexOf(1)
  if (attackIdx === -1) return 0
  let sum = 0
  for (const tree of model.trees) {
    let node = 0
    while (tree.f[node] !== -1) {
      node = x[tree.f[node]] <= tree.t[node] ? tree.l[node] : tree.r[node]
    }
    sum += tree.p[node][attackIdx] ?? 0
  }
  return model.trees.length ? sum / model.trees.length : 0
}

/** Isolation Forest anomaly score in [0,1] */
export function ifAnomalyScore(model: IFModel, x: number[]): number {
  if (!model.trees.length) return 0
  const n = model.nSamples
  const c = (size: number) =>
    size <= 1 ? 0 : 2 * (Math.log(size - 1) + 0.5772156649) - (2 * (size - 1)) / size
  const cn = c(n) || 1
  let sum = 0
  for (const tree of model.trees) {
    let node = 0
    let depth = 0
    while (tree.f[node] !== -1) {
      node = x[tree.f[node]] <= tree.t[node] ? tree.l[node] : tree.r[node]
      depth++
    }
    sum += depth
  }
  const avgDepth = sum / model.trees.length
  return Math.pow(2, -avgDepth / cn)
}

export interface MlAssessment {
  available: boolean
  rfProb: number | null // 0..100
  ifScore: number | null // 0..100
}

/** Run both models if present; returns nulls when models are not trained yet */
export async function mlAssess(x: number[]): Promise<MlAssessment> {
  if (x.length !== FEATURE_COUNT) return { available: false, rfProb: null, ifScore: null }
  const { rf, if: iso } = await loadModels()
  let rfProb: number | null = null
  let ifScore: number | null = null
  try {
    if (rf) rfProb = Math.round(rfPredictAttackProb(rf, x) * 1000) / 10
    if (iso) {
      const raw = ifAnomalyScore(iso, x)
      // calibrate: 0.40 → 0, 0.72 → 100
      ifScore = Math.max(0, Math.min(100, Math.round(((raw - 0.4) / 0.32) * 1000) / 10))
    }
  } catch {
    return { available: false, rfProb: null, ifScore: null }
  }
  return { available: rf != null || iso != null, rfProb, ifScore }
}
