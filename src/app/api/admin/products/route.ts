import { NextResponse } from 'next/server'
import { guard } from '@/lib/guard'
import { db } from '@/lib/db'

interface ProductBody {
  name?: string
  description?: string
  category?: string
  brand?: string
  price?: number // rupees from the admin UI
  mrp?: number
  image?: string
  stock?: number
  rating?: number
  featured?: boolean
}

function validate(body: ProductBody) {
  const errors: string[] = []
  const name = String(body.name ?? '').trim()
  const description = String(body.description ?? '').trim()
  const category = String(body.category ?? '').trim()
  const brand = String(body.brand ?? '').trim()
  const image = String(body.image ?? '').trim()

  if (name.length < 3) errors.push('Name must be at least 3 characters.')
  if (description.length < 10) errors.push('Description must be at least 10 characters.')
  if (!category) errors.push('Category is required.')
  if (!brand) errors.push('Brand is required.')
  if (!image) errors.push('Image URL/path is required.')

  // UI sends rupees; store as paise like the rest of the app
  const price = Math.round(Number(body.price ?? 0) * 100)
  const mrp = Math.round(Number(body.mrp ?? 0) * 100)
  if (!Number.isFinite(price) || price <= 0) errors.push('Price must be a positive amount.')
  if (!Number.isFinite(mrp) || mrp < price) errors.push('MRP must be greater than or equal to the price.')

  const stock = Math.max(0, Math.round(Number(body.stock ?? 0)))
  if (!Number.isFinite(stock)) errors.push('Stock must be a number.')

  const rating = Math.min(5, Math.max(0, Number(body.rating ?? 4.2)))
  if (!Number.isFinite(rating)) errors.push('Rating must be a number between 0 and 5.')

  return { errors, name, description, category, brand, image, price, mrp, stock, rating, featured: Boolean(body.featured) }
}

/** Full catalog management — admin only */
export async function GET(req: Request) {
  const g = await guard(req, { requireAdmin: true })
  if (!g.ok) return g.response

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') ?? '').trim()
  const category = url.searchParams.get('category') ?? ''
  const sort = url.searchParams.get('sort') ?? 'newest'

  const where: Record<string, unknown> = {}
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { brand: { contains: q, mode: 'insensitive' } },
      { category: { contains: q, mode: 'insensitive' } },
    ]
  }
  if (category && category !== 'All') where.category = category

  const orderBy =
    sort === 'price_asc' ? { price: 'asc' as const }
    : sort === 'price_desc' ? { price: 'desc' as const }
    : sort === 'stock' ? { stock: 'asc' as const }
    : sort === 'name' ? { name: 'asc' as const }
    : { createdAt: 'desc' as const }

  const [products, categories] = await Promise.all([
    db.product.findMany({
      where,
      orderBy,
      include: { _count: { select: { orderItems: true, cartItems: true } } },
    }),
    db.product.findMany({ distinct: ['category'], select: { category: true }, orderBy: { category: 'asc' } }),
  ])

  return NextResponse.json({
    products: products.map((p) => ({ ...p, soldCount: p._count.orderItems, inCarts: p._count.cartItems, _count: undefined })),
    categories: categories.map((c) => c.category),
  })
}

export async function POST(req: Request) {
  const g = await guard(req, { requireAdmin: true })
  if (!g.ok) return g.response

  const body = await req.json().catch(() => ({}))
  const v = validate(body)
  if (v.errors.length) return NextResponse.json({ error: v.errors.join(' ') }, { status: 400 })

  const existing = await db.product.findUnique({ where: { name: v.name } })
  if (existing) return NextResponse.json({ error: `A product named "${v.name}" already exists.` }, { status: 409 })

  try {
    const product = await db.product.create({
      data: {
        name: v.name,
        description: v.description,
        category: v.category,
        brand: v.brand,
        image: v.image,
        price: v.price,
        mrp: v.mrp,
        stock: v.stock,
        rating: v.rating,
        featured: v.featured,
      },
    })
    return NextResponse.json({ product }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Could not create the product.' }, { status: 500 })
  }
}
