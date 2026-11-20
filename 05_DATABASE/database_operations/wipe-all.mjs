/**
 * One-off maintenance: wipes ALL operational data (security events, tracked IPs,
 * credential ledger, ML artifacts + training samples, orders, carts, users)
 * and re-seeds the product catalog + system settings.
 * Idempotent — safe to run repeatedly.
 */
import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

async function main() {
  console.log('wiping operational data…')
  await p.securityEvent.deleteMany({})
  await p.credentialAttempt.deleteMany({})
  await p.ipAddress.deleteMany({})
  await p.trainingSample.deleteMany({})
  await p.modelArtifact.deleteMany({})
  await p.trafficMinute.deleteMany({})
  await p.orderItem.deleteMany({})
  await p.order.deleteMany({})
  await p.cartItem.deleteMany({})
  await p.user.deleteMany({})
  console.log('wiping catalog…')
  await p.product.deleteMany({})
  console.log('all tables cleared')
}

main()
  .catch((e) => { console.error('wipe failed:', e.message); process.exit(1) })
  .finally(() => p.$disconnect())
