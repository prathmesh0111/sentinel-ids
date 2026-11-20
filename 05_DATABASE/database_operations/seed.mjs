/**
 * SecureMart seed — idempotent.
 * Seeds ONLY: the real product catalog (required for a functioning store),
 * system settings and the admin invitation code. 
 * It NEVER seeds fake users, fake security events, fake IPs or fake orders —
 * all of those accrue from real usage of the running application.
 */
import { PrismaClient } from '@prisma/client'

// The sandbox may export a stale DATABASE_URL — force our genuine Postgres.
if (!process.env.DATABASE_URL?.startsWith('postgres')) {
  process.env.DATABASE_URL = 'postgresql://postgres@127.0.0.1:5432/fraudmart'
}

const prisma = new PrismaClient()

const IMG = {
  'samsung-s24': 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/ab0de9d02a42.jpg',
  'iphone15': 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/6d3488d4fa18.jpg',
  'redmi-note13': 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/8e700630f303.png',
  'boat-airdopes': 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/55a088cc096c.jpg',
  'sony-headphones': 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/c80ab80034a2.jpg',
  'jbl-flip6': 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/23cc0ae7ea4c.jpg',
  'hp-pavilion': 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/703d7cb4ac49.jpg',
  'lenovo-ideapad': 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/f8873322a66d.jpg',
  'macbook-air': 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/27c66c7fdb42.jpg',
  'apple-watch-se': 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/4073e09b11b5.jpg',
  'noise-watch': 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/9b854b6fb952.jpg',
  'galaxy-tab': 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/ff9f8343431d.jpg',
  'nike-shoes': 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/b39900f5b11e.jpg',
  'adidas-shoes': 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/35ed75c70a94.jpg',
  'levis-jeans': 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/1e997fa43e2f.jpeg',
  'uspolo-tshirt': 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/9867107e9612.jpg',
  'rayban': 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/ec9b73e900b1.jpg',
  'prestige-mixer': 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/a9bfa6e36b83.jpg',
  'philips-airfryer': 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/619866f69c04.jpg',
  'milton-flask': 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/54cb17ca816e.jpg',
  'loreal-serum': 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/3f843ec4f1f4.jpg',
  'philips-trimmer': 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/d3a36d6f90bc.jpg',
  'nescafe': 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/7dbadb9cdb2d.jpg',
  'pigeon-cookware': 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/80dad5a0eb05.jpg',
}

// Real, real-brand catalog with market-realistic INR pricing (prices in paise)
const PRODUCTS = [
  { key: 'samsung-s24', name: 'Samsung Galaxy S24 5G (Marble Grey, 128 GB)', brand: 'Samsung', category: 'Mobiles', price: 6499900, mrp: 7999900, rating: 4.6, featured: true, description: 'Galaxy AI smartphone with a 6.2" FHD+ Dynamic AMOLED 2X display, 50MP triple camera with Nightography, 4000mAh battery and 7 years of OS upgrades. Powered by Exynos 2400 with flagship-grade performance.' },
  { key: 'iphone15', name: 'Apple iPhone 15 (Blue, 128 GB)', brand: 'Apple', category: 'Mobiles', price: 6590000, mrp: 7990000, rating: 4.7, featured: true, description: 'Dynamic Island, 48MP Main camera with 2x Telephoto, A16 Bionic chip and USB-C. Colour-infused glass and aerospace-grade aluminium in a light, durable design.' },
  { key: 'redmi-note13', name: 'Redmi Note 13 Pro (Midnight Black, 128 GB)', brand: 'Xiaomi', category: 'Mobiles', price: 2499900, mrp: 2999900, rating: 4.4, featured: true, description: '200MP flagship OIS camera, 1.5K 120Hz AMOLED curved display, Snapdragon 7s Gen 2 and 5100mAh battery with 67W turbo charging.' },
  { key: 'boat-airdopes', name: 'boAt Airdopes 161 TWS Earbuds (Black)', brand: 'boAt', category: 'Audio', price: 129900, mrp: 299000, rating: 4.1, featured: false, description: 'Up to 40 hours playback with ASAP Charge, 13mm drivers with boAt signature sound, ENx environmental noise cancellation and IPX5 water resistance.' },
  { key: 'sony-headphones', name: 'Sony WH-CH720N Noise Cancelling Headphones (Black)', brand: 'Sony', category: 'Audio', price: 899000, mrp: 1499000, rating: 4.4, featured: true, description: 'Lightweight (192g) wireless headphones with Dual Noise Sensor technology, V1 processor, 35-hour battery, multipoint connection and Ambient Sound mode.' },
  { key: 'jbl-flip6', name: 'JBL Flip 6 Portable Bluetooth Speaker (Blue)', brand: 'JBL', category: 'Audio', price: 999900, mrp: 1299900, rating: 4.5, featured: false, description: 'Bold JBL Pro Sound with a separate tweeter for crystal-clear highs, IP67 waterproof and dustproof, 12 hours of playtime and PartyBoost pairing.' },
  { key: 'hp-pavilion', name: 'HP Pavilion 14 Laptop (12th Gen i5-1235U, 16GB/512GB)', brand: 'HP', category: 'Laptops', price: 5299000, mrp: 6499900, rating: 4.3, featured: false, description: '14" FHD IPS micro-edge display, 12th Gen Intel Core i5-1235U, 16GB DDR4 RAM, 512GB NVMe SSD, backlit keyboard, Windows 11 + MS Office 2021, Intel Iris Xe graphics.' },
  { key: 'lenovo-ideapad', name: 'Lenovo IdeaPad Slim 3 (Ryzen 5 7520U, 16GB/512GB)', brand: 'Lenovo', category: 'Laptops', price: 3849000, mrp: 5299900, rating: 4.2, featured: false, description: '15.6" FHD thin & light laptop with AMD Ryzen 5 7520U, 16GB LPDDR5 RAM, 512GB SSD, rapid charge battery and privacy shutter camera. Windows 11 Home.' },
  { key: 'macbook-air', name: 'Apple MacBook Air M2 (Midnight, 8GB/256GB)', brand: 'Apple', category: 'Laptops', price: 8990000, mrp: 11490000, rating: 4.8, featured: true, description: 'Strikingly thin laptop with the M2 chip, 13.6" Liquid Retina display, up to 18 hours of battery life, 1080p FaceTime HD camera and four-speaker sound system.' },
  { key: 'apple-watch-se', name: 'Apple Watch SE (2nd Gen) 40mm GPS', brand: 'Apple', category: 'Wearables', price: 2490000, mrp: 2990000, rating: 4.5, featured: false, description: 'Essential smartwatch features: crash detection, sleep tracking, heart-rate monitoring, workout metrics and up to 18 hours of battery life. Swimproof design.' },
  { key: 'noise-watch', name: 'Noise ColorFit Pro 5 Smartwatch (Jet Black)', brand: 'Noise', category: 'Wearables', price: 349900, mrp: 699900, rating: 4.1, featured: false, description: '1.85" AMOLED display with 500 nits, Bluetooth calling, 7-day battery, 100+ sports modes, sleep & stress tracking and Noise Health Suite.' },
  { key: 'galaxy-tab', name: 'Samsung Galaxy Tab A9+ 11" (Graphite, 8GB/128GB)', brand: 'Samsung', category: 'Tablets', price: 1999900, mrp: 2599900, rating: 4.3, featured: false, description: '11" 90Hz WUXGA+ display, quad speakers with Dolby Atmos, Snapdragon 695, 8GB RAM, 7040mAh battery and Samsung Kids home mode.' },
  { key: 'nike-shoes', name: 'Nike Revolution 7 Men\'s Road Running Shoes', brand: 'Nike', category: 'Footwear', price: 399500, mrp: 499500, rating: 4.3, featured: true, description: 'Soft foam midsole for a smooth ride, breathable knit upper and a recycled-materials construction with at least 20% by weight.' },
  { key: 'adidas-shoes', name: 'adidas Ultraboost Light Running Shoes', brand: 'adidas', category: 'Footwear', price: 1299900, mrp: 1999900, rating: 4.6, featured: false, description: 'Light BOOST midsole with 30% lighter cushioning, PRIMEKNIT+ adaptive upper and Continental rubber outsole for extraordinary grip.' },
  { key: 'levis-jeans', name: "Levi's 511 Slim Fit Men's Jeans (Blue)", brand: "Levi's", category: 'Clothing', price: 279900, mrp: 399900, rating: 4.4, featured: false, description: 'The iconic 511 slim fit with stretch denim for all-day comfort. Classic five-pocket styling, button closure and zip fly. A modern slim silhouette.' },
  { key: 'uspolo-tshirt', name: 'U.S. POLO ASSN. Men\'s Cotton Polo T-Shirt', brand: 'U.S. Polo Assn.', category: 'Clothing', price: 89900, mrp: 179900, rating: 4.2, featured: false, description: 'Premium pique cotton polo with tipped collar, ribbed cuffs and embroidered logo. Regular fit, breathable and machine washable.' },
  { key: 'rayban', name: 'Ray-Ban Aviator Classic Sunglasses (Gold/Green G-15)', brand: 'Ray-Ban', category: 'Accessories', price: 829000, mrp: 1049900, rating: 4.7, featured: false, description: 'The original aviator since 1937. G-15 green lenses with 100% UV protection in a gold metal frame. Includes branded case and cleaning cloth.' },
  { key: 'prestige-mixer', name: 'Prestige Iris 750W Mixer Grinder (4 Jars, White)', brand: 'Prestige', category: 'Kitchen Appliances', price: 319500, mrp: 499500, rating: 4.2, featured: false, description: '750W powerful motor with 4 stainless steel jars including a juicer jar, 3-speed control with pulse and overload protection for safe grinding.' },
  { key: 'philips-airfryer', name: 'Philips HD9200 Air Fryer (4.1L, Grey)', brand: 'Philips', category: 'Kitchen Appliances', price: 799900, mrp: 1099500, rating: 4.4, featured: true, description: 'Rapid Air technology for 90% less oil, 4.1L capacity serving up to 5 people, adjustable temperature control and dishwasher-safe basket.' },
  { key: 'milton-flask', name: 'Milton Thermosteel Flip Lid Flask 1000ml (Silver)', brand: 'Milton', category: 'Home & Kitchen', price: 109900, mrp: 169900, rating: 4.3, featured: false, description: 'Double-walled vacuum insulated stainless steel flask that keeps beverages hot or cold for up to 24 hours. Leak-proof flip lid, 1 litre capacity.' },
  { key: 'loreal-serum', name: "L'Oréal Paris Revitalift 1.5% Hyaluronic Acid Serum (30ml)", brand: "L'Oréal Paris", category: 'Beauty', price: 134900, mrp: 199900, rating: 4.3, featured: false, description: 'Dermatologist-approved serum with 1.5% hyaluronic acid for plumper, hydrated skin. Reduces fine lines with visible results in 2 weeks.' },
  { key: 'philips-trimmer', name: 'Philips BT1234/15 Beard Trimmer (Black)', brand: 'Philips', category: 'Personal Care', price: 119500, mrp: 179500, rating: 4.2, featured: false, description: 'DuraPower longer-lasting battery, stainless steel self-sharpening blades, 10 length settings (0.5-10mm) and 45 minutes of cordless use.' },
  { key: 'nescafe', name: 'NESCAFÉ Classic Instant Coffee 200g Jar', brand: 'NESCAFÉ', category: 'Grocery', price: 54900, mrp: 69900, rating: 4.4, featured: false, description: '100% pure instant coffee made from medium-dark roasted arabica & robusta beans. Rich aroma and the signature NESCAFÉ taste.' },
  { key: 'pigeon-cookware', name: 'Pigeon by Stovekraft Non-stick Cookware Set (3 pcs)', brand: 'Pigeon', category: 'Home & Kitchen', price: 149900, mrp: 279900, rating: 4.1, featured: false, description: 'Set of fry pan, kadai with lid and dosa tawa with 3-layer non-stick German coating. Gas-stove and induction compatible, PFOA-free.' },
]

const SETTINGS = {
  RISK_THRESHOLD: '80',           // auto-block when risk ≥ 80
  AUTO_BLOCK_ENABLED: 'true',
  DDOS_RPM: '120',                // requests/min considered DDoS-level
  BRUTE_FORCE_ATTEMPTS: '8',      // failed logins / 10 min
  ADMIN_INVITE_CODE: 'ADMIN-2026-SENTINEL',
  RETRAIN_MIN_SAMPLES: '30',
  RETRAIN_INTERVAL_MIN: '5',
}

async function main() {
  console.log('[seed] seeding product catalog + system settings (no fake users/events/data)...')

  for (const p of PRODUCTS) {
    const image = IMG[p.key]
    if (!image) { console.warn('[seed] no image for', p.key); continue }
    const { key, ...data } = p
    await prisma.product.upsert({
      where: { name: p.name },
      update: { ...data, image },
      create: { ...data, image },
    })
  }

  for (const [key, value] of Object.entries(SETTINGS)) {
    await prisma.systemSetting.upsert({
      where: { key },
      update: {}, // do not override admin-tuned values on re-seed
      create: { key, value },
    })
  }

  const products = await prisma.product.count()
  console.log(`[seed] done — ${products} products, ${Object.keys(SETTINGS).length} settings`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
