/**
 * IP extraction, validation (IPv4/IPv6), and classification.
 * "IP Verification: detection and sorting of valid vs invalid IPs."
 */

export interface IpInfo {
  ip: string
  isValid: boolean
  isPrivate: boolean
  version: 4 | 6 | null
  invalidReason?: string
}

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

export function parseIPv4(ip: string): { octets: number[] } | null {
  const m = IPV4_RE.exec(ip.trim())
  if (!m) return null
  const octets = [m[1], m[2], m[3], m[4]].map(Number)
  if (octets.some((o) => o > 255)) return null
  return { octets }
}

export function isPrivateIPv4(octets: number[]): boolean {
  const [a, b] = octets
  if (a === 10) return true // 10/8
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16/12
  if (a === 192 && b === 168) return true // 192.168/16
  if (a === 127) return true // loopback
  if (a === 169 && b === 254) return true // link-local
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a === 0) return true // this-network
  if (a >= 224) return true // multicast / reserved
  return false
}

export function isPrivateIPv6(ip: string): boolean {
  const s = ip.toLowerCase()
  if (s === '::1' || s === '::') return true
  if (s.startsWith('fc') || s.startsWith('fd')) return true // fc00::/7 unique-local
  if (s.startsWith('fe8') || s.startsWith('fe9') || s.startsWith('fea') || s.startsWith('feb')) return true // link-local
  return false
}

export function parseIPv6(ip: string): boolean {
  // Practical IPv6 validation (incl. :: compression, embedded IPv4 tail)
  if (ip.includes('%')) return false
  const parts = ip.split('::')
  if (parts.length > 2) return false
  const countColons = (s: string) => s.split(':').filter(Boolean).length
  const head = parts[0] ? parts[0].split(':').filter(Boolean) : []
  const tail = parts.length === 2 && parts[1] ? parts[1].split(':').filter(Boolean) : []
  const total = countColons(parts[0] || '') + countColons(parts[1] || '')
  if (parts.length === 1) {
    if (head.length !== 8) return false
  } else {
    if (total > 6) return false
  }
  const all = [...head, ...tail]
  for (const g of all) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) {
      if (g.includes('.') && g === all[all.length - 1] && parseIPv4(g)) continue
      return false
    }
  }
  return all.length > 0 || parts.length === 2
}

export function classifyIp(raw: string): IpInfo {
  let ip = raw.trim()
  if (!ip || ip.length > 45) {
    return { ip: ip || 'unknown', isValid: false, isPrivate: false, version: null, invalidReason: 'empty or overlong' }
  }
  // IPv4-mapped IPv6 (::ffff:a.b.c.d) — classify as the plain IPv4 address
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip)
  if (mapped) ip = mapped[1]
  const v4 = parseIPv4(ip)
  if (v4) {
    return { ip, isValid: true, isPrivate: isPrivateIPv4(v4.octets), version: 4 }
  }
  if (ip.includes(':') && parseIPv6(ip)) {
    return { ip: ip.toLowerCase(), isValid: true, isPrivate: isPrivateIPv6(ip), version: 6 }
  }
  return { ip, isValid: false, isPrivate: false, version: null, invalidReason: 'malformed address' }
}

/**
 * Extract the real client IP from proxy headers.
 * The gateway (Caddy) sets X-Forwarded-For to the true remote host.
 * NOTE: XFF is read left-to-right; the FIRST entry is the originating client.
 */
export function extractClientIp(headers: Headers, fallback = '127.0.0.1'): IpInfo {
  const xff = headers.get('x-forwarded-for')
  const xreal = headers.get('x-real-ip')
  const cf = headers.get('cf-connecting-ip')
  const raw =
    (xff ? xff.split(',')[0].trim() : undefined) ??
    cf ??
    xreal ??
    fallback
  return classifyIp(raw)
}

/** Haversine distance in km between two geo points */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
