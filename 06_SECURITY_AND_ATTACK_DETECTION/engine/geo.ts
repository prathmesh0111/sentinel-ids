/**
 * Geo-IP resolution with DB cache + short-TTL memory cache.
 * Uses the free ip-api.com endpoint (no key) for public IPs with a hard timeout.
 * Private/loopback IPs resolve to "Local Network" — never fabricates locations.
 */
import { db } from '@/lib/db'

export interface GeoResult {
  country: string | null
  region: string | null
  city: string | null
  lat: number | null
  lon: number | null
  isp: string | null
  vpnSuspected: boolean
}

const LOCAL: GeoResult = { country: 'Local Network', region: null, city: 'Localhost', lat: null, lon: null, isp: 'Private Address', vpnSuspected: false }

/**
 * VPN / datacenter exit detection — free-tier friendly (no paid API).
 * ip-api's ISP field reveals most commercial VPN exits (M247, Datacamp,
 * Packethub are NordVPN/Surfshark/PIA exits; the cloud hosts host nearly all
 * self-hosted proxies). This is a heuristic flag, not a verdict: it raises
 * attention, and impossible-travel logic delivers the verdict.
 */
const VPN_ISP_KEYWORDS = [
  'vpn', 'nordvpn', 'expressvpn', 'surfshark', 'mullvad', 'private internet',
  'purevpn', 'ipvanish', 'cyberghost', 'hidemy', 'protonvpn', 'windscribe',
  'tunnel', 'datacamp', 'm247', 'packethub', 'layer2switch', 'aeza',
  'digitalocean', 'ovh', 'hetzner', 'linode', 'akamai', 'contabo', 'leaseweb',
  'choopa', 'vultr', 'amazon', 'google llc', 'google cloud', 'microsoft azure',
  'oracle cloud', 'alibaba', 'tencent', 'cdn77', 'tzulo', 'fibergrid',
]

export function isVpnIsp(isp: string | null | undefined): boolean {
  if (!isp) return false
  const v = isp.toLowerCase()
  return VPN_ISP_KEYWORDS.some((k) => v.includes(k))
}

const memory = new Map<string, { geo: GeoResult; at: number }>()
const MEM_TTL = 10 * 60 * 1000
const inflight = new Map<string, Promise<GeoResult>>()

export async function resolveGeo(ip: string, isPrivate: boolean): Promise<GeoResult> {
  if (isPrivate) {
    memory.set(ip, { geo: LOCAL, at: Date.now() })
    return LOCAL
  }
  const hit = memory.get(ip)
  if (hit && Date.now() - hit.at < MEM_TTL) return hit.geo

  const row = await db.ipAddress.findUnique({
    where: { ip },
    select: { country: true, region: true, city: true, lat: true, lon: true, isp: true, lastSeen: true },
  })
  if (row && row.country) {
    const geo: GeoResult = { country: row.country, region: row.region, city: row.city, lat: row.lat, lon: row.lon, isp: row.isp, vpnSuspected: isVpnIsp(row.isp) }
    memory.set(ip, { geo, at: Date.now() })
    return geo
  }

  const existing = inflight.get(ip)
  if (existing) return existing

  const p = fetchRemote(ip)
    .then((geo) => {
      memory.set(ip, { geo, at: Date.now() })
      return geo
    })
    .catch(() => ({ country: null, region: null, city: null, lat: null, lon: null, isp: null, vpnSuspected: false } satisfies GeoResult))
    .finally(() => inflight.delete(ip))
  inflight.set(ip, p)
  return p
}

async function fetchRemote(ip: string): Promise<GeoResult> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 2500)
  try {
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city,lat,lon,isp`, {
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!res.ok) return { country: null, region: null, city: null, lat: null, lon: null, isp: null, vpnSuspected: false }
    const j = (await res.json()) as Record<string, unknown>
    if (j.status !== 'success') return { country: null, region: null, city: null, lat: null, lon: null, isp: null, vpnSuspected: false }
    return {
      country: (j.country as string) ?? null,
      region: (j.regionName as string) ?? null,
      city: (j.city as string) ?? null,
      lat: typeof j.lat === 'number' ? j.lat : null,
      lon: typeof j.lon === 'number' ? j.lon : null,
      isp: (j.isp as string) ?? null,
      vpnSuspected: isVpnIsp((j.isp as string) ?? null),
    }
  } finally {
    clearTimeout(t)
  }
}
