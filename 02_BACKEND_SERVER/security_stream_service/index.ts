/**
 * security-stream — realtime security event broadcaster (socket.io, port 3003).
 *
 * The Next.js security engine POSTs freshly flushed events to /emit; this
 * service pushes them to every connected admin dashboard over websockets.
 * A DB backup poller catches any events missed while the stream was busy.
 */
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import pg from 'pg'

const PORT = Number(process.env.PORT ?? 3003)
const DB_URL = process.env.DATABASE_URL?.startsWith('postgres')
  ? process.env.DATABASE_URL
  : 'postgresql://postgres@127.0.0.1:5432/fraudmart'

const httpServer = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/emit') {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      try {
        const { events } = JSON.parse(body)
        if (Array.isArray(events) && events.length) {
          const mapped = events.map((e: Record<string, unknown>, i: number) => ({
            id: `e-${Date.now()}-${i}`,
            ip: e.ip,
            username: e.username ?? null,
            type: e.type,
            severity: e.severity,
            title: e.title,
            createdAt: new Date().toISOString(),
          }))
          io.emit('security-event', mapped.length === 1 ? mapped[0] : mapped)
          if (Array.isArray(events) && events.length > 1) {
            // emit each individually so clients can batch-render
            for (const m of mapped.slice(1)) io.emit('security-event', m)
          }
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ ok: true, emitted: mapped.length }))
          return
        }
      } catch { /* malformed body */ }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: true, emitted: 0 }))
    })
    return
  }
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ ok: true, service: 'security-stream', clients: io.engine.clientsCount }))
})

const io = new Server(httpServer, {
  // socket.io keeps its default /socket.io path so POST /emit below still reaches
  // this HTTP server; Caddy routes by the XTransformPort query param.
  path: '/socket.io',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

io.on('connection', (socket) => {
  console.log(`[stream] dashboard connected: ${socket.id}`)
  socket.on('disconnect', () => {
    console.log(`[stream] dashboard disconnected: ${socket.id}`)
  })
  socket.on('error', (err) => console.error('[stream] socket error:', err))
})

// ── DB backup poller: safety net for events emitted while the HTTP /emit call failed
const client = new pg.Client({ connectionString: DB_URL })
let lastId: string | null = null

async function poll() {
  try {
    const res = lastId
      ? await client.query(
          `SELECT id, ip, username, type, severity, title, "createdAt" FROM "SecurityEvent" WHERE id > $1 ORDER BY "createdAt" ASC LIMIT 40`,
          [lastId],
        )
      : await client.query(
          `SELECT id, ip, username, type, severity, title, "createdAt" FROM "SecurityEvent" ORDER BY "createdAt" DESC LIMIT 1`,
        )
    for (const row of res.rows.reverse()) {
      lastId = row.id
      io.emit('security-event', {
        id: row.id,
        ip: row.ip,
        username: row.username,
        type: row.type,
        severity: row.severity,
        title: row.title,
        createdAt: row.created_at,
      })
    }
  } catch { /* db not ready yet */ }
}

async function main() {
  // small retry loop — postgres may still be starting on cold boot
  for (let i = 0; i < 30; i++) {
    try {
      await client.connect()
      break
    } catch {
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
  const boot = await client.query(`SELECT id FROM "SecurityEvent" ORDER BY "createdAt" DESC LIMIT 1`).catch(() => ({ rows: [] }))
  lastId = boot.rows[0]?.id ?? null
  setInterval(() => void poll(), 3000)
  console.log('[stream] db poller armed (3s interval, dedupe by id)')
}

void main()

httpServer.listen(PORT, () => {
  console.log(`security-stream websocket server running on port ${PORT}`)
})

process.on('SIGTERM', () => {
  httpServer.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  httpServer.close(() => process.exit(0))
})
