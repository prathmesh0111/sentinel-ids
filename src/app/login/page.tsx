'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { SESSION_TOKEN_KEY } from '@/components/SessionBridge'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') ?? '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // admins land on the console dashboard; everyone else on their intended page
  const destination = (role?: string) => (role === 'ADMIN' ? (next.startsWith('/admin') ? next : '/admin') : next)

  // Self-healing for cookie-blocking iframes: if a valid token is stored in
  // localStorage (e.g. the user was bounced here from /admin by the proxy),
  // verify it and go straight back where they were heading.
  useEffect(() => {
    const stored = localStorage.getItem(SESSION_TOKEN_KEY)
    if (!stored) return
    let cancelled = false
    fetch('/api/auth/me', { headers: { 'x-session-token': stored } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j?.user) {
          // a stored CUSTOMER session must never bounce into an admin page —
          // that used to create an infinite login <-> console redirect loop
          if (j.user.role !== 'ADMIN' && next.startsWith('/admin')) {
            toast({ title: 'This account is not an administrator', description: 'Sign in with an admin account to open the console.' })
            return
          }
          toast({ title: `Welcome back, ${j.user.name.split(' ')[0]}!` })
          window.dispatchEvent(new Event('auth-changed'))
          router.replace(destination(j.user.role))
          router.refresh()
        }
      })
      .catch(() => { /* ignore */ })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const j = await r.json()
      if (!r.ok) {
        setError(j.error ?? 'Sign-in failed')
        if (r.status === 403) {
          toast({ title: 'IP blocked', description: j.error, variant: 'destructive' })
        }
        return
      }
      // keep the token for iframe environments that drop cookies
      if (j.sessionToken) localStorage.setItem(SESSION_TOKEN_KEY, j.sessionToken)
      window.dispatchEvent(new Event('auth-changed'))
      toast({ title: `Welcome back, ${j.user.name.split(' ')[0]}!` })
      router.push(destination(j.user.role))
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
            <div className="px-6 pt-6 pb-2">
              <Link href="/" className="flex items-center gap-2 mb-4">
                <BrandLogo className="h-9 w-9" />
                <span className="font-bold text-lg italic text-slate-900">Secure<span className="text-zinc-900">Mart</span></span>
              </Link>
              <h1 className="text-xl font-bold text-slate-900">Sign in to your account</h1>
              <p className="text-xs text-slate-500 mt-1">Your session is protected by realtime fraud detection.</p>
            </div>
            <form onSubmit={submit} className="px-6 py-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
              </div>
              {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
              <Button type="submit" disabled={busy} className="w-full bg-zinc-900 hover:bg-zinc-700 text-white font-bold">
                {busy ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Signing in…</> : 'Sign in'}
              </Button>
            </form>
            <div className="px-6 pb-6 text-center text-sm text-slate-500">
              New to SecureMart?{' '}
              <Link href={`/register${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-zinc-900 font-semibold hover:underline">
                Create an account
              </Link>
            </div>
          </div>
          <p className="text-center text-xs text-slate-400 mt-4">
            Wrong-password attempts are recorded in the credential ledger — after repeated failures your IP may be blocked automatically.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-100" />}>
      <LoginForm />
    </Suspense>
  )
}
