/**
 * Boot helper for the one-click launcher (run_application.bat):
 *  1. starts embedded PostgreSQL (idempotent, creates the DB if missing)
 *  2. if the catalog is EMPTY (or schema missing) runs the full first-run
 *     setup: schema push + seed of the 24-product catalog
 *  3. otherwise touches nothing — admin's product edits, orders, users and
 *     security history are preserved across restarts.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

// this file lives at <root>/05_DATABASE/database_connection/ — project root is 2 levels up
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const PG_START = path.join(ROOT, '05_DATABASE', 'database_connection', 'pg-start.mjs')

const prisma = new PrismaClient()

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true, cwd })
  return r.status ?? 1
}

try {
  // 1. postgres must be up before anything else
  let code = run('node', [JSON.stringify(PG_START)], ROOT)
  if (code !== 0) {
    console.error('[boot] PostgreSQL did not start — see messages above.')
    process.exit(code)
  }

  // 2. first run = no schema (count throws) or empty catalog
  let products
  try {
    products = await prisma.product.count()
  } catch {
    products = -1 // table missing → schema never pushed
  }

  if (products === -1 || products === 0) {
    console.log('[boot] empty database — first run: creating schema + seeding catalog...')
    code = run('npm', ['run', 'db:push'], ROOT)
    if (code !== 0) process.exit(code)
    console.log('[boot] database ready (fresh install).')
  } else {
    console.log(`[boot] database ready — ${products} products and all existing data intact.`)
  }
  process.exit(0)
} catch (e) {
  console.error('[boot] unexpected failure:', e.message)
  process.exit(1)
} finally {
  await prisma.$disconnect()
}
