'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Activity, Fingerprint, Lock, ShieldAlert, Bug, Database, Gauge, Radio, Brain,
  ShoppingBag, IndianRupee, Package, Users,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AdminTitle } from '@/components/admin/shell'
import { CHART_TOOLTIP } from '@/components/chart-theme'
import { useSecurityStream } from '@/hooks/use-security-stream'
import { timeAgo, SEVERITY_COLORS, formatINR } from '@/lib/format'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from 'recharts'

const SEVERITY_PIE = [
  { fill: '#a1a1aa' }, // LOW emerald
  { fill: '#f59e0b' }, // MEDIUM amber
  { fill: '#f97316' }, // HIGH orange
  { fill: '#ef4444' }, // CRITICAL red
]
const VECTOR_COLORS = ['#52525b', '#ef4444', '#8e8e96', '#a1a1aa', '#d4d4d8', '#6b6b74', '#3f3f46', '#71717a']

interface Overview {
  cards: {
    trackedIps: number; blockedIps: number; watchlistIps: number; invalidIps: number
    events24h: number; attacks24h: number; trainingSamples: number; requestsLastMinute: number; liveTracked: number
  }
  store: {
    orders24h: number; totalOrders: number; revenue: number; lowStock: number; customers: number; products: number
  }
  models: { kind: string; version: number; trainedAt: string }[]
  topRisk: { ip: string; riskScore: number; threatLabel: string; status: string; country: string | null; failedLogins: number; totalRequests: number }[]
  severityCounts: { severity: string; count: number }[]
  typeCounts: { type: string; count: number }[]
  timeline: { minute: string; requests: number; blocked: number; failedLogins: number }[]
  geoDist: { country: string; count: number }[]
}

const TYPE_LABELS: Record<string, string> = {
  BRUTE_FORCE: 'Brute force',
  DDOS_SUSPECTED: 'DDoS',
  CREDENTIAL_STUFFING: 'Credential stuffing',
  GEO_JUMP: 'Location spoofing',
  INVALID_IP: 'Invalid IP',
  AUTO_BLOCK: 'Auto-block',
  RATE_BURST: 'Rate burst',
  LOGIN_FAILED: 'Failed logins',
}

export default function LiveMonitorPage() {
  const [ov, setOv] = useState<Overview | null>(null)
  const { connected, events } = useSecurityStream(60)

  const load = useCallback(() => {
    fetch('/api/admin/overview', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setOv)
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 4000)
    return () => clearInterval(t)
  }, [load])

  const cards = ov?.cards
  const statCards = [
    { label: 'Tracked IPs', value: cards?.trackedIps, icon: Fingerprint, color: 'text-zinc-300', sub: `${cards?.liveTracked ?? 0} live in session` },
    { label: 'Blocked IPs', value: cards?.blockedIps, icon: Lock, color: 'text-red-400', sub: 'auto + manual' },
    { label: 'Watchlist', value: cards?.watchlistIps, icon: ShieldAlert, color: 'text-amber-400', sub: 'elevated risk' },
    { label: 'Requests / min', value: cards?.requestsLastMinute, icon: Gauge, color: 'text-zinc-300', sub: 'across all IPs' },
    { label: 'Events 24h', value: cards?.events24h, icon: Activity, color: 'text-zinc-300', sub: `${cards?.attacks24h ?? 0} attack signals` },
    { label: 'Invalid IPs', value: cards?.invalidIps, icon: Bug, color: 'text-zinc-300', sub: 'malformed sources' },
    { label: 'ML samples', value: cards?.trainingSamples, icon: Database, color: 'text-zinc-300', sub: 'real traffic features' },
  ]

  const timeline = (ov?.timeline ?? []).map((t) => ({
    ...t,
    time: new Date(t.minute).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  }))

  return (
    <div>
      <AdminTitle
        title="Live Monitor"
        subtitle="Realtime oversight of every IP touching SecureMart — charts refresh every 4s, event feed is a live websocket stream."
      />

      {/* stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        {statCards.map((c) => (
          <Card key={c.label} className="bg-slate-900 border-slate-800">
            <CardContent className="p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{c.label}</span>
                <c.icon className={`h-4 w-4 ${c.color}`} />
              </div>
              <div className="text-2xl font-extrabold text-white mt-1.5">
                {c.value === undefined ? <Skeleton className="h-7 w-12 bg-slate-800" /> : c.value.toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">{c.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* store strip */}
      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">
        {[
          { label: 'Store revenue', value: ov ? formatINR(ov.store.revenue) : undefined, icon: IndianRupee, color: 'text-zinc-300', sub: `${ov?.store.totalOrders ?? 0} orders all-time` },
          { label: 'Orders 24h', value: ov?.store.orders24h, icon: ShoppingBag, color: 'text-zinc-300', sub: 'placed in the last day' },
          { label: 'Customers', value: ov?.store.customers, icon: Users, color: 'text-zinc-300', sub: 'registered accounts' },
          { label: 'Catalog', value: ov?.store.products, icon: Package, color: 'text-zinc-300', sub: 'products in the store' },
          { label: 'Low stock', value: ov?.store.lowStock, icon: Package, color: (ov?.store.lowStock ?? 0) > 0 ? 'text-amber-400' : 'text-slate-500', sub: 'items under 10 units' },
        ].map((c) => (
          <Card key={c.label} className="bg-slate-900/60 border-slate-800">
            <CardContent className="p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{c.label}</span>
                <c.icon className={`h-4 w-4 ${c.color}`} />
              </div>
              <div className="text-xl font-extrabold text-white mt-1.5">
                {c.value === undefined ? <Skeleton className="h-6 w-14 bg-slate-800" /> : typeof c.value === 'number' ? c.value.toLocaleString('en-IN') : c.value}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">{c.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* model status strip */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500 flex items-center gap-1.5"><Brain className="h-3.5 w-3.5" /> Active models:</span>
        {ov?.models?.length ? (
          ov.models.map((m) => (
            <Badge key={m.kind} variant="outline" className="border-zinc-600 text-zinc-200 text-[10px]">
              {m.kind === 'RANDOM_FOREST' ? 'Random Forest' : 'Isolation Forest'} v{m.version} · {timeAgo(m.trainedAt)}
            </Badge>
          ))
        ) : (
          <Badge variant="outline" className="border-slate-700 text-slate-500 text-[10px]">Rule engine only — training samples accumulating…</Badge>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        {/* traffic timeline */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-1"><CardTitle className="text-sm text-slate-300 flex items-center gap-2"><Radio className="h-4 w-4 text-zinc-300" /> Traffic — requests per minute (30 min)</CardTitle></CardHeader>
          <CardContent className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="gReq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a1a1aa" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#a1a1aa" stopOpacity={0.03} />
                  </linearGradient>
                  <linearGradient id="gBlk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#334155' }} minTickGap={24} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip {...CHART_TOOLTIP} />
                <Area type="monotone" dataKey="requests" name="Requests" stroke="#a1a1aa" fill="url(#gReq)" strokeWidth={2} />
                <Area type="monotone" dataKey="failedLogins" name="Failed logins" stroke="#f59e0b" fill="transparent" strokeWidth={1.5} />
                <Area type="monotone" dataKey="blocked" name="Blocked" stroke="#ef4444" fill="url(#gBlk)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* live feed */}
        <Card className="bg-slate-900 border-slate-800 flex flex-col">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-2"><Activity className="h-4 w-4 text-zinc-300" /> Live event stream</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${connected ? 'border-zinc-600 text-zinc-300' : 'border-slate-700 text-slate-500'}`}>
                {connected ? 'WEBSOCKET LIVE' : 'POLLING MODE'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="h-60 overflow-y-auto space-y-1.5" aria-live="polite">
            {events.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">Listening for security events… sign in from another device or IP to see live detections.</p>
            ) : (
              events.map((e, i) => (
                <div key={`${e.id}-${i}`} className={`text-xs rounded-md border px-2.5 py-1.5 ${SEVERITY_COLORS[e.severity]} flex items-start justify-between gap-2`}>
                  <div className="min-w-0">
                    <span className="font-mono text-[10px] opacity-80">{e.ip}</span>
                    <span className="ml-2 font-semibold">{e.type.replaceAll('_', ' ')}</span>
                    <div className="truncate opacity-90">{e.title}</div>
                  </div>
                  <span className="text-[10px] shrink-0 opacity-70">{timeAgo(e.createdAt)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* attack vectors */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-1"><CardTitle className="text-sm text-slate-300">Attack vectors — 24h</CardTitle></CardHeader>
          <CardContent className="h-60">
            {ov?.typeCounts?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={ov.typeCounts} dataKey="count" nameKey="type" innerRadius={45} outerRadius={80} paddingAngle={3} stroke="none">
                    {ov.typeCounts.map((_, i) => <Cell key={i} fill={VECTOR_COLORS[i % VECTOR_COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...CHART_TOOLTIP} formatter={(v, n) => [v, TYPE_LABELS[String(n)] ?? String(n)]} />
                  <Legend formatter={(v) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{TYPE_LABELS[String(v)] ?? String(v)}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">No attack signals yet — detections appear here as real attacks are observed.</div>
            )}
          </CardContent>
        </Card>

        {/* top risk IPs */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-1"><CardTitle className="text-sm text-slate-300">Top risk IPs — live risk score</CardTitle></CardHeader>
          <CardContent className="h-60">
            {ov?.topRisk?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ov.topRisk.slice(0, 6)} layout="vertical" margin={{ top: 4, right: 12, left: 30, bottom: 0 }}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="ip" width={95} tick={{ fill: '#94a3b8', fontSize: 9, fontFamily: 'monospace' }} tickLine={false} axisLine={false} />
                  <Tooltip {...CHART_TOOLTIP} />
                  <Bar dataKey="riskScore" name="Risk score" radius={[0, 4, 4, 0]}>
                    {ov.topRisk.slice(0, 6).map((r, i) => (
                      <Cell key={i} fill={r.riskScore >= 80 ? '#ef4444' : r.riskScore >= 55 ? '#f97316' : r.riskScore >= 30 ? '#f59e0b' : '#a1a1aa'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">No IPs tracked yet.</div>
            )}
          </CardContent>
        </Card>

        {/* geo distribution */}
        <Card className="bg-slate-900 border-slate-800 lg:col-span-2">
          <CardHeader className="pb-1"><CardTitle className="text-sm text-slate-300">Geographic distribution of tracked IPs</CardTitle></CardHeader>
          <CardContent className="h-48">
            {ov?.geoDist?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ov.geoDist.slice(0, 12)} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="country" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#334155' }} interval={0} angle={-12} textAnchor="end" height={40} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip {...CHART_TOOLTIP} />
                  <Bar dataKey="count" name="IPs" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">Geo data appears once public IPs are resolved.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
