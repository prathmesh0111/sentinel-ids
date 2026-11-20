'use client'

import { useEffect, useState, useCallback } from 'react'
import { Lock, LockOpen, RefreshCw, ShieldOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AdminTitle } from '@/components/admin/shell'
import { timeAgo, STATUS_COLORS } from '@/lib/format'
import { toast } from '@/hooks/use-toast'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'

interface IpRow {
  id: string; ip: string; isValid: boolean; isPrivate: boolean
  country: string | null; city: string | null
  riskScore: number; threatLabel: string; status: string
  blockReason: string | null; blockedBy: string | null; blockedAt: string | null
  failedLogins: number; totalRequests: number; lastSeen: string
}

export default function AccessControlPage() {
  const [rows, setRows] = useState<IpRow[] | null>(null)
  const [manualIp, setManualIp] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    fetch('/api/admin/ips?filter=blocked&sort=recent', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setRows(j.ips))
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [load])

  const act = async (ip: string, action: 'block' | 'unblock') => {
    setBusy(true)
    try {
      const r = await fetch('/api/admin/ip-actions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ip, action }),
      })
      if (r.ok) {
        toast({ title: action === 'block' ? `${ip} is now blocked` : `${ip} has been unblocked`, description: 'The change is enforced immediately across the whole application.' })
        load()
      } else {
        const j = await r.json()
        toast({ title: 'Action failed', description: j.error, variant: 'destructive' })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <AdminTitle
        title="Access Control"
        subtitle="Locked and unblocked IP management. Blocking is enforced instantly — any request from a blocked IP receives HTTP 403."
      />

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <Input
          value={manualIp}
          onChange={(e) => setManualIp(e.target.value)}
          placeholder="Enter IP to block manually e.g. 203.0.113.50"
          className="bg-slate-900 border-slate-700 text-sm text-slate-200 placeholder:text-slate-600 max-w-xs font-mono"
        />
        <Button
          disabled={busy || !manualIp.trim()}
          onClick={() => act(manualIp.trim(), 'block')}
          className="bg-red-600 hover:bg-red-500 text-white text-sm"
        >
          <ShieldOff className="h-4 w-4 mr-1.5" /> Block IP
        </Button>
        <Button variant="ghost" size="icon" onClick={load} className="text-slate-400 ml-auto" aria-label="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2">
          <Lock className="h-4 w-4 text-red-400" />
          <span className="text-sm font-bold text-white">Locked IPs</span>
          {rows && <Badge className="bg-red-500/15 text-red-300 border border-red-500/40 text-[10px]">{rows.length}</Badge>}
          <span className="ml-auto text-[11px] text-slate-500">auto-refreshing every 5s</span>
        </div>

        {rows === null ? (
          <div className="p-4"><Skeleton className="h-40 bg-slate-800" /></div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            <LockOpen className="h-8 w-8 mx-auto text-slate-700 mb-2" />
            No IPs are currently blocked. The engine blocks automatically when risk ≥ threshold, or you can block manually above / from the IP Ledger.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/70">
            {rows.map((r) => (
              <div key={r.id} className="px-4 py-3 flex flex-wrap items-center gap-3 hover:bg-slate-800/30">
                <div className="min-w-44">
                  <div className="font-mono font-bold text-white text-sm">{r.ip}</div>
                  <div className="text-[11px] text-slate-500">{r.city ?? 'Unknown'}{r.country ? `, ${r.country}` : ''}</div>
                </div>
                <div className="text-xs text-slate-400">
                  <div>risk <span className={`font-bold ${r.riskScore >= 80 ? 'text-red-400' : 'text-zinc-300'}`}>{Math.round(r.riskScore)}</span></div>
                  <div>{r.totalRequests} reqs · {r.failedLogins} failed logins</div>
                </div>
                <div className="text-xs text-slate-500 max-w-72">
                  {r.blockReason ? <span className="text-red-300/90">{r.blockReason}</span> : '—'}
                  <div className="text-[10px]">{r.blockedBy ? `by ${r.blockedBy}` : ''} {r.blockedAt ? `· ${timeAgo(r.blockedAt)}` : ''}</div>
                </div>
                <Badge variant="outline" className={`text-[9px] ml-auto ${STATUS_COLORS[r.status]}`}>{r.status}</Badge>
                <Button
                  size="sm"
                  onClick={() => act(r.ip, 'unblock')}
                  disabled={busy}
                  className="bg-zinc-100 hover:bg-white text-zinc-900 text-xs"
                >
                  <LockOpen className="h-3.5 w-3.5 mr-1" /> Unblock
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-500 mt-3">
        Note: unblocking resets hot rate windows for that IP so it does not instantly re-trigger. Auto-block stays armed —
        if the IP misbehaves again it will be re-blocked the moment it crosses the threshold (see Settings).
      </p>
    </div>
  )
}
