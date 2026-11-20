/**
 * SecurityEngine — the core of the Fraud & IP Anomaly Detection System.
 *
 * Responsibilities
 *  - Tracks every client IP in-memory (sliding windows) for realtime detection
 *  - Rule-based risk scoring (brute force, DDoS/rate bursts, credential stuffing,
 *    invalid IPs, geo jumps / location spoofing)
 *  - ML blending: Random Forest (supervised) + Isolation Forest (unsupervised)
 *  - Auto-blocks IPs crossing the configured risk threshold
 *  - Buffers security events + IP stats and flushes them to PostgreSQL
 *  - Persists training samples (weak supervision from real traffic)
 *  - Maintains the process-wide blocklist used by every API route
 */
import { db } from '@/lib/db'
import { getSettings } from '@/lib/settings'
import { resolveGeo, isVpnIsp, type GeoResult } from './geo'
import { classifyIp, extractClientIp, haversineKm, type IpInfo } from './ip'
import { computeFeatures, FEATURE_NAMES, type FeatureSource } from '@/lib/ml/features'
import { mlAssess, type MlAssessment } from '@/lib/ml/infer'

/** The server's own traffic — never auto-blocked (self-DoS protection). */
export function isLoopback(ip: string): boolean {
  const v = ip.toLowerCase()
  return v === '::1' || v === '::' || v.startsWith('127.') || v === '::ffff:127.0.0.1'
}

export type EventInput = {
  ip: string
  userId?: string | null
  username?: string | null
  type: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  title: string
  details?: Record<string, unknown>
}

interface IpState {
  ip: string
  isValid: boolean
  isPrivate: boolean
  invalidReason?: string
  // sliding windows (epoch ms)
  requests: number[] // last 60s ring
  burst: number[] // last 10s ring
  failedLogins: number[] // last 10 min ring
  successLogins: number[] // last 10 min ring
  usernames: Map<string, number[]> // username -> recent attempt times
  uas: Map<string, number> // ua -> last seen (per 10m window scan)
  // persisted-style counters
  totalRequests: number
  failedLoginsTotal: number
  successLoginsTotal: number
  distinctUsers: Set<string>
  usernamesTriedTotal: Set<string>
  geoJumps: number
  // geo
  geo: GeoResult | null
  geoAt: number
  // risk
  riskScore: number
  ruleRisk: number
  mlRisk: number | null
  threatLabel: string
  status: 'ACTIVE' | 'WATCHLIST' | 'BLOCKED'
  blockedAt?: Date
  blockReason?: string
  blockedBy?: string
  lastSignals: Record<string, number>
  lastMl: MlAssessment | null
  // housekeeping
  firstSeen: number
  lastSeen: number
  lastSampleAt: number
  lastFlushed: number
  dirty: boolean
  userAgents: string // most recent full UA
}

const WINDOW_10MIN = 10 * 60 * 1000
const WINDOW_1MIN = 60 * 1000
const WINDOW_10S = 10 * 1000

function ring(arr: number[], now: number, windowMs: number): number[] {
  const cutoff = now - windowMs
  let i = 0
  while (i < arr.length && arr[i] < cutoff) i++
  if (i > 0) arr.splice(0, i)
  return arr
}

function threatLabelFor(risk: number): string {
  if (risk >= 80) return 'Critical'
  if (risk >= 55) return 'High Risk'
  if (risk >= 30) return 'Suspicious'
  return 'Clean'
}

class SecurityEngine {
  private states = new Map<string, IpState>()
  private eventBuffer: EventInput[] = []
  private blockedCache = new Set<string>()
  private blocklistLoaded = false
  private flushing = false
  private lastFlushAt = 0
  private timersStarted = false
  private geoQueue = new Set<string>()
  // per-username distributed attack tracking (location spoofing / stuffing)
  private usernameIps = new Map<string, { ips: Map<string, number[]> }>()
  // per-minute traffic aggregates for the dashboard timeline
  private trafficBuckets = new Map<string, { requests: number; blocked: number; failedLogins: number; ips: Set<string> }>()

  // ── lifecycle ──────────────────────────────────────────────────────────
  ensureTimers() {
    if (this.timersStarted) return
    this.timersStarted = true
    setInterval(() => { void this.flush() }, 2000).unref()
    setInterval(() => { void this.refreshBlocklist() }, 10_000).unref()
    setInterval(() => { void this.processGeoQueue() }, 1500).unref()
    setInterval(() => { void this.refreshBlocklist(true) }, 60_000).unref()
    void this.refreshBlocklist()
  }

  async refreshBlocklist(initial = false) {
    try {
      const rows = await db.ipAddress.findMany({
        where: { status: 'BLOCKED' },
        select: { ip: true },
      })
      const fresh = new Set(rows.map((r) => r.ip))
      if (initial) this.blocklistLoaded = true
      this.blockedCache = fresh
    } catch { /* db not ready */ }
  }

  isBlocked(ip: string): boolean {
    return this.blockedCache.has(ip)
  }

  getBlockedIps(): string[] {
    return [...this.blockedCache]
  }

  // ── state access ───────────────────────────────────────────────────────
  private async ensureState(info: IpInfo, ua: string | null): Promise<IpState> {
    let s = this.states.get(info.ip)
    if (s) {
      if (ua) s.uas.set(ua, Date.now())
      return s
    }
    const now = Date.now()
    s = {
      ip: info.ip,
      isValid: info.isValid,
      isPrivate: info.isPrivate,
      invalidReason: info.invalidReason,
      requests: [], burst: [], failedLogins: [], successLogins: [],
      usernames: new Map(), uas: new Map(),
      totalRequests: 0, failedLoginsTotal: 0, successLoginsTotal: 0,
      distinctUsers: new Set(), usernamesTriedTotal: new Set(),
      geoJumps: 0,
      geo: info.isPrivate
        ? { country: 'Local Network', region: null, city: 'Localhost', lat: null, lon: null, isp: 'Private Address', vpnSuspected: false }
        : null,
      geoAt: 0,
      riskScore: 0, ruleRisk: 0, mlRisk: null,
      threatLabel: 'Clean', status: info.isValid ? 'ACTIVE' : 'WATCHLIST',
      lastSignals: {}, lastMl: null,
      firstSeen: now, lastSeen: now, lastSampleAt: 0, lastFlushed: now,
      dirty: true,
      userAgents: ua ?? '',
    }
    if (ua) s.uas.set(ua, now)
    // hydrate from DB (restart-safe counters & status)
    try {
      const row = await db.ipAddress.findUnique({ where: { ip: info.ip } })
      if (row) {
        s.firstSeen = row.firstSeen.getTime()
        s.totalRequests = row.totalRequests
        s.failedLoginsTotal = row.failedLogins
        s.successLoginsTotal = row.successLogins
        s.geoJumps = row.geoJumps
        s.distinctUsers = new Set((row.lastSignals as { users?: string[] })?.users ?? [])
        s.usernamesTriedTotal = new Set((row.lastSignals as { usernames?: string[] })?.usernames ?? [])
        s.status = row.status as IpState['status']
        s.riskScore = row.riskScore
        s.blockedAt = row.blockedAt ?? undefined
        s.blockReason = row.blockReason ?? undefined
        s.blockedBy = row.blockedBy ?? undefined
        if (row.country) {
          s.geo = { country: row.country, region: row.region, city: row.city, lat: row.lat, lon: row.lon, isp: row.isp, vpnSuspected: isVpnIsp(row.isp) }
        }
        s.isValid = row.isValid && info.isValid
        if (s.status === 'BLOCKED') this.blockedCache.add(info.ip)
      }
    } catch { /* ignore */ }
    this.states.set(info.ip, s)
    if (!info.isPrivate && info.isValid && !s.geo) this.geoQueue.add(info.ip)
    return s
  }

  getState(ip: string): IpState | undefined { return this.states.get(ip) }
  getAllStates(): IpState[] { return [...this.states.values()] }

  private async processGeoQueue() {
    const batch = [...this.geoQueue].slice(0, 5)
    if (!batch.length) return
    for (const ip of batch) this.geoQueue.delete(ip)
    for (const ip of batch) {
      const s = this.states.get(ip)
      if (!s) continue
      try {
        const geo = await resolveGeo(ip, s.isPrivate)
        const prev = s.geo
        if (prev?.country && geo.country && prev.country !== 'Local Network' && prev.lat != null && prev.lon != null && geo.lat != null && geo.lon != null) {
          const dist = haversineKm(prev.lat, prev.lon, geo.lat, geo.lon)
          if (dist > 500 && geo.country !== prev.country) {
            s.geoJumps++
            s.dirty = true
            this.eventBuffer.push({
              ip, type: 'GEO_JUMP', severity: 'HIGH',
              title: `Location spoofing suspected: ${ip} moved ${Math.round(dist)} km (${prev.country} → ${geo.country})`,
              details: { from: prev, to: geo, distanceKm: Math.round(dist) },
            })
          }
        }
        s.geo = geo
        s.geoAt = Date.now()
        s.dirty = true
      } catch { /* ignore */ }
    }
  }

  // ── per-minute traffic accounting ──────────────────────────────────────
  private trafficTick(ip: string, kind: 'request' | 'blocked' | 'failedLogin') {
    const key = new Date().toISOString().slice(0, 16) // minute bucket
    let b = this.trafficBuckets.get(key)
    if (!b) {
      b = { requests: 0, blocked: 0, failedLogins: 0, ips: new Set() }
      this.trafficBuckets.set(key, b)
      // keep only last 5 buckets in memory
      if (this.trafficBuckets.size > 5) {
        const oldest = [...this.trafficBuckets.keys()].sort()[0]
        this.trafficBuckets.delete(oldest)
      }
    }
    if (kind === 'request') b.requests++
    if (kind === 'blocked') b.blocked++
    if (kind === 'failedLogin') b.failedLogins++
    b.ips.add(ip)
  }

  // ── request tracking (every API request) ───────────────────────────────
  async trackRequest(req: Request): Promise<{ info: IpInfo; blocked: boolean; state?: IpState }> {
    this.ensureTimers()
    const info = extractClientIp(req.headers)
    if (this.isBlocked(info.ip)) {
      const s = this.states.get(info.ip)
      // still count the blocked attempt for the record
      this.trafficTick(info.ip, 'blocked')
      this.eventBuffer.push({
        ip: info.ip, type: 'REQUEST_BLOCKED', severity: 'MEDIUM',
        title: `Blocked request rejected from ${info.ip}`,
        details: { path: new URL(req.url).pathname },
      })
      return { info, blocked: true, state: s }
    }
    const s = await this.ensureState(info, req.headers.get('user-agent'))
    const now = Date.now()
    s.lastSeen = now
    s.totalRequests++
    s.dirty = true
    ring(s.requests, now, WINDOW_1MIN).push(now)
    ring(s.burst, now, WINDOW_10S).push(now)
    this.trafficTick(info.ip, 'request')

    if (!info.isValid) {
      s.isValid = false
      ring(s.failedLogins, now, WINDOW_10MIN).push(now) // counts toward invalid escalation
      this.eventBuffer.push({
        ip: info.ip, type: 'INVALID_IP', severity: 'MEDIUM',
        title: `Invalid IP format detected: "${info.ip}" (${info.invalidReason})`,
        details: { invalidReason: info.invalidReason, path: new URL(req.url).pathname },
      })
    }
    await this.evaluate(s)
    return { info, blocked: false, state: s }
  }

  // ── login tracking ─────────────────────────────────────────────────────
  async trackLogin(opts: {
    info: IpInfo
    username: string
    success: boolean
    userId?: string | null
    reason?: string
    userAgent?: string | null
  }): Promise<IpState> {
    this.ensureTimers()
    const s = await this.ensureState(opts.info, opts.userAgent ?? null)
    const now = Date.now()
    s.lastSeen = now
    s.dirty = true
    ring(s.failedLogins, now, WINDOW_10MIN)
    ring(s.successLogins, now, WINDOW_10MIN)
    if (opts.success) {
      s.successLogins.push(now)
      s.successLoginsTotal++
      if (opts.userId) s.distinctUsers.add(opts.userId)
      this.trafficTick(s.ip, 'request')
    } else {
      s.failedLogins.push(now)
      s.failedLoginsTotal++
      this.trafficTick(s.ip, 'failedLogin')
    }
    const uname = opts.username.toLowerCase()
    s.usernamesTriedTotal.add(uname)
    const uRing = ring(s.usernames.get(uname) ?? [], now, WINDOW_10MIN)
    uRing.push(now)
    s.usernames.set(uname, uRing)

    // distributed credential attack: one username from many IPs (location spoofing)
    if (!s.isPrivate) {
      let entry = this.usernameIps.get(uname)
      if (!entry) { entry = { ips: new Map() }; this.usernameIps.set(uname, entry) }
      const ipRing = ring(entry.ips.get(s.ip) ?? [], now, WINDOW_10MIN)
      ipRing.push(now)
      entry.ips.set(s.ip, ipRing)
      const distinctIps = [...entry.ips.keys()]
      if (distinctIps.length >= 4) {
        this.eventBuffer.push({
          ip: s.ip, userId: opts.userId ?? null, username: opts.username, type: 'CREDENTIAL_STUFFING', severity: 'HIGH',
          title: `Distributed credential attack: "${opts.username}" targeted from ${distinctIps.length} different IPs / locations in 10 min`,
          details: { distinctIps: distinctIps.length, ips: distinctIps.slice(0, 12) },
        })
      }
    }

    if (!s.isValid) s.isValid = opts.info.isValid
    await this.evaluate(s)
    return s
  }

  // ── risk evaluation ────────────────────────────────────────────────────
  private featuresOf(s: IpState): FeatureSource {
    const now = Date.now()
    const intervals: number[] = []
    for (let i = 1; i < Math.min(s.requests.length, 20); i++) {
      intervals.push(s.requests[s.requests.length - i] - s.requests[s.requests.length - i - 1])
    }
    const avgReqIntervalMs = intervals.length ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 60000
    let uaChanges = 0
    const cutoff = now - WINDOW_10MIN
    for (const [ua, at] of s.uas) if (at >= cutoff) uaChanges++
    const recentUsernames = new Set<string>()
    for (const [u, times] of s.usernames) {
      const rt = ring(times, now, WINDOW_10MIN)
      if (rt.length) recentUsernames.add(u)
    }
    return {
      failedLogins10m: s.failedLogins.length,
      requests1m: s.requests.length,
      burst10s: s.burst.length,
      distinctUsernames10m: recentUsernames.size,
      distinctUsers: s.distinctUsers.size,
      geoJumps10m: Math.min(s.geoJumps, 5),
      invalidHits10m: s.isValid ? 0 : 1,
      avgReqIntervalMs,
      uaChanges10m: uaChanges,
      isPrivate: s.isPrivate,
      isInvalid: !s.isValid,
    }
  }

  private ruleSignals(f: FeatureSource, s: IpState, settings: { ddosRpm: number; bruteForceAttempts: number }): Record<string, number> {
    const failed = f.failedLogins10m
    const signals: Record<string, number> = {}
    // Credential abuse — failed logins (weight scales hard)
    signals.failed_logins = Math.min(100, failed * 12)
    // Request rate (per minute)
    signals.request_rate = Math.min(100, Math.round((f.requests1m / (2 * settings.ddosRpm)) * 100))
    // Burst (10s)
    signals.burst_rate = Math.min(100, Math.round(f.burst10s * 1.5))
    // Location spoofing — geo jumps
    signals.geo_jumps = Math.min(90, f.geoJumps10m * 30)
    // Invalid IP
    signals.invalid_ip = f.isInvalid ? 70 : 0
    // Credential stuffing — many usernames from one IP
    signals.credential_stuffing = f.distinctUsernames10m >= 5 ? Math.min(95, 30 + f.distinctUsernames10m * 6) : 0
    // Bot-like uniform request pacing (very small intervals)
    signals.bot_pacing = f.avgReqIntervalMs < 15 && f.requests1m > 30 ? 25 : 0
    // VPN / datacenter exits — real signals, weight below attack signals
    signals.vpn_hosting = s.geo?.vpnSuspected ? 35 : 0
    // Missing/odd UA
    signals.user_agent = !s.userAgents || s.userAgents.length < 10 ? 15 : 0
    return signals
  }

  private ruleScoreFrom(signals: Record<string, number>): number {
    // weighted max-combination: dominant signal + weighted contributions of the rest
    const weights: Record<string, number> = {
      failed_logins: 1.0,
      request_rate: 0.9,
      burst_rate: 0.8,
      geo_jumps: 0.8,
      invalid_ip: 0.9,
      credential_stuffing: 0.7,
      bot_pacing: 0.5,
      vpn_hosting: 0.5,
      user_agent: 0.3,
    }
    const entries = Object.entries(signals).map(([k, v]) => [k, v * (weights[k] ?? 0.5)] as const)
    entries.sort((a, b) => b[1] - a[1])
    let score = entries[0]?.[1] ?? 0
    for (let i = 1; i < entries.length; i++) {
      score += entries[i][1] * (0.35 / i) // diminishing contributions
    }
    return Math.max(0, Math.min(100, Math.round(score)))
  }

  async evaluate(s: IpState) {
    const settings = await getSettings()
    const f = this.featuresOf(s)
    const signals = this.ruleSignals(f, s, settings)
    let rule = this.ruleScoreFrom(signals)
    if (s.isPrivate && !s.isValid) rule = Math.min(100, rule) // invalid stays invalid
    else if (s.isPrivate) rule = Math.round(rule * 0.5) // internal IPs are semi-trusted
    s.ruleRisk = rule

    const x = computeFeatures(f)
    const ml = await mlAssess(x)
    s.lastMl = ml
    const rf100 = ml.rfProb ?? 0
    const if100 = ml.ifScore ?? 0
    let final: number
    if (ml.available) {
      const blended = Math.round(0.4 * rule + 0.4 * rf100 + 0.2 * if100)
      final = Math.min(100, Math.max(blended, Math.round(rule * 0.9)))
      s.mlRisk = Math.round(Math.max(rf100 * 0.67 + if100 * 0.33, blended))
    } else {
      final = rule
      s.mlRisk = null
    }
    s.riskScore = final
    s.threatLabel = threatLabelFor(final)
    s.lastSignals = signals
    s.dirty = true

    // ── event generation ─────────────────────────────────────────────────
    const bfThreshold = settings.bruteForceAttempts
    if (s.failedLogins.length >= bfThreshold) {
      this.eventBuffer.push({
        ip: s.ip, type: 'BRUTE_FORCE', severity: s.failedLogins.length >= bfThreshold * 2 ? 'CRITICAL' : 'HIGH',
        title: `Brute-force attack: ${s.failedLogins.length} failed logins in 10 min from ${s.ip}`,
        details: { failedLast10m: s.failedLogins.length, usernames: [...s.usernames.keys()].slice(-10) },
      })
    }
    if (f.requests1m >= settings.ddosRpm) {
      this.eventBuffer.push({
        ip: s.ip, type: 'DDOS_SUSPECTED', severity: f.requests1m >= settings.ddosRpm * 2 ? 'CRITICAL' : 'HIGH',
        title: `DoS/DDoS pattern: ${f.requests1m} requests/min from ${s.ip}`,
        details: { requests1m: f.requests1m, burst10s: f.burst10s },
      })
    } else if (f.burst10s >= 40) {
      this.eventBuffer.push({
        ip: s.ip, type: 'RATE_BURST', severity: 'MEDIUM',
        title: `Rate burst: ${f.burst10s} requests in 10s from ${s.ip}`,
        details: { burst10s: f.burst10s },
      })
    }
    if (f.distinctUsernames10m >= 5) {
      this.eventBuffer.push({
        ip: s.ip, type: 'CREDENTIAL_STUFFING', severity: 'HIGH',
        title: `Credential stuffing: ${f.distinctUsernames10m} distinct usernames tried from ${s.ip}`,
        details: { distinctUsernames: f.distinctUsernames10m },
      })
    }

    // ── status transitions ───────────────────────────────────────────────
    // The server's own loopback address is never auto-blocked: every console
    // request, poll and test flows through it, and blocking it would lock the
    // operator out of the product (self-DoS). It still gets flagged, scored
    // and watchlisted like any other source.
    const selfTraffic = isLoopback(s.ip)
    if (s.status !== 'BLOCKED' && final >= settings.riskThreshold && settings.autoBlock && !selfTraffic) {
      await this.blockIp(s, 'AUTO', `Risk score ${final} crossed threshold ${settings.riskThreshold}`, signals, final)
    } else if (s.status === 'ACTIVE' && final >= 55) {
      s.status = 'WATCHLIST'
      s.dirty = true
    } else if (s.status === 'WATCHLIST' && final < 40) {
      s.status = 'ACTIVE'
      s.dirty = true
    }

    // ── training sample (weak supervision from real behavior) ────────────
    const now = Date.now()
    const meaningful = s.failedLogins.length > 0 || f.requests1m >= 10 || !s.isValid || s.geoJumps > 0
    const enoughDelta = now - s.lastSampleAt > 30_000
    if (meaningful && enoughDelta) {
      s.lastSampleAt = now
      const label = this.labelFor(s, settings.riskThreshold)
      this.pushSample(x, label)
    }
  }

  private labelFor(s: IpState, threshold: number): 0 | 1 | null {
    if (s.status === 'BLOCKED' || s.riskScore >= threshold) return 1
    const now = Date.now()
    ring(s.failedLogins, now, WINDOW_10MIN)
    if (s.failedLogins.length >= 5 || !s.isValid || s.geoJumps > 0) return 1
    if (s.failedLogins.length === 0 && s.riskScore < 30 && s.requests.length < 90) return 0
    return null
  }

  pushSample(features: number[], label: 0 | 1 | null, source = 'live') {
    // buffered via eventFlushSamples
    this.sampleBuffer.push({ features, label, source, at: new Date() })
  }
  private sampleBuffer: { features: number[]; label: 0 | 1 | null; source: string; at: Date }[] = []

  // ── blocking ───────────────────────────────────────────────────────────
  async blockIp(
    s: IpState,
    by: 'AUTO' | string,
    reason: string,
    signals?: Record<string, number>,
    finalRisk?: number,
  ) {
    s.status = 'BLOCKED'
    s.blockedAt = new Date()
    s.blockReason = reason
    s.blockedBy = by
    s.dirty = true
    this.blockedCache.add(s.ip)
    const severity = by === 'AUTO' ? 'CRITICAL' : 'MEDIUM'
    this.eventBuffer.push({
      ip: s.ip,
      type: by === 'AUTO' ? 'AUTO_BLOCK' : 'MANUAL_BLOCK',
      severity,
      title: `${by === 'AUTO' ? 'Auto-blocked' : 'Manually blocked'} ${s.ip} — ${reason}`,
      details: { signals, finalRisk, threatLabel: s.threatLabel },
    })
    if (by === 'AUTO') {
      const f = this.featuresOf(s)
      this.pushSample(computeFeatures(f), 1)
    }
  }

  async unblockIp(ip: string, by: string) {
    const s = this.states.get(ip)
    this.blockedCache.delete(ip)
    this.eventBuffer.push({
      ip, type: 'MANUAL_UNBLOCK', severity: 'LOW',
      title: `${ip} unblocked by ${by}`,
    })
    if (s) {
      s.status = 'ACTIVE'
      s.blockedAt = undefined
      s.blockReason = undefined
      s.blockedBy = undefined
      s.riskScore = Math.min(s.riskScore, 45)
      s.threatLabel = threatLabelFor(s.riskScore)
      s.dirty = true
      // clear the hot windows so it doesn't instantly re-block
      s.requests = []; s.burst = []; s.failedLogins = []
    }
    await db.ipAddress.updateMany({
      where: { ip, status: 'BLOCKED' },
      data: { status: 'ACTIVE', blockedAt: null, blockReason: null, blockedBy: null, riskScore: 40, threatLabel: 'Suspicious' },
    })
    this.eventBuffer.push({ ip, type: 'AUTO_UNBLOCK', severity: 'LOW', title: `Risk counters reset for ${ip}` })
  }

  // ── persistence ────────────────────────────────────────────────────────
  async flush() {
    if (this.flushing) return
    if (this.eventBuffer.length === 0 && !this.hasDirty() && this.sampleBuffer.length === 0) {
      // still track per-minute traffic even when nothing else changed
      this.lastFlushAt = Date.now()
      return
    }
    this.flushing = true
    const events = this.eventBuffer.splice(0, this.eventBuffer.length)
    const samples = this.sampleBuffer.splice(0, this.sampleBuffer.length)
    try {
      // 1. dirty IP states → upsert
      const dirty = this.getAllStates().filter((s) => s.dirty)
      for (const s of dirty) {
        const data = {
          ip: s.ip,
          isValid: s.isValid,
          isPrivate: s.isPrivate,
          country: s.geo?.country ?? null,
          region: s.geo?.region ?? null,
          city: s.geo?.city ?? null,
          lat: s.geo?.lat ?? null,
          lon: s.geo?.lon ?? null,
          isp: s.geo?.isp ?? null,
          userAgent: s.userAgents.slice(0, 250) || null,
          lastSeen: new Date(s.lastSeen),
          totalRequests: s.totalRequests,
          failedLogins: s.failedLoginsTotal,
          successLogins: s.successLoginsTotal,
          distinctUsers: s.distinctUsers.size,
          usernamesTried: s.usernamesTriedTotal.size,
          geoJumps: s.geoJumps,
          riskScore: s.riskScore,
          threatLabel: s.threatLabel,
          status: s.status,
          blockedAt: s.blockedAt ?? null,
          blockReason: s.blockReason ?? null,
          blockedBy: s.blockedBy ?? null,
          lastSignals: {
            ...s.lastSignals,
            finalRisk: s.riskScore,
            ruleRisk: s.ruleRisk,
            mlRisk: s.mlRisk,
            users: [...s.distinctUsers].slice(0, 20),
            usernames: [...s.usernamesTriedTotal].slice(0, 30),
          },
          mlRisk: s.mlRisk,
          ruleRisk: s.ruleRisk,
        }
        await db.ipAddress.upsert({ where: { ip: s.ip }, update: data, create: { ...data, firstSeen: new Date(s.firstSeen) } })
        s.dirty = false
        s.lastFlushed = Date.now()
      }

      // 2. events
      if (events.length) {
        // dedupe repeated detection events within the same flush
        const seen = new Set<string>()
        const deduped = events.filter((e) => {
          const key = `${e.ip}|${e.type}|${e.title}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        await db.securityEvent.createMany({
          data: deduped.map((e) => ({
            ip: e.ip,
            userId: e.userId ?? null,
            username: e.username ?? null,
            type: e.type as never,
            severity: e.severity,
            title: e.title,
            details: (e.details ?? {}) as never,
          })),
          skipDuplicates: true,
        })
        void this.broadcast(deduped)
      }

      // 3. training samples
      if (samples.length) {
        await db.trainingSample.createMany({
          data: samples.map((x) => ({
            features: Object.fromEntries(FEATURE_NAMES.map((n, i) => [n, x.features[i]])) as never,
            label: x.label,
            source: x.source,
          })),
        })
      }

      // 4. per-minute traffic aggregates
      if (this.trafficBuckets.size) {
        for (const [key, b] of this.trafficBuckets) {
          const minute = new Date(`${key}:00.000Z`)
          await db.trafficMinute.upsert({
            where: { minute },
            update: {
              requests: { increment: b.requests },
              blocked: { increment: b.blocked },
              failedLogins: { increment: b.failedLogins },
            },
            create: { minute, requests: b.requests, blocked: b.blocked, failedLogins: b.failedLogins, uniqueIps: b.ips.size },
          })
          b.requests = 0
          b.blocked = 0
          b.failedLogins = 0
        }
      }
    } catch (err) {
      console.error('[engine] flush error:', err)
    } finally {
      this.flushing = false
      this.lastFlushAt = Date.now()
    }
  }

  private hasDirty(): boolean {
    return this.getAllStates().some((s) => s.dirty)
  }

  /** Push events to the socket.io stream service for realtime dashboards */
  private async broadcast(events: EventInput[]) {
    if (!events.length) return
    try {
      const controller = new AbortController()
      const t = setTimeout(() => controller.abort(), 1200)
      await fetch(`${process.env.STREAM_INTERNAL_URL ?? 'http://127.0.0.1:3003'}/emit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ events }),
        signal: controller.signal,
      }).catch(() => {})
      clearTimeout(t)
    } catch { /* stream service optional */ }
  }

  // manual event helper (used by auth, orders, admin actions)
  emit(e: EventInput) {
    this.eventBuffer.push(e)
  }

  stats() {
    const states = this.getAllStates()
    const now = Date.now()
    return {
      trackedIps: states.length,
      activeStates: states.filter((s) => s.status === 'ACTIVE').length,
      blockedCached: this.blockedCache.size,
      requestsLastMinute: states.reduce((acc, s) => acc + ring([...s.requests], now, WINDOW_1MIN).length, 0),
      bufferedEvents: this.eventBuffer.length,
      bufferedSamples: this.sampleBuffer.length,
      modelsLive: this.lastFlushAt,
    }
  }
}

const g = globalThis as unknown as { __secEngine?: SecurityEngine }
export const engine: SecurityEngine = g.__secEngine ?? new SecurityEngine()
g.__secEngine = engine

/** Convenience wrapper for API routes */
export async function securityGate(req: Request): Promise<{
  ok: boolean
  response?: Response
  info: IpInfo
}> {
  const { info, blocked } = await engine.trackRequest(req)
  // loopback is the operator's own machine — a stale block there must never
  // deadlock the console (the unblock UI itself lives behind this gate)
  if (blocked && !isLoopback(info.ip)) {
    const state = engine.getState(info.ip)
    return {
      ok: false,
      info,
      response: new Response(
        JSON.stringify({
          error: 'Your IP address has been blocked by the fraud detection system.',
          ip: info.ip,
          reason: state?.blockReason ?? 'risk threshold exceeded',
        }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      ),
    }
  }
  return { ok: true, info }
}
