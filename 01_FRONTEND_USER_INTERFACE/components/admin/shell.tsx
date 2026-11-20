'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { LayoutDashboard, Fingerprint, KeySquare, Lock, Brain,
  Settings2, LogOut, Menu, Store, Wifi, WifiOff,
  Package, ShoppingBag, Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BrandLogo } from '@/components/brand-logo'
import { cn } from '@/lib/utils'
import { useSecurityStream } from '@/hooks/use-security-stream'
import { SESSION_TOKEN_KEY, sessionHeaders } from '@/components/SessionBridge'

const NAV = [
  { href: '/admin', label: 'Live Monitor', icon: LayoutDashboard },
  { href: '/admin/ips', label: 'IP Ledger', icon: Fingerprint },
  { href: '/admin/credentials', label: 'Credential Ledger', icon: KeySquare },
  { href: '/admin/access', label: 'Access Control', icon: Lock },
  { href: '/admin/models', label: 'ML Models', icon: Brain },
  { href: '/admin/settings', label: 'Settings', icon: Settings2 },
]

const STORE_NAV = [
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/admin/users', label: 'Customers', icon: Users },
]

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [me, setMe] = useState<{ name: string; email: string } | null>(null)
  const { connected: stream } = useSecurityStream(10)

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store', headers: sessionHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.user) {
          // no session at all — go sign in and come back here afterwards
          router.replace(`/login?next=${encodeURIComponent(pathname)}`)
        } else if (j.user.role !== 'ADMIN') {
          router.replace('/?denied=admin')
        } else {
          setMe(j.user)
        }
      })
      .catch(() => router.replace(`/login?next=${encodeURIComponent(pathname)}`))
  }, [router, pathname])

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    localStorage.removeItem(SESSION_TOKEN_KEY)
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-200">
      {/* top bar */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="h-14 px-3 sm:px-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="lg:hidden text-slate-300" onClick={() => setOpen(!open)} aria-label="Toggle menu">
            <Menu className="h-5 w-5" />
          </Button>
          <Link href="/admin" className="flex items-center gap-2">
            <BrandLogo className="h-8 w-8" />
            <div className="leading-none">
              <span className="font-bold italic text-white">Secure<span className="text-zinc-300">Sentinel</span></span>
              <div className="text-[9px] text-slate-500 font-medium hidden sm:block">FRAUD &amp; IP ANOMALY DETECTION CONSOLE</div>
            </div>
          </Link>
          <div className="flex-1" />
          <div className={`hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${stream ? 'border-zinc-600 text-zinc-300 bg-zinc-800' : 'border-slate-700 text-slate-500'}`}>
            {stream ? <Wifi className="h-3 w-3 animate-pulse" /> : <WifiOff className="h-3 w-3" />}
            {stream ? 'REALTIME STREAM' : 'POLLING'}
          </div>
          {me && <span className="hidden md:block text-xs text-slate-400">{me.email}</span>}
          <Button asChild variant="ghost" size="sm" className="text-slate-300">
            <Link href="/"><Store className="h-4 w-4 mr-1.5" /> Store</Link>
          </Button>
          <Button variant="ghost" size="icon" className="text-slate-300" onClick={logout} aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* sidebar */}
        <aside
          className={cn(
            'fixed lg:sticky top-14 z-40 h-[calc(100vh-3.5rem)] w-60 bg-slate-900 border-r border-slate-800 p-3 flex flex-col gap-1 transition-transform lg:translate-x-0',
            open ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          {NAV.map((n) => {
            const active = pathname === n.href
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-zinc-100 text-zinc-900 border border-zinc-100'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 border border-transparent',
                )}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
                {n.href === '/admin' && (
                  <span className="ml-auto flex h-2 w-2">
                    <span className="animate-ping absolute h-2 w-2 rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative rounded-full h-2 w-2 bg-zinc-700" />
                  </span>
                )}
              </Link>
            )
          })}
          <div className="mt-3 mb-1 px-3 text-[9px] font-bold uppercase tracking-widest text-slate-600">Store management</div>
          {STORE_NAV.map((n) => {
            const active = pathname === n.href
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-cyan-500/15 text-zinc-200 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70 border border-transparent',
                )}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            )
          })}
          <div className="mt-auto text-[10px] text-slate-600 px-3 leading-relaxed">
            PostgreSQL backend · Random Forest + Isolation Forest models · auto-block engine armed
          </div>
        </aside>

        {open && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}

        {/* content */}
        <main className="flex-1 min-w-0 p-3 sm:p-5">{children}</main>
      </div>
    </div>
  )
}

export function AdminTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-lg sm:text-xl font-bold text-white">{title}</h1>
      {subtitle && <p className="text-xs sm:text-sm text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}
