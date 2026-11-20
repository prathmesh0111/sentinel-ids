/**
 * Shared feature space for the ML models (Random Forest + Isolation Forest).
 * Features are computed from REAL live traffic state per IP — no synthetic data.
 */
export const FEATURE_NAMES = [
  'failed_logins_10m',
  'requests_1m',
  'burst_10s',
  'distinct_usernames_10m',
  'distinct_users',
  'geo_jumps_10m',
  'invalid_hits_10m',
  'avg_req_interval_ms',
  'ua_changes_10m',
  'is_private',
  'is_invalid_ip',
] as const

export type FeatureName = (typeof FEATURE_NAMES)[number]
export const FEATURE_COUNT = FEATURE_NAMES.length

export interface FeatureSource {
  failedLogins10m: number
  requests1m: number
  burst10s: number
  distinctUsernames10m: number
  distinctUsers: number
  geoJumps10m: number
  invalidHits10m: number
  avgReqIntervalMs: number
  uaChanges10m: number
  isPrivate: boolean
  isInvalid: boolean
}

export function computeFeatures(s: FeatureSource): number[] {
  return [
    s.failedLogins10m,
    s.requests1m,
    s.burst10s,
    s.distinctUsernames10m,
    s.distinctUsers,
    s.geoJumps10m,
    s.invalidHits10m,
    Math.min(60000, Math.round(s.avgReqIntervalMs)),
    s.uaChanges10m,
    s.isPrivate ? 1 : 0,
    s.isInvalid ? 1 : 0,
  ]
}
