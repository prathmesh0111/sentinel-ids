/**
 * Starts a genuine PostgreSQL 18 server (user-space binaries, no root/admin needed).
 * - Cross-platform: Windows (windows-x64), Linux (x64/arm64), macOS (x64/arm64).
 * - Idempotent: exits fast if the server is already accepting connections.
 * - Initializes the data directory on first run.
 * - Creates the application database if missing.
 * Used by `npm run db:push` and `npm run dev` so Postgres is always up.
 */
import net from 'node:net'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// this file lives at <root>/05_DATABASE/database_connection/ — project root is 2 levels up
const ROOT = path.resolve(__dirname, '..', '..')

// ---- platform resolution --------------------------------------------------
const PKG_BY_PLATFORM = {
  'linux-x64': 'linux-x64',
  'linux-arm64': 'linux-arm64',
  'darwin-x64': 'darwin-x64',
  'darwin-arm64': 'darwin-arm64',
  'win32-x64': 'windows-x64',
}
const PLATFORM_KEY = `${os.platform()}-${os.arch()}`
const PG_PKG = PKG_BY_PLATFORM[PLATFORM_KEY]
const IS_WIN = process.platform === 'win32'
const exe = (name) => (IS_WIN ? `${name}.exe` : name)

if (!PG_PKG) {
  console.error(`[pg-start] unsupported platform: ${PLATFORM_KEY}`)
  console.error('[pg-start] supported: linux-x64, linux-arm64, darwin-x64, darwin-arm64, win32-x64')
  process.exit(1)
}

const PG_BIN = path.join(ROOT, 'node_modules', '@embedded-postgres', PG_PKG, 'native', 'bin')
const PG_DATA = path.join(ROOT, '05_DATABASE', 'postgres_data', 'pgdata')
const PORT = 5432
const HOST = '127.0.0.1'
const DB_NAME = 'fraudmart'
const DB_USER = 'postgres'

// Linux only: the sandbox may ship an old system ICU; prefer the bundled newer one.
const env = { ...process.env }
if (!IS_WIN) {
  const libsDir = path.join(ROOT, '.pg-libs', 'extracted', 'usr', 'lib', 'x86_64-linux-gnu')
  if (fs.existsSync(libsDir)) {
    env.LD_LIBRARY_PATH = env.LD_LIBRARY_PATH ? `${libsDir}:${env.LD_LIBRARY_PATH}` : libsDir
  }
}

function canConnect() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: HOST, port: PORT }, () => {
      socket.destroy()
      resolve(true)
    })
    socket.on('error', () => resolve(false))
    socket.setTimeout(500, () => { socket.destroy(); resolve(false) })
  })
}

async function dbExists(name) {
  const client = new pg.Client({ host: HOST, port: PORT, user: DB_USER, database: 'postgres' })
  try {
    await client.connect()
    const res = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name])
    return res.rowCount > 0
  } catch { return false } finally { try { await client.end() } catch {} }
}

async function createDb(name) {
  const client = new pg.Client({ host: HOST, port: PORT, user: DB_USER, database: 'postgres' })
  try {
    await client.connect()
    await client.query(`CREATE DATABASE "${name}"`)
    console.log(`[pg-start] created database ${name}`)
  } catch (e) {
    if (!String(e.message).includes('already exists')) throw e
  } finally { try { await client.end() } catch {} }
}

async function main() {
  if (await canConnect()) {
    console.log('[pg-start] postgres already running on port', PORT, '— nothing to do')
    process.exit(0)
  }

  if (!fs.existsSync(path.join(PG_BIN, exe('pg_ctl')))) {
    console.error(`[pg-start] postgres binaries missing (expected @embedded-postgres/${PG_PKG})`)
    console.error('[pg-start] run: npm install   (the platform package is an optionalDependency)')
    process.exit(1)
  }

  if (!fs.existsSync(PG_DATA)) {
    fs.mkdirSync(PG_DATA, { recursive: true })
    console.log('[pg-start] initializing postgres data directory...')
    const r = spawnSync(path.join(PG_BIN, exe('initdb')), [
      '-D', PG_DATA, '-U', DB_USER, '--auth=trust',
      '--encoding=UTF8', '--no-locale',
    ], { env, stdio: ['ignore', 'pipe', 'pipe'] })
    if (r.status !== 0) {
      console.error('[pg-start] initdb failed:', r.stderr?.toString() || r.stdout?.toString())
      process.exit(1)
    }
  }

  console.log('[pg-start] starting postgres on port', PORT, '...')
  // stdio must not be piped for `pg_ctl start`: the postgres server process
  // inherits pg_ctl's handles and keeps them open, so piped spawnSync would
  // block forever waiting for the pipes to close (hangs on Windows).
  const start = spawnSync(path.join(PG_BIN, exe('pg_ctl')), [
    '-D', PG_DATA,
    '-l', path.join(ROOT, '08_LOGS_AND_REPORTS', 'postgres_activity_log', 'postgres.log'),
    '-o', `-p ${PORT} -c listen_addresses=${HOST} -c max_connections=200${IS_WIN ? '' : ' -c unix_socket_directories=/tmp'}`,
    'start',
  ], { env, stdio: 'ignore', timeout: 60_000 })
  if (start.error || start.status !== 0) {
    console.error('[pg-start] pg_ctl start failed:', start.error?.message || `exit code ${start.status} (see db/postgres.log)`)
    process.exit(1)
  }

  for (let i = 0; i < 60; i++) {
    if (await canConnect()) break
    await new Promise((r) => setTimeout(r, 500))
  }
  if (!(await canConnect())) {
    console.error('[pg-start] postgres did not become ready in time')
    process.exit(1)
  }

  if (!(await dbExists(DB_NAME))) {
    await createDb(DB_NAME)
  }
  console.log('[pg-start] postgres ready: postgresql://' + HOST + ':' + PORT + '/' + DB_NAME)
  process.exit(0)
}

main().catch((e) => { console.error('[pg-start] fatal:', e); process.exit(1) })
