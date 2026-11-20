'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Package, ShieldCheck } from 'lucide-react'
import { StoreHeader, StoreFooter } from '@/components/store/header'
import { formatINR, timeAgo } from '@/lib/format'
import { Skeleton } from '@/components/ui/skeleton'
import type { OrderRow } from '@/components/store/types'

const STATUS_STYLES: Record<string, string> = {
  PLACED: 'bg-amber-100 text-amber-700 border-amber-200',
  PACKED: 'bg-sky-100 text-sky-700 border-sky-200',
  SHIPPED: 'bg-violet-100 text-violet-700 border-violet-200',
  DELIVERED: 'bg-emerald-100 text-zinc-700 border-emerald-200',
  CANCELLED: 'bg-red-100 text-red-700 border-red-200',
}

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<OrderRow[] | null>(null)

  useEffect(() => {
    fetch('/api/orders', { cache: 'no-store' })
      .then((r) => {
        if (r.status === 401) { router.replace('/login?next=/orders'); return { orders: [] } }
        return r.ok ? r.json() : { orders: [] }
      })
      .then((j) => setOrders(j.orders))
      .catch(() => setOrders([]))
  }, [router])

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <StoreHeader />
      <main className="max-w-4xl mx-auto w-full px-4 py-6 flex-1">
        <h1 className="text-xl font-bold text-slate-900 mb-4">My Orders</h1>
        {orders === null ? (
          <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-40 rounded-lg" />)}</div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
            <Package className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <div className="font-bold text-slate-900 mb-1">No orders yet</div>
            <p className="text-sm text-slate-500 mb-4">Place your first order to see it here.</p>
            <Link href="/" className="inline-block bg-zinc-900 hover:bg-zinc-700 text-white font-bold px-6 py-2.5 rounded-md text-sm">
              Start shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <div key={o.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5 border-b border-slate-100 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-700">Order #{o.id.slice(-8).toUpperCase()}</span>
                    <span className="text-slate-400">{timeAgo(o.createdAt)}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded border font-bold text-[10px] uppercase tracking-wide ${STATUS_STYLES[o.status]}`}>
                    {o.status}
                  </span>
                </div>
                <div className="p-4 grid sm:grid-cols-[1fr_auto] gap-4">
                  <div className="space-y-2">
                    {o.items.map((i) => (
                      <div key={i.id} className="flex justify-between text-sm gap-4">
                        <span className="text-slate-700 line-clamp-1">{i.name} <span className="text-slate-400">× {i.quantity}</span></span>
                        <span className="font-semibold text-slate-900 shrink-0">{formatINR(i.price * i.quantity)}</span>
                      </div>
                    ))}
                    <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 mt-2">
                      Deliver to: {o.fullName}, {o.addressLine}, {o.city}, {o.state} — {o.pincode} · {o.paymentMethod}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                      <ShieldCheck className="h-3 w-3 text-zinc-900" />
                      Placed from IP {o.ip ?? 'unknown'} — screened by the fraud engine at purchase time
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Total paid</div>
                    <div className="text-lg font-extrabold text-slate-900">{formatINR(o.total)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <StoreFooter />
    </div>
  )
}
