import { NextResponse } from 'next/server'
import { guard } from '@/lib/guard'
import { db } from '@/lib/db'
import type { Role } from '@prisma/client'

/** Customer & admin accounts with order activity — admin only */
export async function GET(req: Request) {
  const g = await guard(req, { requireAdmin: true })
  if (!g.ok) return g.response

  const users = await db.user.findMany({
    select: {
      id: true, name: true, email: true, role: true, createdAt: true,
      _count: { select: { orders: true, loginEvents: true, cartItems: true } },
      orders: { orderBy: { createdAt: 'desc' }, take: 1, select: { total: true, createdAt: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  const admins = users.filter((u) => u.role === 'ADMIN').length
  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      orderCount: u._count.orders,
      loginCount: u._count.loginEvents,
      cartCount: u._count.cartItems,
      lastOrder: u.orders[0] ?? null,
    })),
    stats: { total: users.length, admins, customers: users.length - admins },
  })
}

/** Promote / demote an account — admin only */
export async function PATCH(req: Request) {
  const g = await guard(req, { requireAdmin: true })
  if (!g.ok) return g.response

  const body = await req.json().catch(() => ({}))
  const id = String(body.id ?? '')
  const role = String(body.role ?? '').toUpperCase()
  if (!id || !['USER', 'ADMIN'].includes(role)) {
    return NextResponse.json({ error: 'Provide a user id and role USER or ADMIN.' }, { status: 400 })
  }

  if (g.session?.uid === id && role === 'USER') {
    return NextResponse.json({ error: 'You cannot demote your own account — ask another admin.' }, { status: 400 })
  }

  try {
    const user = await db.user.update({ where: { id }, data: { role: role as Role } })
    return NextResponse.json({ user: { id: user.id, email: user.email, role: user.role } })
  } catch {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 })
  }
}

/** Delete an account and everything tied to it (cart, orders, login records) — admin only */
export async function DELETE(req: Request) {
  const g = await guard(req, { requireAdmin: true })
  if (!g.ok) return g.response

  const url = new URL(req.url)
  const id = url.searchParams.get('id') ?? ''
  if (!id) return NextResponse.json({ error: 'Provide ?id= of the user to delete.' }, { status: 400 })

  if (g.session?.uid === id) {
    return NextResponse.json({ error: 'You cannot delete your own account while signed in.' }, { status: 400 })
  }

  try {
    const user = await db.user.delete({ where: { id } })
    return NextResponse.json({ user: { id: user.id, email: user.email } })
  } catch {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 })
  }
}
