import { NextResponse } from 'next/server'
import { guard } from '@/lib/guard'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  const g = await guard(req)
  if (!g.ok) return g.response

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') ?? '').trim()
  const category = url.searchParams.get('category') ?? ''
  const sort = url.searchParams.get('sort') ?? 'featured'

  const where: Record<string, unknown> = {}
  if (q) where.OR = [{ name: { contains: q, mode: 'insensitive' } }, { brand: { contains: q, mode: 'insensitive' } }, { category: { contains: q, mode: 'insensitive' } }]
  if (category && category !== 'All') where.category = category

  const orderBy =
    sort === 'price_asc' ? { price: 'asc' as const }
    : sort === 'price_desc' ? { price: 'desc' as const }
    : sort === 'rating' ? { rating: 'desc' as const }
    : [{ featured: 'desc' as const }, { rating: 'desc' as const }]

  const products = await db.product.findMany({ where, orderBy })
  const categories = await db.product.findMany({ distinct: ['category'], select: { category: true }, orderBy: { category: 'asc' } })

  return NextResponse.json({ products, categories: categories.map((c) => c.category) })
}
