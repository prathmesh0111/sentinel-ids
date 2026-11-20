'use client'

import { useEffect, useState, useCallback } from 'react'
import { ShoppingBag, IndianRupee, Truck, Search, Loader2, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { AdminTitle } from '@/components/admin/shell'
import { formatINR, timeAgo } from '@/lib/format'
import { toast } from '@/hooks/use-toast'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

interface OrderItem {
  id: string
  name: string
  price: number
  quantity: number
  product?: { image: string } | null
}
interface Order {
  id: string
  total: number
  status: string
  paymentMethod: string
  fullName: string
  phone: string
  addressLine: string
  city: string
  state: string
  pincode: string
  ip: string | null
  createdAt: string
  user: { email: string; name: string }
  items: OrderItem[]
}

const FLOW = ['PLACED', 'PACKED', 'SHIPPED', 'DELIVERED'] as const

const STATUS_STYLE: Record<string, string> = {
  PLACED: 'bg-zinc-700/40 text-zinc-200 border-zinc-600/60',
  PACKED: 'bg-zinc-700/40 text-zinc-200 border-zinc-600/60',
  SHIPPED: 'bg-zinc-700/40 text-zinc-200 border-zinc-600/60',
  DELIVERED: 'bg-zinc-800 text-zinc-200 border-zinc-600',
  CANCELLED: 'bg-red-600/15 text-red-300 border-red-600/50',
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [stats, setStats] = useState<{ totalOrders: number; totalRevenue: number; byStatus: Record<string, number> } | null>(null)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('ALL')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(() => {
    const params = new URLSearchParams({ q, status })
    fetch(`/api/admin/orders?${params}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j) { setOrders(j.orders); setStats(j.stats) }
      })
      .catch(() => {})
  }, [q, status])

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, q])

  const setStatusFor = async (id: string, next: string) => {
    setBusyId(id)
    try {
      const r = await fetch(`/api/admin/orders/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const j = await r.json().catch(() => ({}))
      if (r.ok) {
        toast({ title: `Order → ${next.toLowerCase()}`, description: id.slice(-8).toUpperCase() })
        load()
      } else {
        toast({ title: 'Update failed', description: j.error, variant: 'destructive' })
      }
    } finally {
      setBusyId(null)
    }
  }

  const advance = (o: Order) => {
    const idx = FLOW.indexOf(o.status as (typeof FLOW)[number])
    if (idx >= 0 && idx < FLOW.length - 1) setStatusFor(o.id, FLOW[idx + 1])
  }

  return (
    <div>
      <AdminTitle
        title="Orders & Fulfilment"
        subtitle="Every purchase with buyer, delivery address, placing IP and items. Move orders through the pipeline or cancel them."
      />

      {/* stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Orders</span>
              <ShoppingBag className="h-4 w-4 text-zinc-300" />
            </div>
            <div className="text-2xl font-extrabold text-white mt-1.5">{stats ? stats.totalOrders.toLocaleString('en-IN') : '—'}</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Revenue</span>
              <IndianRupee className="h-4 w-4 text-zinc-300" />
            </div>
            <div className="text-2xl font-extrabold text-white mt-1.5">{stats ? formatINR(stats.totalRevenue) : '—'}</div>
          </CardContent>
        </Card>
        {['PLACED', 'SHIPPED', 'DELIVERED'].map((s) => (
          <Card key={s} className="bg-slate-900 border-slate-800">
            <CardContent className="p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{s}</span>
                {s === 'SHIPPED' ? <Truck className="h-4 w-4 text-amber-400" /> : <Clock className="h-4 w-4 text-zinc-300" />}
              </div>
              <div className="text-2xl font-extrabold text-white mt-1.5">{stats?.byStatus?.[s] ?? 0}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search buyer, email, city…"
            className="pl-8 bg-slate-900 border-slate-700 text-sm text-slate-200 placeholder:text-slate-600 w-56" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44 bg-slate-900 border-slate-700 text-sm text-slate-200"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
            <SelectItem value="ALL">All statuses</SelectItem>
            {FLOW.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            <SelectItem value="CANCELLED">CANCELLED</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* orders */}
      <div className="space-y-3">
        {!orders ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 bg-slate-900 border border-slate-800" />)
        ) : orders.length === 0 ? (
          <Card className="bg-slate-900 border-slate-800"><CardContent className="py-10 text-center text-xs text-slate-500">
            No orders yet (or none match this filter). Orders placed on the storefront — including ones blocked as fraudulent — appear here.
          </CardContent></Card>
        ) : (
          orders.map((o) => (
            <Card key={o.id} className="bg-slate-900 border-slate-800">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] text-slate-500">#{o.id.slice(-8).toUpperCase()}</span>
                      <Badge className={`text-[9px] border ${STATUS_STYLE[o.status] ?? ''}`}>{o.status}</Badge>
                      <span className="text-[10px] text-slate-500">{timeAgo(o.createdAt)} · {o.paymentMethod}</span>
                    </div>
                    <div className="text-sm font-semibold text-slate-200 mt-1">{o.fullName} <span className="text-xs font-normal text-slate-500">({o.user?.email ?? 'deleted user'})</span></div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{o.addressLine}, {o.city}, {o.state} {o.pincode} · {o.phone}</div>
                    {o.ip && <div className="text-[10px] text-slate-600 font-mono mt-0.5">placed from {o.ip}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="text-lg font-extrabold text-white">{formatINR(o.total)}</div>
                      <div className="text-[10px] text-slate-500">{o.items.length} item{o.items.length === 1 ? '' : 's'}</div>
                    </div>
                    <Select value={o.status} onValueChange={(v) => setStatusFor(o.id, v)} disabled={busyId === o.id}>
                      <SelectTrigger className="w-32 bg-slate-800 border-slate-700 text-xs text-slate-200 h-8"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                        {FLOW.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        <SelectItem value="CANCELLED" className="text-red-300">CANCELLED</SelectItem>
                      </SelectContent>
                    </Select>
                    {FLOW.indexOf(o.status as (typeof FLOW)[number]) >= 0 && FLOW.indexOf(o.status as (typeof FLOW)[number]) < FLOW.length - 1 && (
                      <Button size="sm" disabled={busyId === o.id} onClick={() => advance(o)}
                        className="bg-zinc-100 hover:bg-white text-zinc-900 h-8 text-xs">
                        {busyId === o.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : `→ ${FLOW[FLOW.indexOf(o.status as (typeof FLOW)[number]) + 1]}`}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-800/70">
                  {o.items.map((it) => (
                    <div key={it.id} className="flex items-center gap-2 rounded-md bg-slate-800/60 border border-slate-700/60 px-2 py-1.5">
                      {it.product?.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.product.image} alt="" className="h-7 w-7 rounded object-cover bg-slate-800" />
                      )}
                      <div className="text-[11px] leading-tight">
                        <div className="text-slate-300 max-w-44 truncate">{it.name}</div>
                        <div className="text-slate-500">×{it.quantity} · {formatINR(it.price)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
