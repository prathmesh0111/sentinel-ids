import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const ev = await p.securityEvent.deleteMany({})
const cr = await p.credentialAttempt.deleteMany({})
const ip = await p.ipAddress.deleteMany({})
const tm = await p.trafficMinute.deleteMany({})
console.log(`wiped: ${ev.count} security events, ${cr.count} credential attempts, ${ip.count} tracked IPs, ${tm.count} traffic minutes`)
console.log(`kept: users=${await p.user.count()} (real emails), products=${await p.product.count()}, ML samples=${await p.trainingSample.count()}, active models=${await p.modelArtifact.count({ where: { active: true } })}`)
await p.$disconnect()
