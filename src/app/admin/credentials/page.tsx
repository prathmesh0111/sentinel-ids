'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, RefreshCw, KeySquare } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AdminTitle } from '@/components/admin/shell'
import { timeAgo } from '@/lib/format'

interface Attempt {
  id: string; ip: string; username: string; success: boolean
  userAgent: string | null; reason: string | null; createdAt: string
}

export default function CredentialLedgerPage() {
  const [rows, setRows] = useState<Attempt[] | null>(null)
  const [q, setQ] = useState('')
  const [outcome, setOutcome] = useState('all')
  const [totals, setTotals] = useState({ success: 0, failed: 0 })

  const load = useCallback(() => {
    const url = new URL('/api/admin/credentials', window.location.origin)
    if (q) url.searchParams.set('q', q)
    if (outcome !== 'all') url.searchParams.set('outcome', outcome)
    fetch(url.toString(), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j) {
          setRows(j.attempts)
          setTotals({ success: j.successCount, failed: j.failedCount })
        }
      })
      .catch(() => {})
  }, [q, outcome])

  useEffect(() => {
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [load])

  return (
    <div>
      <AdminTitle
        title="Credential Ledger"
        subtitle="Every real login attempt — successful or not — with IP, user agent and failure reason. Credential abuse starts here."
      />

      <div className="grid grid-cols-2 gap-3 mb-4 max-w-md">
        <div className="bg-slate-900 border border-zinc-700 rounded-lg p-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Successful logins</div>
          <div className="text-2xl font-extrabold text-zinc-300">{totals.success}</div>
        </div>
        <div className="bg-slate-900 border border-red-500/30 rounded-lg p-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Failed attempts</div>
          <div className="text-2xl font-extrabold text-red-400">{totals.failed}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-52 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search username or IP…" className="pl-8 bg-slate-900 border-slate-700 text-sm text-slate-200 placeholder:text-slate-600" />
        </div>
        <div className="flex gap-1">
          {['all', 'success', 'failed'].map((o) => (
            <button
              key={o}
              onClick={() => setOutcome(o)}
              className={`text-xs px-3 py-1.5 rounded-md border capitalize transition-colors ${outcome === o ? 'bg-zinc-800 text-zinc-200 border-zinc-600' : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-600'}`}
            >
              {o}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="icon" onClick={load} className="text-slate-400" aria-label="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {rows === null ? (
        <Skeleton className="h-96 rounded-lg bg-slate-900" />
      ) : rows.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-10 text-center text-sm text-slate-500">
          <KeySquare className="h-8 w-8 mx-auto text-slate-700 mb-2" />
          No credential attempts recorded yet — they appear the moment anyone tries to sign in.
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-800 bg-slate-900/60">
                  <th className="px-3 py-2.5 font-medium">When</th>
                  <th className="px-3 py-2.5 font-medium">Username</th>
                  <th className="px-3 py-2.5 font-medium">Source IP</th>
                  <th className="px-3 py-2.5 font-medium">Result</th>
                  <th className="px-3 py-2.5 font-medium">Reason</th>
                  <th className="px-3 py-2.5 font-medium">User agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {rows.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-800/30">
                    <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{timeAgo(a.createdAt)}</td>
                    <td className="px-3 py-2 font-mono text-slate-200">{a.username}</td>
                    <td className="px-3 py-2 font-mono text-zinc-200">{a.ip}</td>
                    <td className="px-3 py-2">
                      {a.success ? (
                        <Badge className="bg-zinc-800 text-zinc-200 border border-zinc-700 text-[9px]">SUCCESS</Badge>
                      ) : (
                        <Badge className="bg-red-500/15 text-red-300 border border-red-500/40 text-[9px]">FAILED</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{a.reason ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-500 max-w-52 truncate">{a.userAgent ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
