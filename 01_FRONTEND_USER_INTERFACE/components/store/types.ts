export interface Product {
  id: string
  name: string
  description: string
  category: string
  brand: string
  price: number
  mrp: number
  image: string
  stock: number
  rating: number
  featured: boolean
  createdAt: string
}

export interface CartItemRow {
  id: string
  quantity: number
  product: Product
}

export interface OrderRow {
  id: string
  total: number
  status: 'PLACED' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
  paymentMethod: string
  fullName: string
  phone: string
  addressLine: string
  city: string
  state: string
  pincode: string
  ip: string | null
  createdAt: string
  items: { id: string; name: string; price: number; quantity: number; productId: string }[]
}
