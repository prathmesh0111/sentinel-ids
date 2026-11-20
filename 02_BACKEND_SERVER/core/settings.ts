/**
 * Cached system settings (risk threshold, auto-block toggle, detection knobs).
 */
import { db } from '@/lib/db'

export interface AppSettings {
  riskThreshold: number
  autoBlock: boolean
  ddosRpm: number
  bruteForceAttempts: number
  retrainMinSamples: number
  retrainIntervalMin: number
  adminInviteCode: string
}

const DEFAULTS: AppSettings = {
  riskThreshold: 80,
  autoBlock: true,
  ddosRpm: 120,
  bruteForceAttempts: 8,
  retrainMinSamples: 30,
  retrainIntervalMin: 5,
  adminInviteCode: 'ADMIN-2026-SENTINEL',
}

const g = globalThis as unknown as { __settingsCache?: { v: AppSettings; at: number } }
const TTL = 10_000

export async function getSettings(force = false): Promise<AppSettings> {
  const hit = g.__settingsCache
  if (!force && hit && Date.now() - hit.at < TTL) return hit.v
  let settings = { ...DEFAULTS }
  try {
    const rows = await db.systemSetting.findMany()
    for (const row of rows) {
      switch (row.key) {
        case 'RISK_THRESHOLD': settings.riskThreshold = Number(row.value) || DEFAULTS.riskThreshold; break
        case 'AUTO_BLOCK_ENABLED': settings.autoBlock = row.value === 'true'; break
        case 'DDOS_RPM': settings.ddosRpm = Number(row.value) || DEFAULTS.ddosRpm; break
        case 'BRUTE_FORCE_ATTEMPTS': settings.bruteForceAttempts = Number(row.value) || DEFAULTS.bruteForceAttempts; break
        case 'RETRAIN_MIN_SAMPLES': settings.retrainMinSamples = Number(row.value) || DEFAULTS.retrainMinSamples; break
        case 'RETRAIN_INTERVAL_MIN': settings.retrainIntervalMin = Number(row.value) || DEFAULTS.retrainIntervalMin; break
        case 'ADMIN_INVITE_CODE': settings.adminInviteCode = row.value; break
      }
    }
  } catch { /* fall back to defaults */ }
  g.__settingsCache = { v: settings, at: Date.now() }
  return settings
}

export function invalidateSettingsCache() {
  g.__settingsCache = undefined
}
