import { NextResponse } from 'next/server'
import { guard } from '@/lib/guard'
import { registerUser, createSessionToken, setSessionCookie } from '@/lib/auth'
import { engine } from '@/lib/security/engine'

export async function POST(req: Request) {
  const g = await guard(req)
  if (!g.ok) return g.response

  try {
    const body = await req.json()
    const result = await registerUser({
      name: String(body.name ?? ''),
      email: String(body.email ?? ''),
      password: String(body.password ?? ''),
      adminCode: body.adminCode ? String(body.adminCode) : undefined,
    })

    if (!result.ok) {
      engine.emit({
        ip: g.info.ip, type: 'SIGNUP', severity: 'LOW',
        title: `Failed signup attempt from ${g.info.ip}: ${result.error}`,
        details: { email: body.email },
      })
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    engine.emit({
      ip: g.info.ip, userId: result.user.id, username: result.user.email, type: 'SIGNUP', severity: 'LOW',
      title: `New ${result.user.role === 'ADMIN' ? 'administrator' : 'customer'} account created: ${result.user.email}`,
      details: { role: result.user.role },
    })

    // An admin creating an account (e.g. a test customer) must keep their own
    // session — swapping the cookie here would silently log the admin out and
    // lock them out of the console.
    if (g.session?.role === 'ADMIN') {
      return NextResponse.json({ user: result.user, keptAdminSession: true })
    }

    const token = await createSessionToken({
      uid: result.user.id, email: result.user.email, name: result.user.name, role: result.user.role,
    })
    await setSessionCookie(token)
    // sessionToken also returned for iframe clients that cannot hold cookies
    return NextResponse.json({ user: result.user, sessionToken: token })
  } catch {
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 })
  }
}
