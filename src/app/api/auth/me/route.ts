import { NextResponse } from 'next/server'
import { guard } from '@/lib/guard'

export async function GET(req: Request) {
  const g = await guard(req)
  if (!g.ok) return g.response
  return NextResponse.json({ user: g.session, ip: { address: g.info.ip, isPrivate: g.info.isPrivate, isValid: g.info.isValid } })
}
