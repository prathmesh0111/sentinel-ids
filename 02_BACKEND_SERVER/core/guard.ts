import { NextResponse } from 'next/server'
import { securityGate, engine } from '@/lib/security/engine'
import { getSessionFromRequest, type SessionPayload } from '@/lib/auth'
import type { IpInfo } from '@/lib/security/ip'

export interface Gate {
  ok: boolean
  response?: NextResponse
  info: IpInfo
  session: SessionPayload | null
}

/** Every API route passes through the security gate + session resolution. */
export async function guard(req: Request, opts: { requireAdmin?: boolean; requireAuth?: boolean } = {}): Promise<Gate> {
  const { ok, response, info } = await securityGate(req)
  const session = await getSessionFromRequest(req)
  if (!ok) return { ok: false, response: response as NextResponse, info, session }
  if (opts.requireAdmin && session?.role !== 'ADMIN') {
    return {
      ok: false,
      info,
      session,
      response: NextResponse.json({ error: 'Administrator access required.' }, { status: session ? 403 : 401 }),
    }
  }
  if (opts.requireAuth && !session) {
    return { ok: false, info, session, response: NextResponse.json({ error: 'Please sign in.' }, { status: 401 }) }
  }
  return { ok: true, info, session }
}

export { engine }
