'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, KeyRound } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { SESSION_TOKEN_KEY } from '@/components/SessionBridge'

function RegisterForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') ?? '/'
  const [form, setForm] = useState({ name: '', email: '', password: '', adminCode: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  // admins land on the console dashboard; everyone else on their intended page
  const destination = (role?: string) => (role === 'ADMIN' ? (next.startsWith('/admin') ? next : '/admin') : next)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      })
      const j = await r.json()
      if (!r.ok) {
        setError(j.error ?? 'Registration failed')
        return
      }
      // An admin creating an account keeps their own session — nothing to swap
      if (j.keptAdminSession) {
        window.dispatchEvent(new Event('auth-changed'))
        toast({
          title: `Account created — ${j.user.email}`,
          description: 'Your admin session was preserved. The new account can sign in separately.',
        })
        router.push(next.startsWith('/admin') ? next : '/admin/users')
        router.refresh()
        return
      }
      // keep the token for iframe environments that drop cookies
      if (j.sessionToken) localStorage.setItem(SESSION_TOKEN_KEY, j.sessionToken)
      window.dispatchEvent(new Event('auth-changed'))
      toast({
        title: `Account created — welcome ${j.user.name}!`,
        description: j.user.role === 'ADMIN' ? 'Administrator access granted.' : 'Happy shopping!',
      })
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
              <h1 className="text-xl font-bold text-slate-900">Create your account</h1>
              <p className="text-xs text-slate-500 mt-1">Real account, real orders — protected by live IP risk scoring.</p>
            </div>
            <form onSubmit={submit} className="px-6 py-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" required value={form.name} onChange={set('name')} placeholder="Priya Sharma" autoComplete="name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input id="email" type="email" required value={form.email} onChange={set('email')} placeholder="you@example.com" autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" required minLength={8} value={form.password} onChange={set('password')} placeholder="At least 8 characters" autoComplete="new-password" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adminCode" className="flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-slate-400" />
                  Administrator code <span className="text-slate-400 font-normal">(optional)</span>
                </Label>
                <Input id="adminCode" value={form.adminCode} onChange={set('adminCode')} placeholder="Only for administrators" autoComplete="off" />
                <p className="text-[11px] text-slate-400">Leave empty for a normal shopping account. Admin accounts unlock the monitoring console.</p>
              </div>
              {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
              <Button type="submit" disabled={busy} className="w-full bg-zinc-900 hover:bg-zinc-700 text-white font-bold">
                {busy ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Creating…</> : 'Create account'}
              </Button>
            </form>
            <div className="px-6 pb-6 text-center text-sm text-slate-500">
              Already have an account?{' '}
              <Link href={`/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-zinc-900 font-semibold hover:underline">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-100" />}>
      <RegisterForm />
    </Suspense>
  )
}
