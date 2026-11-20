import { NextResponse } from 'next/server'
import { guard } from '@/lib/guard'
import { engine } from '@/lib/security/engine'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  const g = await guard(req, { requireAuth: true })
  if (!g.ok) return g.response
  const items = await db.cartItem.findMany({
    where: { userId: g.session!.uid },
    include: { product: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ items })
}

export async function POST(req: Request) {
  const g = await guard(req, { requireAuth: true })
  if (!g.ok) return g.response
  const body = await req.json()
  const productId = String(body.productId ?? '')
  const quantity = Math.max(1, Math.min(10, Number(body.quantity ?? 1)))

  const product = await db.product.findUnique({ where: { id: productId } })
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  if (product.stock <= 0) return NextResponse.json({ error: 'Out of stock' }, { status: 400 })

  const existing = await db.cartItem.findUnique({
    where: { userId_productId: { userId: g.session!.uid, productId } },
  })
  if (existing) {
    await db.cartItem.update({
      where: { id: existing.id },
      data: { quantity: Math.min(10, existing.quantity + quantity) },
    })
  } else {
    await db.cartItem.create({ data: { userId: g.session!.uid, productId, quantity } })
  }
  const count = await db.cartItem.count({ where: { userId: g.session!.uid } })
  return NextResponse.json({ ok: true, cartCount: count })
}
