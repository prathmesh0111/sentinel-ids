import { NextResponse } from 'next/server'
import { guard } from '@/lib/guard'
import { db } from '@/lib/db'

/** User-side "My IP & Security" data — the User Module requirement */
export async function GET(req: Request) {
  const g = await guard(req, { requireAuth: true })
  if (!g.ok) return g.response
  const uid = g.session!.uid

  const myIpRow = await db.ipAddress.findUnique({ where: { ip: g.info.ip } })
  const logins = await db.loginRecord.findMany({
    where: { userId: uid },
    orderBy: { createdAt: 'desc' },
    take: 15,
  })
  const myEvents = await db.securityEvent.findMany({
    where: { userId: uid },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })
  const credentialTries = await db.credentialAttempt.count({ where: { username: g.session!.email } })

  return NextResponse.json({
    me: g.session,
    myIp: {
      address: g.info.ip,
      isValid: myIpRow?.isValid ?? g.info.isValid,
      isPrivate: myIpRow?.isPrivate ?? g.info.isPrivate,
      country: myIpRow?.country ?? null,
      city: myIpRow?.city ?? null,
      isp: myIpRow?.isp ?? null,
      riskScore: myIpRow?.riskScore ?? 0,
      threatLabel: myIpRow?.threatLabel ?? 'Clean',
      status: myIpRow?.status ?? 'ACTIVE',
      firstSeen: myIpRow?.firstSeen ?? null,
      totalRequests: myIpRow?.totalRequests ?? 0,
    },
    logins,
    events: myEvents,
    credentialTries,
  })
}
