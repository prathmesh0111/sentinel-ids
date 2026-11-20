import { NextResponse } from 'next/server'
import { guard } from '@/lib/guard'
import { db } from '@/lib/db'

type Ctx = { params: Promise<{ id: string }> }

/** Edit any product field (partial update) — admin only */
export async function PATCH(req: Request, ctx: Ctx) {
  const g = await guard(req, { requireAdmin: true })
  if (!g.ok) return g.response
  const { id } = await ctx.params

  const current = await db.product.findUnique({ where: { id } })
  if (!current) return NextResponse.json({ error: 'Product not found.' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}

  if (body.name !== undefined) {
    const name = String(body.name).trim()
    if (name.length < 3) return NextResponse.json({ error: 'Name must be at least 3 characters.' }, { status: 400 })
    if (name !== current.name) {
      const clash = await db.product.findUnique({ where: { name } })
      if (clash) return NextResponse.json({ error: `A product named "${name}" already exists.` }, { status: 409 })
    }
    data.name = name
  }
  if (body.description !== undefined) {
    const d = String(body.description).trim()
    if (d.length < 10) return NextResponse.json({ error: 'Description must be at least 10 characters.' }, { status: 400 })
    data.description = d
  }
  if (body.category !== undefined) data.category = String(body.category).trim()
  if (body.brand !== undefined) data.brand = String(body.brand).trim()
  if (body.image !== undefined) data.image = String(body.image).trim()
  if (body.price !== undefined) {
    const p = Math.round(Number(body.price) * 100)
    if (!Number.isFinite(p) || p <= 0) return NextResponse.json({ error: 'Price must be a positive amount.' }, { status: 400 })
    data.price = p
  }
  if (body.mrp !== undefined) {
    const m = Math.round(Number(body.mrp) * 100)
    if (!Number.isFinite(m) || m <= 0) return NextResponse.json({ error: 'MRP must be a positive amount.' }, { status: 400 })
    data.mrp = m
  }
  if (body.stock !== undefined) {
    const s = Math.round(Number(body.stock))
    if (!Number.isFinite(s) || s < 0) return NextResponse.json({ error: 'Stock must be zero or more.' }, { status: 400 })
    data.stock = s
  }
  if (body.rating !== undefined) {
    const r = Number(body.rating)
    if (!Number.isFinite(r) || r < 0 || r > 5) return NextResponse.json({ error: 'Rating must be between 0 and 5.' }, { status: 400 })
    data.rating = r
  }
  if (body.featured !== undefined) data.featured = Boolean(body.featured)

  const finalPrice = (data.price as number | undefined) ?? current.price
  const finalMrp = (data.mrp as number | undefined) ?? current.mrp
  if (finalMrp < finalPrice) return NextResponse.json({ error: 'MRP cannot be lower than the price.' }, { status: 400 })

  try {
    const product = await db.product.update({ where: { id }, data })
    return NextResponse.json({ product })
  } catch {
    return NextResponse.json({ error: 'Could not update the product.' }, { status: 500 })
  }
}

/** Remove a product — refused while real orders reference it (order history must stay truthful) */
export async function DELETE(req: Request, ctx: Ctx) {
  const g = await guard(req, { requireAdmin: true })
  if (!g.ok) return g.response
  const { id } = await ctx.params

  const orderCount = await db.orderItem.count({ where: { productId: id } })
  if (orderCount > 0) {
    return NextResponse.json(
      { error: `This product appears in ${orderCount} order item(s). Set stock to 0 instead — deleting it would rewrite purchase history.` },
      { status: 409 },
    )
  }

  try {
    await db.cartItem.deleteMany({ where: { productId: id } })
    const product = await db.product.delete({ where: { id } })
    return NextResponse.json({ product })
  } catch {
    return NextResponse.json({ error: 'Could not delete the product.' }, { status: 500 })
  }
}
