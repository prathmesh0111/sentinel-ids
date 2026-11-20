'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ShieldCheck, ShieldAlert, Lock, Activity } from 'lucide-react'
import { StoreHeader, StoreFooter } from '@/components/store/header'
import { ProductCard } from '@/components/store/product-card'
import { Skeleton } from '@/components/ui/skeleton'
import type { Product } from '@/components/store/types'

function Home() {
  const params = useSearchParams()
  const q = params.get('q') ?? ''
  const [products, setProducts] = useState<Product[] | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [cat, setCat] = useState('All')
  const [sort, setSort] = useState('featured')

  useEffect(() => {
    const url = new URL('/api/products', window.location.origin)
    if (q) url.searchParams.set('q', q)
    if (cat !== 'All') url.searchParams.set('category', cat)
    url.searchParams.set('sort', sort)
    fetch(url.toString(), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j) {
          setProducts(j.products)
          setCategories(j.categories)
        } else setProducts([])
      })
      .catch(() => setProducts([]))
  }, [q, cat, sort])

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <StoreHeader />

      {/* hero */}
      <section className="bg-zinc-950 text-white">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:py-12 flex flex-col md:flex-row items-center gap-6">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-zinc-300 text-xs font-semibold px-3 py-1 rounded-full mb-3">
              <Activity className="h-3.5 w-3.5" /> LIVE FRAUD &amp; IP ANOMALY PROTECTION
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold leading-tight">
              Shop with confidence.<br />
              <span className="text-zinc-300">Every visit is verified.</span>
            </h1>
            <p className="text-slate-300 mt-3 text-sm sm:text-base max-w-xl">
              SecureMart is a fully working store guarded by a realtime fraud engine —
              location-spoof detection, brute-force &amp; DDoS protection, automatic IP blocking and
              machine-learning risk scoring on every request.
            </p>
            <div className="flex flex-wrap gap-4 mt-5 text-xs sm:text-sm">
              <span className="flex items-center gap-1.5 text-slate-300"><ShieldCheck className="h-4 w-4 text-zinc-300" /> Auto IP blocking</span>
              <span className="flex items-center gap-1.5 text-slate-300"><Lock className="h-4 w-4 text-zinc-300" /> Credential-abuse detection</span>
              <span className="flex items-center gap-1.5 text-slate-300"><ShieldAlert className="h-4 w-4 text-zinc-300" /> ML anomaly scoring</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 w-full md:w-auto">
            {[
              { label: 'Risk scoring', sub: 'per IP' },
              { label: 'Live dashboards', sub: 'admin' },
              { label: '2 ML models', sub: 'RF + IF' },
            ].map((x) => (
              <div key={x.label} className="bg-white/5 border border-white/10 rounded-lg p-3 text-center backdrop-blur">
                <div className="text-zinc-300 font-bold text-sm sm:text-base">{x.label}</div>
                <div className="text-slate-400 text-[11px]">{x.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* categories */}
      <section className="max-w-7xl mx-auto w-full px-4 pt-5">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['All', ...categories].map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                cat === c
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-zinc-400 hover:text-zinc-900'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      {/* products */}
      <main className="max-w-7xl mx-auto w-full px-4 py-5 flex-1">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-900 text-lg">
            {q ? <>Results for “{q}”</> : cat === 'All' ? 'Deals of the Day' : cat}
            {products && <span className="text-slate-400 font-normal text-sm ml-2">({products.length} items)</span>}
          </h2>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="text-sm border border-slate-200 bg-white rounded-md px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            aria-label="Sort products"
          >
            <option value="featured">Featured</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="rating">Rating</option>
          </select>
        </div>

        {products === null ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-lg" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center text-slate-500">
            No products found. Try a different search or category.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}

              </main>

      <StoreFooter />
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-100" />}>
      <Home />
    </Suspense>
  )
}
