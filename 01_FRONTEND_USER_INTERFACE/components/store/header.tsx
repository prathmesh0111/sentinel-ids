'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { ShieldCheck, ShoppingCart, Search, LogOut, User2, Package } from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SESSION_TOKEN_KEY } from '@/components/SessionBridge'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Me {
  uid: string
  name: string
  email: string
  role: 'USER' | 'ADMIN'
}

export function StoreHeader() {
  const router = useRouter()
  const [me, setMe] = useState<Me | null>(null)
  const [cartCount, setCartCount] = useState(0)
  // read the search term on mount (window only) — useSearchParams() here would
  // force every page embedding this header out of static prerendering
  const [q, setQ] = useState('')
  useEffect(() => {
    setQ(new URLSearchParams(window.location.search).get('q') ?? '')
  }, [])

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/auth/me', { cache: 'no-store' })
      if (r.ok) {
        const j = await r.json()
        setMe(j.user)
        if (j.user) {
          const cr = await fetch('/api/cart', { cache: 'no-store' })
          if (cr.ok) setCartCount((await cr.json()).items.length)
        }
      } else setMe(null)
    } catch { /* offline */ }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => { void refresh() }, 0)
    return () => clearTimeout(t)
  }, [refresh])

  useEffect(() => {
    const h = () => void refresh()
    window.addEventListener('cart-updated', h)
    window.addEventListener('auth-changed', h)
    return () => {
      window.removeEventListener('cart-updated', h)
      window.removeEventListener('auth-changed', h)
    }
  }, [refresh])

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    router.push(q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : '/')
  }

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    localStorage.removeItem(SESSION_TOKEN_KEY)
    window.dispatchEvent(new Event('auth-changed'))
    router.push('/')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center gap-2 sm:gap-4">
        <Link href="/" className="flex items-center gap-1.5 shrink-0 group">
          <BrandLogo className="h-9 w-9" />
          <div className="leading-none">
            <div className="font-bold text-lg italic text-slate-900 group-hover:text-zinc-900 transition-colors">
              Secure<span className="text-zinc-900">Mart</span>
            </div>
            <div className="text-[9px] text-slate-500 font-medium hidden sm:block">Fraud-protected shopping</div>
          </div>
        </Link>

        <form onSubmit={submitSearch} className="flex-1 max-w-xl hidden sm:flex">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search for products, brands and more"
              className="pl-9 bg-slate-50 border-slate-200 rounded-l-md rounded-r-none focus-visible:ring-zinc-400"
              aria-label="Search products"
            />
          </div>
          <Button type="submit" className="rounded-l-none bg-zinc-900 hover:bg-zinc-700 text-white px-5">
            Search
          </Button>
        </form>

        <div className="flex-1 sm:hidden" />

        <nav className="flex items-center gap-1.5 sm:gap-3 shrink-0" aria-label="Main">
          {me ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-1.5 text-slate-700">
                  <User2 className="h-4 w-4" />
                  <span className="hidden md:inline max-w-[120px] truncate">{me.name.split(' ')[0]}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-sm font-semibold">{me.name}</div>
                  <div className="text-xs text-slate-500 font-normal">{me.email}</div>
                  <div className="text-[10px] font-medium text-zinc-900 mt-0.5 uppercase tracking-wide">{me.role}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link href="/orders" className="cursor-pointer"><Package className="h-4 w-4 mr-2" />My Orders</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/account/security" className="cursor-pointer"><ShieldCheck className="h-4 w-4 mr-2" />My IP & Security</Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-red-600 focus:text-red-600">
                  <LogOut className="h-4 w-4 mr-2" />Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild className="bg-zinc-900 hover:bg-zinc-700 text-white font-medium">
              <Link href="/login">Login</Link>
            </Button>
          )}

          <Button asChild variant="ghost" className="gap-1.5 text-slate-700 relative">
            <Link href="/cart" aria-label="Cart">
              <ShoppingCart className="h-5 w-5" />
              <span className="hidden md:inline">Cart</span>
              {cartCount > 0 && (
                <span className="absolute -top-0.5 right-0 md:right-1 bg-zinc-500 text-white text-[10px] font-bold rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>
          </Button>
        </nav>
      </div>

      <form onSubmit={submitSearch} className="sm:hidden px-3 pb-2 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="pl-9 bg-slate-50" aria-label="Search products" />
        </div>
        <Button type="submit" size="sm" className="bg-zinc-900 hover:bg-zinc-700">Go</Button>
      </form>
    </header>
  )
}

export function StoreFooter() {
  return (
    <footer className="mt-auto bg-slate-900 text-slate-300">
      <div className="max-w-7xl mx-auto px-4 py-8 grid gap-6 sm:grid-cols-3 text-sm">
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <BrandLogo className="h-7 w-7 rounded-md" />
            <span className="font-bold text-white italic">SecureMart</span>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed">
            Every request on this store is monitored in realtime by the built-in Fraud &amp; IP Anomaly
            Detection System — risk scoring, brute-force protection, DDoS mitigation and ML-based
            anomaly detection keep your account safe.
          </p>
        </div>
        <div>
          <div className="font-semibold text-white mb-2 text-xs uppercase tracking-wider">Security</div>
          <ul className="space-y-1.5 text-xs text-slate-400">
            <li>Realtime IP risk scoring</li>
            <li>Automatic malicious IP blocking</li>
            <li>Random Forest + Isolation Forest models</li>
            <li>Credential abuse &amp; location-spoof detection</li>
          </ul>
        </div>
        <div>
          <div className="font-semibold text-white mb-2 text-xs uppercase tracking-wider">Quick Links</div>
          <ul className="space-y-1.5 text-xs">
            <li><Link href="/" className="text-slate-400 hover:text-zinc-300">Continue shopping</Link></li>
            <li><Link href="/orders" className="text-slate-400 hover:text-zinc-300">My orders</Link></li>
            <li><Link href="/account/security" className="text-slate-400 hover:text-zinc-300">My IP &amp; security</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-800 py-3 text-center text-[11px] text-slate-500">
        © {new Date().getFullYear()} SecureMart — a realtime fraud-detection demonstration store. All accounts, traffic and detections are genuine.
      </div>
    </footer>
  )
}
