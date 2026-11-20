import { NextResponse } from 'next/server'
import { guard, engine } from '@/lib/guard'
import { isLoopback } from '@/lib/security/engine'
import { db } from '@/lib/db'

/** Access Control actions: block / unblock any IP manually */
export async function POST(req: Request) {
  const g = await guard(req, { requireAdmin: true })
  if (!g.ok) return g.response
  const body = await req.json()
  const action = String(body.action ?? '')
  const ip = String(body.ip ?? '').trim()
  if (!ip) return NextResponse.json({ error: 'IP address required' }, { status: 400 })

  // Blocking the server's own address would 403 every request from this
  // machine — including the Access Control page you'd need to undo it.
  if (action === 'block' && isLoopback(ip)) {
    return NextResponse.json(
      { error: `${ip} is this server's own address. Blocking it would lock the console (and you) out — refused.` },
      { status: 400 },
    )
  }

  if (action === 'block') {
    let state = engine.getState(ip)
    if (!state) {
      // ensure an IP row exists even if we never saw it
      await db.ipAddress.upsert({
        where: { ip },
        update: { status: 'BLOCKED', blockedAt: new Date(), blockReason: 'Blocked manually by admin', blockedBy: g.session!.email },
        create: { ip, status: 'BLOCKED', blockedAt: new Date(), blockReason: 'Blocked manually by admin', blockedBy: g.session!.email, riskScore: 60, threatLabel: 'High Risk' },
      })
      await engine.refreshBlocklist()
      engine.emit({ ip, type: 'MANUAL_BLOCK', severity: 'MEDIUM', title: `${ip} manually blocked by ${g.session!.email}` })
      return NextResponse.json({ ok: true, action: 'block' })
    }
    await engine.blockIp(state, g.session!.email, `Blocked manually by ${g.session!.email}`)
    await engine.flush()
    return NextResponse.json({ ok: true, action: 'block' })
  }

  if (action === 'unblock') {
    await engine.unblockIp(ip, g.session!.email)
    await engine.flush()
    return NextResponse.json({ ok: true, action: 'unblock' })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
