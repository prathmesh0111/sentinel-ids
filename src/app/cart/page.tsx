'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Trash2, Minus, Plus, ShoppingBag, Loader2 } from 'lucide-react'
import { StoreHeader, StoreFooter } from '@/components/store/header'
import { formatINR } from '@/lib/format'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import type { CartItemRow } from '@/components/store/types'

export default function CartPage() {
  const router = useRouter()
  const [items, setItems] = useState<CartItemRow[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = () => {
    fetch('/api/cart', { cache: 'no-store' })
      .then((r) => {
        if (r.status === 401) { router.replace('/login?next=/cart'); return { items: [] } }
        return r.ok ? r.json() : { items: [] }
      })
      .then((j) => setItems(j.items))
      .catch(() => setItems([]))
  }
  useEffect(load, [router])

  const changeQty = async (id: string, quantity: number) => {
    setBusyId(id)
    try {
      const r = await fetch(`/api/cart/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ quantity }),
      })
      if (r.ok) { load(); window.dispatchEvent(new Event('cart-updated')) }
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (id: string) => {
    setBusyId(id)
    try {
      const r = await fetch(`/api/cart/${id}`, { method: 'DELETE' })
      if (r.ok) { toast({ title: 'Removed from cart' }); load(); window.dispatchEvent(new Event('cart-updated')) }
    } finally {
      setBusyId(null)
    }
  }

  const total = items?.reduce((a, i) => a + i.product.price * i.quantity, 0) ?? 0
  const mrpTotal = items?.reduce((a, i) => a + i.product.mrp * i.quantity, 0) ?? 0

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <StoreHeader />
      <main className="max-w-7xl mx-auto w-full px-4 py-6 flex-1">
        <h1 className="text-xl font-bold text-slate-900 mb-4">Shopping Cart</h1>
        {items === null ? (
          <Skeleton className="h-64 rounded-lg" />
        ) : items.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
            <ShoppingBag className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <div className="font-bold text-slate-900 mb-1">Your cart is empty</div>
            <p className="text-sm text-slate-500 mb-4">Add products to see them here.</p>
            <Link href="/" className="inline-block bg-zinc-900 hover:bg-zinc-700 text-white font-bold px-6 py-2.5 rounded-md text-sm">
              Start shopping
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_340px] gap-4 items-start">
            <div className="bg-white rounded-lg border border-slate-200 divide-y divide-slate-100">
              {items.map((item) => (
                <div key={item.id} className="p-4 flex gap-4">
                  <Link href={`/product/${item.product.id}`} className="shrink-0">
                    { }
                    <img src={item.product.image} alt={item.product.name} className="h-20 w-20 object-contain" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link href={`/product/${item.product.id}`} className="text-sm font-medium text-slate-900 hover:text-zinc-900 line-clamp-2">
                      {item.product.name}
                    </Link>
                    <div className="text-[11px] text-slate-500 mt-0.5">{item.product.brand} · {item.product.category}</div>
                    <div className="flex items-baseline gap-2 mt-1.5">
                      <span className="font-bold text-slate-900">{formatINR(item.product.price)}</span>
                      {item.product.mrp > item.product.price && (
                        <span className="text-xs text-slate-400 line-through">{formatINR(item.product.mrp)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center border border-slate-200 rounded-md">
                        <button onClick={() => changeQty(item.id, item.quantity - 1)} disabled={busyId === item.id} className="p-1.5 px-2 hover:bg-slate-50 disabled:opacity-50" aria-label="Decrease quantity">
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="px-3 text-sm font-semibold w-8 text-center">{item.quantity}</span>
                        <button onClick={() => changeQty(item.id, item.quantity + 1)} disabled={busyId === item.id || item.quantity >= 10} className="p-1.5 px-2 hover:bg-slate-50 disabled:opacity-50" aria-label="Increase quantity">
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <button onClick={() => remove(item.id)} disabled={busyId === item.id} className="text-slate-400 hover:text-red-600 disabled:opacity-50" aria-label="Remove item">
                        {busyId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-4 lg:sticky lg:top-20">
              <div className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3">Price Details</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-600">Price ({items.length} items)</span><span>{formatINR(mrpTotal)}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Discount</span><span className="text-zinc-900">− {formatINR(mrpTotal - total)}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Delivery</span><span className="text-zinc-900">FREE</span></div>
                <div className="border-t border-dashed border-slate-200 pt-2 flex justify-between font-bold text-base">
                  <span>Total Payable</span><span>{formatINR(total)}</span>
                </div>
              </div>
              <Link
                href="/checkout"
                className="mt-4 block text-center bg-zinc-900 hover:bg-zinc-700 text-white font-bold py-3 rounded-md text-sm"
              >
                PROCEED TO CHECKOUT
              </Link>
              <p className="text-[11px] text-slate-400 mt-2 text-center">
                Orders placed from risky IPs are flagged to the fraud engine in realtime.
              </p>
            </div>
          </div>
        )}
      </main>
      <StoreFooter />
    </div>
  )
}
