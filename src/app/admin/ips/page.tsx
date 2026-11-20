'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, RefreshCw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AdminTitle } from '@/components/admin/shell'
import { timeAgo, STATUS_COLORS } from '@/lib/format'
import { toast } from '@/hooks/use-toast'

interface IpRow {
  id: string; ip: string; isValid: boolean; isPrivate: boolean
  country: string | null; region: string | null; city: string | null; isp: string | null
  userAgent: string | null; firstSeen: string; lastSeen: string
  totalRequests: number; failedLogins: number; successLogins: number
  distinctUsers: number; usernamesTried: number; geoJumps: number
  riskScore: number; threatLabel: string; status: string
  blockReason: string | null; blockedBy: string | null
}

const FILTERS = [
  { k: 'all', label: 'All' },
  { k: 'valid', label: 'Valid IPs' },
  { k: 'invalid', label: 'Invalid IPs' },
  { k: 'blocked', label: 'Blocked' },
  { k: 'watchlist', label: 'Watchlist' },
  { k: 'active', label: 'Active' },
]
const SORTS = [
  { k: 'risk', label: 'Risk score' },
  { k: 'recent', label: 'Last seen' },
  { k: 'requests', label: 'Requests' },
  { k: 'failed', label: 'Failed logins' },
]

export default function IpLedgerPage() {
  const [rows, setRows] = useState<IpRow[] | null>(null)
  const [credentials, setCredentials] = useState<Record<string, { username: string; success: boolean; at: string; reason: string | null }[]>>({})
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('risk')

  const load = useCallback(() => {
    const url = new URL('/api/admin/ips', window.location.origin)
    if (q) url.searchParams.set('q', q)
    url.searchParams.set('filter', filter)
    url.searchParams.set('sort', sort)
    url.searchParams.set('credentials', '1')
    fetch(url.toString(), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j) {
          setRows(j.ips)
          setCredentials(j.credentials ?? {})
        }
      })
      .catch(() => {})
  }, [q, filter, sort])

  useEffect(() => {
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [load])

  const quickAction = async (ip: string, action: 'block' | 'unblock') => {
    const r = await fetch('/api/admin/ip-actions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ip, action }),
    })
    if (r.ok) {
      toast({ title: action === 'block' ? `${ip} blocked` : `${ip} unblocked` })
      load()
    } else toast({ title: 'Action failed', variant: 'destructive' })
  }

  return (
    <div>
      <AdminTitle
        title="IP Ledger — Tracked IPs & Metadata"
        subtitle="Every IP that ever touched the store, with location, credentials tried, risk score and live status. Sort valid vs invalid."
      />

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search IP address…" className="pl-8 bg-slate-900 border-slate-700 text-sm text-slate-200 placeholder:text-slate-600" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.k}
              onClick={() => setFilter(f.k)}
              className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${filter === f.k ? 'bg-zinc-800 text-zinc-200 border-zinc-600' : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-600'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="text-xs bg-slate-900 border border-slate-800 rounded-md px-2 py-1.5 text-slate-300" aria-label="Sort IPs">
          {SORTS.map((s) => <option key={s.k} value={s.k}>Sort: {s.label}</option>)}
        </select>
        <Button variant="ghost" size="icon" onClick={load} className="text-slate-400" aria-label="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {rows === null ? (
        <Skeleton className="h-96 rounded-lg bg-slate-900" />
      ) : rows.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-10 text-center text-sm text-slate-500">
          No IPs match yet. Tracked IPs appear here as real visitors browse the store.
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {rows.map((r) => {
            const creds = credentials[r.ip] ?? []
            return (
              <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-lg p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono font-bold text-white text-sm flex items-center gap-2">
                      {r.ip}
                      {!r.isValid && <Badge className="bg-pink-600/20 text-pink-300 border border-pink-500/40 text-[9px]">INVALID</Badge>}
                      {r.isPrivate && <Badge className="bg-slate-700/40 text-slate-300 border border-slate-600/40 text-[9px]">PRIVATE</Badge>}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                      {r.city ?? 'Unknown'}{r.region ? `, ${r.region}` : ''}{r.country ? ` · ${r.country}` : ''} {r.isp ? `· ${r.isp}` : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-xl font-extrabold leading-none ${r.riskScore >= 80 ? 'text-red-400' : r.riskScore >= 55 ? 'text-zinc-300' : r.riskScore >= 30 ? 'text-amber-400' : 'text-zinc-300'}`}>
                      {Math.round(r.riskScore)}
                    </div>
                    <div className="text-[9px] text-slate-500 uppercase">{r.threatLabel}</div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 mt-3 text-center">
                  {[
                    { l: 'Requests', v: r.totalRequests },
                    { l: 'Failed logins', v: r.failedLogins },
                    { l: 'Users', v: r.distinctUsers },
                    { l: 'Geo jumps', v: r.geoJumps },
                  ].map((x) => (
                    <div key={x.l} className="bg-slate-800/50 rounded-md py-1.5">
                      <div className="text-sm font-bold text-slate-200">{x.v}</div>
                      <div className="text-[9px] text-slate-500 uppercase tracking-wide">{x.l}</div>
                    </div>
                  ))}
                </div>

                {creds.length > 0 && (
                  <div className="mt-3 border-t border-slate-800 pt-2">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1.5">Credentials tried from this IP</div>
                    <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                      {creds.map((c, i) => (
                        <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${c.success ? 'border-zinc-600 text-zinc-200 bg-zinc-800' : 'border-red-500/30 text-red-300 bg-red-500/10'}`}>
                          {c.username} {c.success ? '✓' : '✗'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-800 pt-2.5">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className={`text-[9px] ${STATUS_COLORS[r.status]}`}>{r.status}</Badge>
                    <span className="text-[10px] text-slate-500">seen {timeAgo(r.lastSeen)}</span>
                  </div>
                  {r.status === 'BLOCKED' ? (
                    <button onClick={() => quickAction(r.ip, 'unblock')} className="text-[11px] font-bold text-zinc-300 hover:text-zinc-200 border border-zinc-700 hover:bg-zinc-800 px-2.5 py-1 rounded-md">
                      Unblock
                    </button>
                  ) : (
                    <button onClick={() => quickAction(r.ip, 'block')} className="text-[11px] font-bold text-red-400 hover:text-red-300 border border-red-500/40 hover:bg-red-500/10 px-2.5 py-1 rounded-md">
                      Block
                    </button>
                  )}
                </div>
                {r.status === 'BLOCKED' && r.blockReason && (
                  <div className="mt-1.5 text-[10px] text-red-300/80 bg-red-500/5 border border-red-500/20 rounded px-2 py-1">
                    {r.blockReason} {r.blockedBy ? `· by ${r.blockedBy}` : ''}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
