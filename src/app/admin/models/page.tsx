'use client'

import { useEffect, useState, useCallback } from 'react'
import { Brain, Database, RefreshCw, Loader2, Sparkles, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AdminTitle } from '@/components/admin/shell'
import { CHART_TOOLTIP } from '@/components/chart-theme'
import { timeAgo } from '@/lib/format'
import { toast } from '@/hooks/use-toast'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from 'recharts'

interface ModelInfo {
  id: string
  kind: string
  version: number
  trainedAt: string
  samples: number
  attackSamples: number
  normalSamples: number
  metrics: Record<string, number | Record<string, number>>
  active: boolean
  trainingMs: number
}

interface Data {
  artifacts: ModelInfo[]
  samples: { attack: number; normal: number; unlabeled: number; total: number; unconsumed: number }
  live: {
    rf: { version: number; metrics: Record<string, number | Record<string, number>> } | null
    if: { version: number; metrics: Record<string, number | Record<string, number>> } | null
  }
}

export default function ModelsPage() {
  const [data, setData] = useState<Data | null>(null)
  const [training, setTraining] = useState(false)

  const load = useCallback(() => {
    fetch('/api/admin/models', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 6000)
    return () => clearInterval(t)
  }, [load])

  const retrain = async () => {
    setTraining(true)
    try {
      const r = await fetch('/api/admin/models/retrain', { method: 'POST' })
      const j = await r.json()
      if (r.ok) {
        toast({
          title: 'Models retrained',
          description: `v${j.version} — RF: ${j.rfTrained ? 'trained' : 'skipped'}, IF: ${j.ifTrained ? 'trained' : 'skipped'} on ${j.samples} real samples in ${(j.trainingMs / 1000).toFixed(1)}s`,
        })
      } else {
        toast({ title: 'Retrain skipped', description: j.error, variant: 'destructive' })
      }
      load()
    } finally {
      setTraining(false)
    }
  }

  const rf = data?.live.rf
  const ifm = data?.live.if
  const importances = (rf?.metrics?.featureImportances ?? {}) as Record<string, number>
  const impData = Object.entries(importances).map(([name, v]) => ({ name: name.replaceAll('_', ' '), value: Number(v) * 100 })).sort((a, b) => b.value - a.value).slice(0, 11)

  return (
    <div>
      <AdminTitle
        title="ML Models — Random Forest + Isolation Forest"
        subtitle="Both models train exclusively on real traffic collected by the engine (weak supervision). Auto-retraining runs when enough new samples accumulate."
      />

      <div className="grid md:grid-cols-3 gap-3 mb-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-400 font-bold"><Database className="h-3.5 w-3.5" /> Training corpus</div>
            <div className="text-3xl font-extrabold text-white mt-2">{data?.samples.total ?? '—'}</div>
            <div className="text-[11px] text-slate-500 mt-1">
              {data ? `${data.samples.attack} attack · ${data.samples.normal} normal · ${data.samples.unlabeled} unlabeled` : '…'}
            </div>
            {data && <div className="text-[10px] text-amber-400/80 mt-1">{data.samples.unconsumed} new samples since last training</div>}
          </CardContent>
        </Card>

        <Card className={`border ${rf ? 'bg-zinc-900 border-zinc-600' : 'bg-slate-900 border-slate-800'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-400 font-bold"><Brain className="h-3.5 w-3.5" /> Random Forest</div>
              {rf ? <Badge className="bg-zinc-800 text-zinc-200 border border-zinc-700 text-[9px]">ACTIVE v{rf.version}</Badge> : <Badge variant="outline" className="border-slate-700 text-slate-500 text-[9px]">COLD START</Badge>}
            </div>
            <div className="text-2xl font-extrabold text-white mt-2">
              {rf ? `${Math.round((Number(rf.metrics.testAccuracy ?? rf.metrics.trainAccuracy) || 0) * 100)}%` : '—'}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {rf ? `test accuracy · precision ${rf.metrics.precision ?? '—'} · recall ${rf.metrics.recall ?? '—'}` : 'Trains once ≥20 labeled samples exist'}
            </div>
          </CardContent>
        </Card>

        <Card className={`border ${ifm ? 'bg-zinc-900 border-zinc-600' : 'bg-slate-900 border-slate-800'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-400 font-bold"><Sparkles className="h-3.5 w-3.5" /> Isolation Forest</div>
              {ifm ? <Badge className="bg-zinc-800 text-zinc-200 border border-zinc-700 text-[9px]">ACTIVE v{ifm.version}</Badge> : <Badge variant="outline" className="border-slate-700 text-slate-500 text-[9px]">COLD START</Badge>}
            </div>
            <div className="text-2xl font-extrabold text-white mt-2">
              {ifm ? `${ifm.metrics.trainedOn ?? '—'} pts` : '—'}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {ifm ? `contamination ${ifm.metrics.contamination} · mean anomaly ${ifm.metrics.meanAnomaly}` : 'Unsupervised — trains on ≥10 samples'}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <Button onClick={retrain} disabled={training} className="bg-zinc-100 hover:bg-white text-zinc-900">
          {training ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Training…</> : <><RefreshCw className="h-4 w-4 mr-2" /> Retrain now</>}
        </Button>
        <span className="text-[11px] text-slate-500">
          Trains with scikit-learn (python3) on the live PostgreSQL corpus — takes a few seconds.
        </span>
      </div>

      {rf && impData.length > 0 && (
        <Card className="bg-slate-900 border-slate-800 mb-4">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm text-slate-300 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-zinc-300" /> Random Forest feature importances (%)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={impData} layout="vertical" margin={{ top: 4, right: 20, left: 110, bottom: 0 }}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} unit="%" />
                <YAxis type="category" dataKey="name" width={105} tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip {...CHART_TOOLTIP} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {impData.map((_, i) => <Cell key={i} fill={i === 0 ? '#a1a1aa' : i < 3 ? '#8e8e96' : '#77777f'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader className="pb-1"><CardTitle className="text-sm text-slate-300">Training history</CardTitle></CardHeader>
        <CardContent>
          {!data ? (
            <Skeleton className="h-32 bg-slate-800" />
          ) : data.artifacts.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              No training runs yet. The engine records training samples automatically as real traffic flows — once enough
              accumulate (default 30 new), models train on their own. You can also press “Retrain now”.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-800">
                    <th className="px-2 py-2 font-medium">Model</th>
                    <th className="px-2 py-2 font-medium">Version</th>
                    <th className="px-2 py-2 font-medium">Trained</th>
                    <th className="px-2 py-2 font-medium">Samples</th>
                    <th className="px-2 py-2 font-medium">Attack / Normal</th>
                    <th className="px-2 py-2 font-medium">Key metric</th>
                    <th className="px-2 py-2 font-medium">Took</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {data.artifacts.map((a) => (
                    <tr key={a.id} className="text-slate-300">
                      <td className="px-2 py-2 font-semibold">{a.kind === 'RANDOM_FOREST' ? 'Random Forest' : 'Isolation Forest'}</td>
                      <td className="px-2 py-2">v{a.version}</td>
                      <td className="px-2 py-2 text-slate-400">{timeAgo(a.trainedAt)}</td>
                      <td className="px-2 py-2">{a.samples}</td>
                      <td className="px-2 py-2">{a.attackSamples} / {a.normalSamples}</td>
                      <td className="px-2 py-2 font-mono text-zinc-200">
                        {a.kind === 'RANDOM_FOREST'
                          ? `acc ${a.metrics.testAccuracy ?? a.metrics.trainAccuracy ?? '—'}`
                          : `mean ${a.metrics.meanAnomaly != null ? Number(a.metrics.meanAnomaly).toFixed(3) : '—'}`}
                      </td>
                      <td className="px-2 py-2 text-slate-400">{(a.trainingMs / 1000).toFixed(1)}s</td>
                      <td className="px-2 py-2">
                        {a.active ? (
                          <Badge className="bg-zinc-800 text-zinc-200 border border-zinc-700 text-[9px]">ACTIVE</Badge>
                        ) : (
                          <Badge variant="outline" className="border-slate-700 text-slate-500 text-[9px]">superseded</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
