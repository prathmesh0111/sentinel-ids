'use client'

import { useEffect, useState, useCallback } from 'react'
import { Package, Plus, Pencil, Trash2, Search, Loader2, Star, ImageIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { AdminTitle } from '@/components/admin/shell'
import { formatINR, discountPercent } from '@/lib/format'
import { toast } from '@/hooks/use-toast'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface Product {
  id: string
  name: string
  description: string
  category: string
  brand: string
  price: number // paise
  mrp: number
  image: string
  stock: number
  rating: number
  featured: boolean
  soldCount: number
  inCarts: number
}

const EMPTY: Partial<Product> = { name: '', description: '', category: '', brand: '', image: '', price: 0, mrp: 0, stock: 50, rating: 4.2, featured: false }

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[] | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState('newest')

  const [editing, setEditing] = useState<Product | null>(null) // null = closed, EMPTY = create
  const [form, setForm] = useState<Partial<Product>>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<Product | null>(null)

  const load = useCallback(() => {
    const params = new URLSearchParams({ q, category, sort })
    fetch(`/api/admin/products?${params}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j) { setProducts(j.products); setCategories(j.categories) }
      })
      .catch(() => {})
  }, [q, category, sort])

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, q])

  const openCreate = () => { setEditing({} as Product); setForm(EMPTY) }
  const openEdit = (p: Product) => { setEditing(p); setForm({ ...p, price: p.price / 100, mrp: p.mrp / 100 }) }

  const save = async () => {
    setSaving(true)
    try {
      const isNew = !editing?.id
      const r = await fetch(isNew ? '/api/admin/products' : `/api/admin/products/${editing!.id}`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      })
      const j = await r.json().catch(() => ({}))
      if (r.ok) {
        toast({ title: isNew ? 'Product created' : 'Product updated', description: form.name })
        setEditing(null)
        load()
      } else {
        toast({ title: 'Save failed', description: j.error, variant: 'destructive' })
      }
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!deleting) return
    try {
      const r = await fetch(`/api/admin/products/${deleting.id}`, { method: 'DELETE' })
      const j = await r.json().catch(() => ({}))
      if (r.ok) {
        toast({ title: 'Product deleted', description: deleting.name })
        load()
      } else {
        toast({ title: 'Delete refused', description: j.error, variant: 'destructive' })
      }
    } finally {
      setDeleting(null)
    }
  }

  const set = (k: keyof Product, v: unknown) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div>
      <AdminTitle
        title="Product Catalog"
        subtitle="Create, edit, restock and remove store items. Changes go live on the storefront instantly."
      />

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, brand, category…"
            className="pl-8 bg-slate-900 border-slate-700 text-sm text-slate-200 placeholder:text-slate-600 w-56" />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-44 bg-slate-900 border-slate-700 text-sm text-slate-200"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
            <SelectItem value="All">All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-40 bg-slate-900 border-slate-700 text-sm text-slate-200"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="name">Name A→Z</SelectItem>
            <SelectItem value="price_asc">Price ↑</SelectItem>
            <SelectItem value="price_desc">Price ↓</SelectItem>
            <SelectItem value="stock">Lowest stock</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button onClick={openCreate} className="bg-zinc-100 hover:bg-white text-zinc-900 text-sm">
          <Plus className="h-4 w-4 mr-1.5" /> Add product
        </Button>
      </div>

      {/* table */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-0">
          {!products ? (
            <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 bg-slate-800" />)}</div>
          ) : products.length === 0 ? (
            <p className="text-xs text-slate-500 py-10 text-center">No products match. Clear the search or add one.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-800">
                    <th className="px-3 py-2.5 font-medium">Product</th>
                    <th className="px-3 py-2.5 font-medium">Category</th>
                    <th className="px-3 py-2.5 font-medium">Price / MRP</th>
                    <th className="px-3 py-2.5 font-medium">Stock</th>
                    <th className="px-3 py-2.5 font-medium">Sold</th>
                    <th className="px-3 py-2.5 font-medium">Rating</th>
                    <th className="px-3 py-2.5 font-medium">Featured</th>
                    <th className="px-3 py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {products.map((p) => (
                    <tr key={p.id} className="text-slate-300 hover:bg-slate-800/40">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5 max-w-72">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.image} alt="" className="h-9 w-9 rounded-md object-cover bg-slate-800 shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.25' }} />
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-200 truncate">{p.name}</div>
                            <div className="text-[10px] text-slate-500">{p.brand}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5"><Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px]">{p.category}</Badge></td>
                      <td className="px-3 py-2.5 font-mono">
                        {formatINR(p.price)}
                        {p.mrp > p.price && <span className="ml-1.5 text-[10px] text-slate-500 line-through">{formatINR(p.mrp)}</span>}
                        {discountPercent(p.price, p.mrp) > 0 && <span className="ml-1 text-[10px] text-zinc-300">-{discountPercent(p.price, p.mrp)}%</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={p.stock === 0 ? 'text-red-400 font-bold' : p.stock < 10 ? 'text-amber-400 font-bold' : ''}>
                          {p.stock}
                        </span>
                        {p.stock === 0 && <span className="ml-1 text-[10px] text-red-400/80">OUT</span>}
                        {p.stock > 0 && p.stock < 10 && <span className="ml-1 text-[10px] text-amber-400/80">LOW</span>}
                      </td>
                      <td className="px-3 py-2.5">{p.soldCount}</td>
                      <td className="px-3 py-2.5"><span className="flex items-center gap-1"><Star className="h-3 w-3 text-amber-400 fill-amber-400" />{p.rating.toFixed(1)}</span></td>
                      <td className="px-3 py-2.5">{p.featured ? <Badge className="bg-zinc-800 text-zinc-200 border border-zinc-700 text-[9px]">FEATURED</Badge> : <span className="text-slate-600">—</span>}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-zinc-200" onClick={() => openEdit(p)} aria-label={`Edit ${p.name}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-400" onClick={() => setDeleting(p)} aria-label={`Delete ${p.name}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* create / edit dialog */}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">{editing?.id ? 'Edit product' : 'New product'}</DialogTitle>
            <DialogDescription className="text-slate-500 text-xs">
              Price and MRP are in ₹ (rupees). The image is a URL or a /public path.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-[11px] text-slate-400">Name</Label>
              <Input value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} className="bg-slate-800 border-slate-700 text-sm mt-1" />
            </div>
            <div className="col-span-2">
              <Label className="text-[11px] text-slate-400">Description</Label>
              <Textarea value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} rows={3} className="bg-slate-800 border-slate-700 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-[11px] text-slate-400">Category</Label>
              <Input value={form.category ?? ''} onChange={(e) => set('category', e.target.value)} list="admin-cat-list" className="bg-slate-800 border-slate-700 text-sm mt-1" />
              <datalist id="admin-cat-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div>
              <Label className="text-[11px] text-slate-400">Brand</Label>
              <Input value={form.brand ?? ''} onChange={(e) => set('brand', e.target.value)} className="bg-slate-800 border-slate-700 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-[11px] text-slate-400">Price (₹)</Label>
              <Input type="number" min={1} value={form.price ?? 0} onChange={(e) => set('price', Number(e.target.value))} className="bg-slate-800 border-slate-700 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-[11px] text-slate-400">MRP (₹)</Label>
              <Input type="number" min={1} value={form.mrp ?? 0} onChange={(e) => set('mrp', Number(e.target.value))} className="bg-slate-800 border-slate-700 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-[11px] text-slate-400">Stock</Label>
              <Input type="number" min={0} value={form.stock ?? 0} onChange={(e) => set('stock', Number(e.target.value))} className="bg-slate-800 border-slate-700 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-[11px] text-slate-400">Rating (0–5)</Label>
              <Input type="number" step="0.1" min={0} max={5} value={form.rating ?? 4.2} onChange={(e) => set('rating', Number(e.target.value))} className="bg-slate-800 border-slate-700 text-sm mt-1" />
            </div>
            <div className="col-span-2">
              <Label className="text-[11px] text-slate-400 flex items-center gap-1"><ImageIcon className="h-3 w-3" /> Image URL or /path</Label>
              <Input value={form.image ?? ''} onChange={(e) => set('image', e.target.value)} placeholder="/img/iphone15.jpg or https://…" className="bg-slate-800 border-slate-700 text-sm mt-1 font-mono" />
            </div>
            <div className="col-span-2 flex items-center justify-between rounded-md border border-slate-700 bg-slate-800/50 px-3 py-2">
              <span className="text-xs text-slate-300">Featured on the storefront home page</span>
              <Switch checked={Boolean(form.featured)} onCheckedChange={(v) => set('featured', v)} />
            </div>
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setEditing(null)} className="border-slate-700 text-slate-300">Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-zinc-100 hover:bg-white text-zinc-900">
              {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Package className="h-4 w-4 mr-1.5" />}
              {editing?.id ? 'Save changes' : 'Create product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* delete confirm */}
      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-700 text-slate-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400 text-xs">
              This removes it from the store and from every cart. Products that appear in real orders are refused —
              history stays truthful; restock to 0 instead in that case.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 text-slate-300">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-red-600 hover:bg-red-500 text-white">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
