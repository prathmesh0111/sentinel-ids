'use client'

/**
 * SessionBridge — keeps the session alive inside cross-site iframes.
 *
 * The preview gateway embeds this app in an iframe. Browsers restrict third-party
 * cookies to different degrees (Chrome blocks Lax cookies, Safari's ITP blocks all
 * third-party cookies). When the session cookie is dropped, every server request
 * looks logged-out even though authentication succeeded.
 *
 * Mitigation: login/register responses include `sessionToken`. This bridge stores
 * it in localStorage and transparently attaches it as `x-session-token` to every
 * same-origin /api/ fetch. The server accepts either the cookie or the header
 * (see getSessionFromRequest in src/lib/auth.ts).
 */
import { useEffect } from 'react'

export const SESSION_TOKEN_KEY = 'sm_session_token'

/** Headers that carry the stored session for cookie-less environments (iframes/ITP). */
export function sessionHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const token = localStorage.getItem(SESSION_TOKEN_KEY)
  return token ? { 'x-session-token': token } : {}
}

export function sessionFetchPatch() {
  if (typeof window === 'undefined') return
  const w = window as typeof window & { __smFetchPatched?: boolean }
  if (w.__smFetchPatched) return
  w.__smFetchPatched = true
  const orig = window.fetch.bind(window)
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
      const sameOriginApi = url.startsWith('/api/') || url.startsWith(`${window.location.origin}/api/`)
      if (sameOriginApi) {
        const token = localStorage.getItem(SESSION_TOKEN_KEY)
        if (token) {
          const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
          if (!headers.has('x-session-token')) headers.set('x-session-token', token)
          return orig(input, { ...init, headers, credentials: init?.credentials ?? 'include' })
        }
      }
      return orig(input, init)
    } catch {
      return orig(input, init)
    }
  }
}

export default function SessionBridge() {
  useEffect(() => {
    sessionFetchPatch()
    // validate any stored token once per load; drop it if the server rejects it
    const token = localStorage.getItem(SESSION_TOKEN_KEY)
    if (token) {
      fetch('/api/auth/me', { headers: { 'x-session-token': token } })
        .then((r) => { if (!r.ok) localStorage.removeItem(SESSION_TOKEN_KEY) })
        .catch(() => { /* offline — keep token */ })
    }
  }, [])
  return null
}
