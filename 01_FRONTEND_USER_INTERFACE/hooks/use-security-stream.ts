'use client'

/**
 * Realtime security event stream (socket.io mini-service on :3003 via the
 * gateway). Includes an automatic polling fallback so the console stays
 * correct even when websockets are unavailable (e.g. direct local access).
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { io, type Socket } from 'socket.io-client'

export interface StreamEvent {
  id: string
  ip: string
  username?: string | null
  type: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  title: string
  createdAt: string
  details?: Record<string, unknown>
}

export function useSecurityStream(maxEvents = 80) {
  const [connected, setConnected] = useState(false)
  const [events, setEvents] = useState<StreamEvent[]>([])
  const socketRef = useRef<Socket | null>(null)
  const pending = useRef<StreamEvent[]>([])
  const seen = useRef<Set<string>>(new Set())
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const everConnected = useRef(false)

  const push = useCallback((e: StreamEvent) => {
    if (seen.current.has(e.id)) return
    seen.current.add(e.id)
    pending.current = [e, ...pending.current].slice(0, maxEvents)
  }, [maxEvents])

  // batch incoming events to avoid render storms during floods
  useEffect(() => {
    const timer = setInterval(() => {
      if (pending.current.length) {
        const batch = pending.current
        pending.current = []
        setEvents((prev) => [...batch, ...prev].slice(0, maxEvents))
      }
    }, 400)
    return () => clearInterval(timer)
  }, [maxEvents])

  // polling fallback — activates whenever the socket is down
  useEffect(() => {
    const startPolling = () => {
      if (pollRef.current) return
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch('/api/admin/events?limit=30', { cache: 'no-store' })
          if (!r.ok) return
          const j = await r.json()
          for (const e of (j.events ?? []).reverse()) push(e)
        } catch { /* offline */ }
      }, 4000)
    }
    const stopPolling = () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }

    let disposed = false
    let socket: Socket | null = null
    try {
      // production: the stream service runs on Render (NEXT_PUBLIC_STREAM_URL);
      // local dev keeps the gateway-routed same-origin path
      const streamUrl = process.env.NEXT_PUBLIC_STREAM_URL ?? '/?XTransformPort=3003'
      socket = io(streamUrl, {
        transports: ['websocket', 'polling'],
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 6,
        reconnectionDelay: 2500,
        timeout: 8000,
      })
    } catch {
      startPolling()
      return () => { disposed = true; stopPolling() }
    }
    socketRef.current = socket

    socket.on('connect', () => {
      if (disposed) return
      everConnected.current = true
      setConnected(true)
      stopPolling()
    })
    socket.on('disconnect', () => {
      if (disposed) return
      setConnected(false)
      startPolling()
    })
    socket.on('connect_error', () => {
      if (disposed) return
      setConnected(false)
      startPolling()
    })
    socket.on('security-event', (e: StreamEvent | StreamEvent[]) => {
      if (disposed) return
      if (Array.isArray(e)) e.forEach(push)
      else push(e)
    })

    // make sure polling starts even before any socket error fires
    const kickoff = setTimeout(() => {
      if (!everConnected.current) startPolling()
    }, 5000)

    return () => {
      disposed = true
      clearTimeout(kickoff)
      stopPolling()
      socket?.disconnect()
      socketRef.current = null
    }
  }, [push])

  const clear = useCallback(() => {
    pending.current = []
    setEvents([])
  }, [])

  return { connected, events, clear }
}
