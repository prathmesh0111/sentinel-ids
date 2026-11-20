import { NextResponse } from 'next/server'
import { guard } from '@/lib/guard'
import { db } from '@/lib/db'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { requireAuth: true })
  if (!g.ok) return g.response
  const { id } = await params
  const body = await req.json()
  const quantity = Number(body.quantity ?? 1)

  const item = await db.cartItem.findUnique({ where: { id }, include: { product: true } })
  if (!item || item.userId !== g.session!.uid) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  if (quantity <= 0) {
    await db.cartItem.delete({ where: { id } })
    return NextResponse.json({ ok: true, removed: true })
  }
  await db.cartItem.update({ where: { id }, data: { quantity: Math.min(10, quantity) } })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { requireAuth: true })
  if (!g.ok) return g.response
  const { id } = await params
  const item = await db.cartItem.findUnique({ where: { id } })
  if (!item || item.userId !== g.session!.uid) return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  await db.cartItem.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
