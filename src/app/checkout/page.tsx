'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, MapPin, ShieldCheck } from 'lucide-react'
import { StoreHeader, StoreFooter } from '@/components/store/header'
import { formatINR } from '@/lib/format'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import type { CartItemRow } from '@/components/store/types'

export default function CheckoutPage() {
  const router = useRouter()
  const [items, setItems] = useState<CartItemRow[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    fullName: '', phone: '', addressLine: '', city: '', state: '', pincode: '',
  })
  const [payment, setPayment] = useState('COD')

  useEffect(() => {
    fetch('/api/cart', { cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 401) { router.push('/login?next=/checkout'); return { items: [] } }
        return r.json()
      })
      .then((j) => {
        setItems(j.items)
        if (j.items && j.items.length === 0) router.replace('/cart')
      })
      .catch(() => setItems([]))
  }, [router])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const total = items?.reduce((a, i) => a + i.product.price * i.quantity, 0) ?? 0

  const placeOrder = async () => {
    setBusy(true)
    try {
      const r = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, paymentMethod: payment }),
      })
      const j = await r.json()
      if (!r.ok) {
        toast({ title: 'Order failed', description: j.error, variant: 'destructive' })
        return
      }
      window.dispatchEvent(new Event('cart-updated'))
      toast({ title: 'Order placed successfully!', description: `Order id ${j.order.id.slice(0, 8)}…` })
      router.push('/orders')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <StoreHeader />
      <main className="max-w-5xl mx-auto w-full px-4 py-6 flex-1">
        <h1 className="text-xl font-bold text-slate-900 mb-4">Checkout</h1>
        {items === null ? (
          <Skeleton className="h-64 rounded-lg" />
        ) : (
          <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
            <div className="space-y-4">
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-2 font-bold text-slate-900 mb-3">
                  <MapPin className="h-4 w-4 text-zinc-900" /> Delivery address
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName">Full name</Label>
                    <Input id="fullName" value={form.fullName} onChange={set('fullName')} placeholder="Priya Sharma" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone (10 digits)</Label>
                    <Input id="phone" value={form.phone} onChange={set('phone')} placeholder="9876543210" inputMode="numeric" maxLength={10} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="addressLine">Address</Label>
                    <Input id="addressLine" value={form.addressLine} onChange={set('addressLine')} placeholder="Flat / street / landmark" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" value={form.city} onChange={set('city')} placeholder="Mumbai" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="state">State</Label>
                    <Input id="state" value={form.state} onChange={set('state')} placeholder="Maharashtra" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pincode">Pincode (6 digits)</Label>
                    <Input id="pincode" value={form.pincode} onChange={set('pincode')} placeholder="400001" inputMode="numeric" maxLength={6} />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="font-bold text-slate-900 mb-3">Payment method</div>
                <RadioGroup value={payment} onValueChange={setPayment} className="grid sm:grid-cols-3 gap-2">
                  {[
                    { v: 'COD', label: 'Cash on Delivery' },
                    { v: 'UPI', label: 'UPI' },
                    { v: 'Card', label: 'Card' },
                  ].map((p) => (
                    <Label
                      key={p.v}
                      htmlFor={`pay-${p.v}`}
                      className={`flex items-center gap-2 border rounded-md px-3 py-2.5 cursor-pointer text-sm font-medium transition-colors ${
                        payment === p.v ? 'border-zinc-900 bg-zinc-50 text-zinc-900 font-medium' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <RadioGroupItem id={`pay-${p.v}`} value={p.v} />
                      {p.label}
                    </Label>
                  ))}
                </RadioGroup>
                <div className="flex items-start gap-2 mt-3 text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-md p-2.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-zinc-900 mt-0.5 shrink-0" />
                  Your IP address and session signals are evaluated by the fraud engine before the order is accepted.
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-4 lg:sticky lg:top-20">
              <div className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3">Order summary</div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {items.map((i) => (
                  <div key={i.id} className="flex gap-2.5 items-center">
                    { }
                    <img src={i.product.image} alt="" className="h-10 w-10 object-contain" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-800 line-clamp-1">{i.product.name}</div>
                      <div className="text-[11px] text-slate-400">Qty {i.quantity}</div>
                    </div>
                    <div className="text-xs font-semibold">{formatINR(i.product.price * i.quantity)}</div>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed border-slate-200 my-3" />
              <div className="flex justify-between font-bold"><span>Total</span><span>{formatINR(total)}</span></div>
              <button
                onClick={placeOrder}
                disabled={busy || !items.length}
                className="mt-4 w-full flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-700 disabled:bg-slate-300 text-white font-bold py-3 rounded-md text-sm"
              >
                {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Placing order…</> : `PLACE ORDER · ${formatINR(total)}`}
              </button>
            </div>
          </div>
        )}
      </main>
      <StoreFooter />
    </div>
  )
}
