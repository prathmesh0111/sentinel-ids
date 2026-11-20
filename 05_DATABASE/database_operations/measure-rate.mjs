import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const r1 = await p.ipAddress.findUnique({ where: { ip: '::1' }, select: { totalRequests: true } })
await new Promise((r) => setTimeout(r, 10000))
const r2 = await p.ipAddress.findUnique({ where: { ip: '::1' }, select: { totalRequests: true } })
console.log('requests in 10s:', r2.totalRequests - r1.totalRequests, '=> per minute:', (r2.totalRequests - r1.totalRequests) * 6)
await p.$disconnect()
