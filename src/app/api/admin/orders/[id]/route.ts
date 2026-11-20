import { NextResponse } from 'next/server'
import { guard } from '@/lib/guard'
import { db } from '@/lib/db'
import type { OrderStatus } from '@prisma/client'

const VALID = ['PLACED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const

/** Fulfilment control — move an order through its lifecycle — admin only */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { requireAdmin: true })
  if (!g.ok) return g.response
  const { id } = await ctx.params

  const body = await req.json().catch(() => ({}))
  const status = String(body.status ?? '').toUpperCase()
  if (!VALID.includes(status as (typeof VALID)[number])) {
    return NextResponse.json({ error: `Status must be one of: ${VALID.join(', ')}.` }, { status: 400 })
  }

  const order = await db.order.findUnique({ where: { id } })
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 })

  const updated = await db.order.update({ where: { id }, data: { status: status as OrderStatus } })
  return NextResponse.json({ order: updated })
}
