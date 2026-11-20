'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Star, ShoppingCart, Zap } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { formatINR, discountPercent } from '@/lib/format'
import type { Product } from './types'

export function ProductCard({ product, compact }: { product: Product; compact?: boolean }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const off = discountPercent(product.price, product.mrp)

  const addToCart = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setAdding(true)
    try {
      const r = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      })
      if (r.status === 401) {
        toast({ title: 'Please sign in to add to cart' })
        router.push('/login?next=/')
        return
      }
      if (r.status === 403) {
        const j = await r.json()
        toast({ title: 'Access denied', description: j.error, variant: 'destructive' })
        return
      }
      if (!r.ok) {
        const j = await r.json()
        toast({ title: j.error ?? 'Could not add to cart', variant: 'destructive' })
        return
      }
      window.dispatchEvent(new Event('cart-updated'))
      toast({ title: 'Added to cart', description: product.name.slice(0, 50) })
    } finally {
      setAdding(false)
    }
  }

  return (
    <Link
      href={`/product/${product.id}`}
      className="group bg-white rounded-lg border border-slate-200 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col"
    >
      <div className={`relative ${compact ? 'h-36' : 'h-44 sm:h-52'} bg-white p-3 flex items-center justify-center overflow-hidden`}>
        { }
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
        />
        {off > 0 && (
          <span className="absolute top-2 left-2 bg-zinc-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
            {off}% OFF
          </span>
        )}
        {product.stock <= 5 && product.stock > 0 && (
          <span className="absolute top-2 right-2 bg-zinc-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
            Only {product.stock} left
          </span>
        )}
        {product.stock === 0 && (
          <span className="absolute inset-0 bg-white/70 flex items-center justify-center font-bold text-slate-600">
            Out of stock
          </span>
        )}
      </div>
      <div className="p-3 border-t border-slate-100 flex flex-col gap-1 flex-1">
        <div className="text-[11px] text-slate-500 font-medium">{product.brand}</div>
        <div className="text-sm text-slate-900 line-clamp-2 leading-snug min-h-[2.5rem]">{product.name}</div>
        <div className="flex items-center gap-1.5">
          <span className="bg-zinc-900 text-white text-[10px] font-bold px-1 py-0.5 rounded flex items-center gap-0.5">
            {product.rating.toFixed(1)} <Star className="h-2.5 w-2.5 fill-white" />
          </span>
          <span className="text-[11px] text-slate-400">· {product.category}</span>
        </div>
        <div className="flex items-baseline gap-2 mt-auto pt-1">
          <span className="font-bold text-slate-900">{formatINR(product.price)}</span>
          {off > 0 && <span className="text-xs text-slate-400 line-through">{formatINR(product.mrp)}</span>}
        </div>
        <button
          onClick={addToCart}
          disabled={adding || product.stock === 0}
          className="mt-1.5 w-full flex items-center justify-center gap-1.5 bg-zinc-500 disabled:bg-slate-300 hover:bg-orange-600 text-white text-xs font-bold py-2 rounded transition-colors"
        >
          {adding ? <span>Adding…</span> : (<><ShoppingCart className="h-3.5 w-3.5" /> ADD TO CART</>)}
        </button>
      </div>
    </Link>
  )
}

export function BuyButtons({ product }: { product: Product }) {
  const router = useRouter()
  const [busy, setBusy] = useState<'cart' | 'buy' | null>(null)

  const go = async (buyNow: boolean) => {
    setBusy(buyNow ? 'buy' : 'cart')
    try {
      const r = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId: product.id, quantity: 1 }),
      })
      if (r.status === 401) {
        toast({ title: 'Please sign in first' })
        router.push(`/login?next=/product/${product.id}`)
        return
      }
      if (!r.ok) {
        const j = await r.json()
        toast({ title: j.error ?? 'Action failed', variant: 'destructive' })
        return
      }
      window.dispatchEvent(new Event('cart-updated'))
      router.push(buyNow ? '/checkout' : '/cart')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => go(false)}
        disabled={busy !== null || product.stock === 0}
        className="flex-1 flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-700 disabled:bg-slate-300 text-white font-bold py-3 rounded-md transition-colors"
      >
        <ShoppingCart className="h-4 w-4" /> ADD TO CART
      </button>
      <button
        onClick={() => go(true)}
        disabled={busy !== null || product.stock === 0}
        className="flex-1 flex items-center justify-center gap-2 bg-zinc-900 hover:bg-amber-500 disabled:bg-slate-300 text-slate-900 font-bold py-3 rounded-md transition-colors"
      >
        <Zap className="h-4 w-4" /> BUY NOW
      </button>
    </div>
  )
}
