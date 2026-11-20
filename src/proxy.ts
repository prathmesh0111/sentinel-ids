import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? 'securemart-fraud-detection-secret-key-2026-change-me',
)

/**
 * Proxy (middleware) — route guard.
 *
 * Design note: this proxy deliberately does NOT redirect requests that carry no
 * session cookie at all. The preview gateway embeds the app in a cross-site
 * iframe, and some browsers (Safari ITP) drop every third-party cookie — a
 * cookie-based redirect would bounce those users between /login and the target
 * page forever. Instead, protected page shells load and their client code
 * verifies the session via /api/auth/me (cookie OR x-session-token header) and
 * redirects to /login when there is no valid session. Every protected API
 * remains server-side guarded (401/403), so no data is ever exposed.
 *
 * What the proxy still enforces eagerly: a visitor presenting a VALID cookie
 * with insufficient role (USER) is bounced from /admin immediately.
 */
export async function proxy(req: NextRequest) {
  const token = req.cookies.get('sm_session')?.value
  let role: string | null = null
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret)
      role = (payload.role as string) ?? null
    } catch { /* invalid token — treated as anonymous */ }
  }

  const { pathname } = req.nextUrl
  const needsAdmin = pathname === '/admin' || pathname.startsWith('/admin/')

  // role escalation with a valid cookie is stopped right here
  if (needsAdmin && role === 'USER') {
    const url = req.nextUrl.clone()
    url.pathname = '/'
    url.searchParams.set('denied', 'admin')
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/cart', '/checkout', '/orders', '/account', '/account/:path*'],
}
