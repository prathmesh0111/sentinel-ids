import { NextResponse } from 'next/server'
import { guard } from '@/lib/guard'
import { authenticate, createSessionToken, setSessionCookie } from '@/lib/auth'
import { engine } from '@/lib/security/engine'
import { db } from '@/lib/db'
import { resolveGeo } from '@/lib/security/geo'
import { haversineKm } from '@/lib/security/ip'

export async function POST(req: Request) {
  const g = await guard(req)
  if (!g.ok) return g.response

  try {
    const body = await req.json()
    const email = String(body.email ?? '')
    const password = String(body.password ?? '')
    const ua = req.headers.get('user-agent')

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
    }

    const user = await authenticate(email, password)

    // The credential ledger has an FK to the IP ledger — a brand-new source whose
    // very first request is a login must get its IP row now, or the create below
    // would fail (and the failed login would escape brute-force counting).
    await db.ipAddress.upsert({
      where: { ip: g.info.ip },
      update: {},
      create: {
        ip: g.info.ip,
        isValid: g.info.isValid,
        isPrivate: g.info.isPrivate,
      },
    })

    // every attempt — success or not — goes to the credential ledger
    await db.credentialAttempt.create({
      data: {
        ip: g.info.ip,
        username: email,
        success: !!user,
        userAgent: ua,
        reason: user ? null : 'wrong-password',
      },
    })

    const state = await engine.trackLogin({
      info: g.info,
      username: email,
      success: !!user,
      userId: user?.id,
      reason: user ? undefined : 'wrong-password',
      userAgent: ua,
    })

    if (!user) {
      return NextResponse.json(
        {
          error: 'Invalid email or password.',
          security: { riskScore: state.riskScore, status: state.status },
        },
        { status: 401 },
      )
    }

    // user-level impossible-travel detection (real cross-network logins).
    // Two rules, both about PHYSICS: no human can be in two places at once.
    //   R1: distance over 500 km at implausible speed (over 700 km/h — faster
    //       than any commercial flight once airport overhead is considered)
    //   R2: ANY distance over 100 km at over 900 km/h — e.g. two logins minutes
    //       apart from neighbouring cities, which R1's distance gate would miss
    const lastLogin = await db.loginRecord.findFirst({
      where: { userId: user.id, success: true },
      orderBy: { createdAt: 'desc' },
    })
    if (lastLogin && lastLogin.ip !== g.info.ip && !state.isPrivate) {
      const prevIpRow = await db.ipAddress.findUnique({ where: { ip: lastLogin.ip } })
      if (prevIpRow?.lat != null && state.geo?.lat != null) {
        const dist = haversineKm(prevIpRow.lat, prevIpRow.lon ?? 0, state.geo.lat, state.geo.lon ?? 0)
        const hours = (Date.now() - lastLogin.createdAt.getTime()) / 3_600_000
        const velocity = dist / Math.max(hours, 0.1)
        if (dist > 500 && hours > 0 && velocity > 700) {
          engine.emit({
            ip: g.info.ip, userId: user.id, username: user.email, type: 'GEO_JUMP', severity: 'CRITICAL',
            title: `Impossible travel: ${user.email} logged in from ${state.geo.country ?? 'unknown'} (${Math.round(dist)} km from previous login in ${prevIpRow.country ?? 'unknown'})`,
            details: { distanceKm: Math.round(dist), hoursAgo: Math.round(hours * 10) / 10, velocityKmh: Math.round(velocity), rule: 'R1: 500 km + 700 km/h' },
          })
        } else if (dist > 100 && hours > 0 && velocity > 900) {
          engine.emit({
            ip: g.info.ip, userId: user.id, username: user.email, type: 'GEO_JUMP', severity: 'CRITICAL',
            title: `Impossible travel: ${user.email} in ${state.geo.country ?? 'unknown'} ${Math.round(dist)} km away only ${Math.round(hours * 60)} min after a login in ${prevIpRow.country ?? 'unknown'}`,
            details: { distanceKm: Math.round(dist), hoursAgo: Math.round(hours * 10) / 10, velocityKmh: Math.round(velocity), rule: 'R2: 100 km + 900 km/h' },
          })
        }
      }
    }

    await db.loginRecord.create({
      data: {
        userId: user.id,
        ip: g.info.ip,
        userAgent: ua,
        success: true,
        country: state.geo?.country ?? null,
        city: state.geo?.city ?? null,
      },
    })
    void resolveGeo(g.info.ip, state.isPrivate)

    if (state.status === 'BLOCKED') {
      engine.emit({
        ip: g.info.ip, userId: user.id, username: user.email, type: 'LOGIN_BLOCKED', severity: 'CRITICAL',
        title: `Blocked IP attempted login: ${user.email} from ${g.info.ip}`,
      })
      return NextResponse.json({ error: 'Your IP address has been blocked. Access denied.' }, { status: 403 })
    }

    const token = await createSessionToken({
      uid: user.id, email: user.email, name: user.name, role: user.role,
    })
    await setSessionCookie(token)
    // sessionToken also goes in the body — clients inside cookie-blocking iframes
    // persist it in localStorage and send it as x-session-token (see SessionBridge).
    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      sessionToken: token,
    })
  } catch (e) {
    console.error('[login] failed:', e)
    return NextResponse.json({ error: 'Sign-in failed. Please try again.' }, { status: 500 })
  }
}
