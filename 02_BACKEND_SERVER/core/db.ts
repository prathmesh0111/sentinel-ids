import { PrismaClient } from '@prisma/client'

// The sandbox may export a stale DATABASE_URL (file:...) — force genuine Postgres.
if (!process.env.DATABASE_URL?.startsWith('postgres')) {
  process.env.DATABASE_URL = 'postgresql://postgres@127.0.0.1:5432/fraudmart'
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
