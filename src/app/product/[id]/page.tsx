'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { Star, ShieldCheck, Truck, RotateCcw } from 'lucide-react'
import { StoreHeader, StoreFooter } from '@/components/store/header'
import { BuyButtons, ProductCard } from '@/components/store/product-card'
import { formatINR, discountPercent } from '@/lib/format'
import { Skeleton } from '@/components/ui/skeleton'
import type { Product } from '@/components/store/types'

export default function ProductPage() {
  const [product, setProduct] = useState<Product | null>(null)
  const [related, setRelated] = useState<Product[]>([])
  const [notFound, setNotFound] = useState(false)
  const [id, setId] = useState<string | null>(null)

  useEffect(() => {
    // resolve the product id from the URL on the client (preview-safe)
    const t = setTimeout(() => {
      const seg = window.location.pathname.split('/').pop()
      if (seg) setId(seg)
    }, 0)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!id) return
    fetch(`/api/products/${id}`, { cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 403) {
          setNotFound(true)
          return null
        }
        return r.ok ? r.json() : null
      })
      .then((j) => {
        if (j) {
          setProduct(j.product)
          setRelated(j.related ?? [])
        } else setNotFound(true)
      })
      .catch(() => setNotFound(true))
  }, [id])

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <StoreHeader />
      <main className="max-w-7xl mx-auto w-full px-4 py-5 flex-1">
        <nav className="text-xs text-slate-500 mb-3 flex items-center gap-1" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-zinc-900">Home</Link>
          {product && (<><span>/</span><span className="text-slate-400">{product.category}</span></>)}
        </nav>

        {notFound ? (
          <div className="bg-white rounded-lg p-12 text-center">
            <div className="font-bold text-lg text-slate-900 mb-1">Product unavailable</div>
            <p className="text-sm text-slate-500 mb-4">This product could not be loaded — your IP may have been blocked by the security system.</p>
            <Link href="/" className="text-zinc-900 font-semibold text-sm">← Back to shopping</Link>
          </div>
        ) : !product ? (
          <div className="grid md:grid-cols-2 gap-6">
            <Skeleton className="h-96 rounded-lg" />
            <div className="space-y-4"><Skeleton className="h-8 w-3/4" /><Skeleton className="h-6 w-1/3" /><Skeleton className="h-24" /></div>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-6 grid md:grid-cols-2 gap-6">
              <div className="flex items-center justify-center bg-white rounded-lg p-6 min-h-72 sm:min-h-96">
                { }
                <img src={product.image} alt={product.name} className="max-h-80 sm:max-h-96 object-contain" />
              </div>
              <div className="flex flex-col">
                <div className="text-xs text-slate-500">{product.brand} · {product.category}</div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{product.name}</h1>
                <div className="flex items-center gap-2 mt-2">
                  <span className="bg-zinc-900 text-white text-xs font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                    {product.rating.toFixed(1)} <Star className="h-3 w-3 fill-white" />
                  </span>
                  <span className="text-xs text-slate-500">{product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}</span>
                </div>
                <div className="mt-4 flex items-baseline gap-3">
                  <span className="text-3xl font-extrabold text-slate-900">{formatINR(product.price)}</span>
                  {product.mrp > product.price && (
                    <>
                      <span className="text-slate-400 line-through">{formatINR(product.mrp)}</span>
                      <span className="text-zinc-900 font-bold">{discountPercent(product.price, product.mrp)}% off</span>
                    </>
                  )}
                </div>
                <p className="text-sm text-slate-600 mt-2">Inclusive of all taxes · Free delivery over ₹499</p>

                <div className="mt-5">
                  <BuyButtons product={product} />
                </div>

                <div className="grid grid-cols-3 gap-2 mt-5 text-center">
                  <div className="border border-slate-200 rounded-md p-2.5">
                    <Truck className="h-5 w-5 mx-auto text-zinc-900" />
                    <div className="text-[11px] text-slate-600 mt-1">Fast delivery</div>
                  </div>
                  <div className="border border-slate-200 rounded-md p-2.5">
                    <RotateCcw className="h-5 w-5 mx-auto text-zinc-900" />
                    <div className="text-[11px] text-slate-600 mt-1">7-day returns</div>
                  </div>
                  <div className="border border-slate-200 rounded-md p-2.5">
                    <ShieldCheck className="h-5 w-5 mx-auto text-zinc-900" />
                    <div className="text-[11px] text-slate-600 mt-1">Fraud-safe checkout</div>
                  </div>
                </div>

                <div className="mt-6 border-t border-slate-100 pt-4">
                  <div className="font-bold text-slate-900 text-sm mb-1.5">Product Description</div>
                  <p className="text-sm text-slate-600 leading-relaxed">{product.description}</p>
                </div>
              </div>
            </div>

            {related.length > 0 && (
              <section className="mt-6">
                <h2 className="font-bold text-slate-900 text-lg mb-3">Similar products</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {related.map((p) => (
                    <ProductCard key={p.id} product={p} compact />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
      <StoreFooter />
    </div>
  )
}
