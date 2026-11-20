import { NextResponse } from 'next/server'
import { guard } from '@/lib/guard'
import { db } from '@/lib/db'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req)
  if (!g.ok) return g.response
  const { id } = await params
  const product = await db.product.findUnique({ where: { id } })
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  const related = await db.product.findMany({
    where: { category: product.category, id: { not: product.id } },
    take: 4,
  })
  return NextResponse.json({ product, related })
}
