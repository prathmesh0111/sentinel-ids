/**
 * Authentication — real accounts, bcrypt-hashed passwords, JWT session cookies.
 * Admin role is granted ONLY with the secret invitation code (no fake admins).
 */
import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { getSettings } from '@/lib/settings'

export const SESSION_COOKIE = 'sm_session'
const SESSION_DAYS = 7

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? 'securemart-fraud-detection-secret-key-2026-change-me',
)

export interface SessionPayload {
  uid: string
  email: string
  name: string
  role: 'USER' | 'ADMIN'
}

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10)
}
export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash)
}

export async function createSessionToken(p: SessionPayload): Promise<string> {
  return new SignJWT({ ...p })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret)
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    if (!payload.uid || !payload.role) return null
    return { uid: payload.uid as string, email: payload.email as string, name: payload.name as string, role: payload.role as 'USER' | 'ADMIN' }
  } catch {
    return null
  }
}

export async function setSessionCookie(token: string) {
  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    // The preview gateway embeds the app in a cross-site iframe — Lax cookies are
    // discarded there. SameSite=None; Secure is the only combination that survives.
    sameSite: 'none',
    secure: true,
    maxAge: SESSION_DAYS * 24 * 3600,
    path: '/',
  })
}

export async function clearSessionCookie() {
  const jar = await cookies()
  jar.delete(SESSION_COOKIE)
}

/** For server components */
export async function getSessionUser(): Promise<SessionPayload | null> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null
  return verifySessionToken(token)
}

/** For API routes — reads from the Request */
export async function getSessionFromRequest(req: Request): Promise<SessionPayload | null> {
  // Fallback: browsers with third-party-cookie restrictions (e.g. Safari ITP) drop
  // cookies inside iframes; the client then sends the token via a custom header.
  const hdr = req.headers.get('x-session-token')
  if (hdr) {
    const viaHeader = await verifySessionToken(decodeURIComponent(hdr))
    if (viaHeader) return viaHeader
  }
  const cookieHeader = req.headers.get('cookie') ?? ''
  const m = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))
  if (!m) return null
  return verifySessionToken(decodeURIComponent(m[1]))
}

export async function requireAdmin(req: Request): Promise<SessionPayload | null> {
  const s = await getSessionFromRequest(req)
  return s?.role === 'ADMIN' ? s : null
}

export async function registerUser(opts: {
  name: string
  email: string
  password: string
  adminCode?: string
}): Promise<{ ok: true; user: { id: string; name: string; email: string; role: 'USER' | 'ADMIN' } } | { ok: false; error: string }> {
  const name = opts.name.trim()
  const email = opts.email.trim().toLowerCase()
  if (name.length < 2) return { ok: false, error: 'Please enter your full name.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { ok: false, error: 'Please enter a valid email address.' }
  if (opts.password.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' }

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) return { ok: false, error: 'An account with this email already exists. Please sign in.' }

  const settings = await getSettings(true)
  const role: 'USER' | 'ADMIN' = opts.adminCode && opts.adminCode === settings.adminInviteCode ? 'ADMIN' : 'USER'
  const passwordHash = await hashPassword(opts.password)
  const user = await db.user.create({ data: { name, email, passwordHash, role } })
  return { ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } }
}

export async function authenticate(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } })
  if (!user) return null
  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) return null
  return user
}
