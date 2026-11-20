/**
 * Full reset EXCEPT trained models:
 *  - keeps: ModelArtifact (active RF + IF), the admin login account,
 *           the 24-product catalog and system settings
 *  - wipes: security events, tracked IPs, credential ledger, training samples,
 *           traffic minutes, orders, carts, all other users (cascade removes
 *           their orders/login history), ml/data training intermediates
 * Run while the app can stay up — restart the app afterwards to zero the
 * engine's in-memory blocklist and traffic buffers too.
 */
import { PrismaClient } from '@prisma/client'
import { unlink } from 'node:fs/promises'

const ADMIN_EMAIL = 'admin@securemart.in'
const p = new PrismaClient()

async function main() {
  console.log('resetting everything except trained models…')
  await p.securityEvent.deleteMany({})
  await p.credentialAttempt.deleteMany({})
  await p.ipAddress.deleteMany({})
  await p.trainingSample.deleteMany({})
  await p.trafficMinute.deleteMany({})
  await p.orderItem.deleteMany({})
  await p.order.deleteMany({})
  await p.cartItem.deleteMany({})
  const others = await p.user.deleteMany({ where: { email: { not: ADMIN_EMAIL } } })
  console.log(`deleted ${others.count} non-admin users (orders + login history cascaded)`)
  for (const f of ['ml/data/current.json', 'ml/data/model.json']) {
    try { await unlink(f); console.log('removed', f) } catch { /* already gone */ }
  }
  const kept = {
    models: await p.modelArtifact.count({ where: { active: true } }),
    admin: await p.user.count({ where: { email: ADMIN_EMAIL } }),
    products: await p.product.count(),
  }
  console.log(`kept: ${kept.models} active models, admin account, ${kept.products} products`)
}

main()
  .catch((e) => { console.error('reset failed:', e.message); process.exit(1) })
  .finally(() => p.$disconnect())
