import { NextResponse } from 'next/server'
import { guard } from '@/lib/guard'
import { engine } from '@/lib/security/engine'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  const g = await guard(req, { requireAuth: true })
  if (!g.ok) return g.response
  const orders = await db.order.findMany({
    where: { userId: g.session!.uid },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ orders })
}

export async function POST(req: Request) {
  const g = await guard(req, { requireAuth: true })
  if (!g.ok) return g.response

  const body = await req.json()
  const fullName = String(body.fullName ?? '').trim()
  const phone = String(body.phone ?? '').trim()
  const addressLine = String(body.addressLine ?? '').trim()
  const city = String(body.city ?? '').trim()
  const state = String(body.state ?? '').trim()
  const pincode = String(body.pincode ?? '').trim()
  const paymentMethod = body.paymentMethod === 'UPI' ? 'UPI' : body.paymentMethod === 'Card' ? 'Card' : 'COD'

  if (!fullName || !/^\d{10}$/.test(phone) || !addressLine || !city || !state || !/^\d{6}$/.test(pincode)) {
    return NextResponse.json(
      { error: 'Please fill all address fields correctly (10-digit phone, 6-digit pincode).' },
      { status: 400 },
    )
  }

  const cartItems = await db.cartItem.findMany({
    where: { userId: g.session!.uid },
    include: { product: true },
  })
  if (!cartItems.length) return NextResponse.json({ error: 'Your cart is empty.' }, { status: 400 })

  for (const item of cartItems) {
    if (item.product.stock < item.quantity) {
      return NextResponse.json({ error: `${item.product.name} has only ${item.product.stock} left in stock.` }, { status: 400 })
    }
  }

  const total = cartItems.reduce((acc, i) => acc + i.product.price * i.quantity, 0)

  const order = await db.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        userId: g.session!.uid,
        total,
        paymentMethod,
        fullName,
        phone,
        addressLine,
        city,
        state,
        pincode,
        ip: g.info.ip,
        items: {
          create: cartItems.map((i) => ({
            productId: i.productId,
            name: i.product.name,
            price: i.product.price,
            quantity: i.quantity,
          })),
        },
      },
      include: { items: true },
    })
    for (const i of cartItems) {
      await tx.product.update({ where: { id: i.productId }, data: { stock: { decrement: i.quantity } } })
    }
    await tx.cartItem.deleteMany({ where: { userId: g.session!.uid } })
    return created
  })

  engine.emit({
    ip: g.info.ip, userId: g.session!.uid, username: g.session!.email, type: 'ORDER_PLACED', severity: 'LOW',
    title: `Order placed: ${order.items.length} item(s), ₹${(total / 100).toLocaleString('en-IN')}`,
    details: { orderId: order.id, total, paymentMethod },
  })

  return NextResponse.json({ ok: true, order })
}
