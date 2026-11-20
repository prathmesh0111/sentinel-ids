import { NextResponse } from 'next/server'
import { guard } from '@/lib/guard'
import { clearSessionCookie } from '@/lib/auth'

export async function POST(req: Request) {
  await guard(req)
  await clearSessionCookie()
  return NextResponse.json({ ok: true })
}
