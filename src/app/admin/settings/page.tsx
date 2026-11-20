'use client'

import { useEffect, useState, useCallback } from 'react'
import { Settings2, Save } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { AdminTitle } from '@/components/admin/shell'
import { toast } from '@/hooks/use-toast'

interface S {
  riskThreshold: number
  autoBlock: boolean
  ddosRpm: number
  bruteForceAttempts: number
  retrainMinSamples: number
  retrainIntervalMin: number
}

export default function SettingsPage() {
  const [s, setS] = useState<S | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    fetch('/api/admin/settings', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setS(j.settings))
      .catch(() => {})
  }, [])

  useEffect(load, [load])

  const save = async () => {
    if (!s) return
    setSaving(true)
    try {
      const r = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(s),
      })
      if (r.ok) toast({ title: 'Settings saved', description: 'The fraud engine picked them up immediately.' })
      else toast({ title: 'Save failed', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (!s) {
    return (
      <div>
        <AdminTitle title="Detection Settings" />
        <Skeleton className="h-96 rounded-lg bg-slate-900" />
      </div>
    )
  }

  return (
    <div>
      <AdminTitle
        title="Detection Settings"
        subtitle="Tune the fraud engine. Changes apply live — no restart needed."
      />
      <div className="grid lg:grid-cols-2 gap-4 max-w-4xl">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-white flex items-center gap-2"><Settings2 className="h-4 w-4 text-zinc-300" /> Blocking</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-slate-300 font-medium">Auto-block risk threshold</span>
                <span className={`font-bold ${s.riskThreshold >= 80 ? 'text-red-400' : 'text-zinc-300'}`}>{s.riskThreshold}%</span>
              </div>
              <Slider value={[s.riskThreshold]} min={30} max={99} step={1} onValueChange={([v]) => setS({ ...s, riskThreshold: v })} className="py-2" />
              <p className="text-[11px] text-slate-500 mt-1.5">IPs whose blended risk (rules + RF + IF) reaches this score are blocked instantly.</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-slate-300">Automatic blocking</div>
                <p className="text-[11px] text-slate-500">When off, high-risk IPs only enter the watchlist — you block manually from Access Control.</p>
              </div>
              <Switch checked={s.autoBlock} onCheckedChange={(v) => setS({ ...s, autoBlock: v })} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-white">Detection thresholds</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-slate-300 font-medium">Brute-force: failed logins / 10 min</span>
                <span className="font-bold text-amber-400">{s.bruteForceAttempts}</span>
              </div>
              <Slider value={[s.bruteForceAttempts]} min={3} max={30} step={1} onValueChange={([v]) => setS({ ...s, bruteForceAttempts: v })} className="py-2" />
            </div>
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-slate-300 font-medium">DDoS: requests / minute per IP</span>
                <span className="font-bold text-zinc-300">{s.ddosRpm}</span>
              </div>
              <Slider value={[s.ddosRpm]} min={30} max={600} step={10} onValueChange={([v]) => setS({ ...s, ddosRpm: v })} className="py-2" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-white">ML auto-training</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="flex justify-between text-xs mb-2">
                <span className="text-slate-300 font-medium">Retrain after N new samples</span>
                <span className="font-bold text-zinc-300">{s.retrainMinSamples}</span>
              </div>
              <Slider value={[s.retrainMinSamples]} min={10} max={300} step={5} onValueChange={([v]) => setS({ ...s, retrainMinSamples: v })} className="py-2" />
              <p className="text-[11px] text-slate-500 mt-1.5">
                The engine checks every minute; when enough new real samples accumulate it re-runs scikit-learn automatically.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-start">
          <Button onClick={save} disabled={saving} className="bg-zinc-100 hover:bg-white text-zinc-900">
            {saving ? 'Saving…' : <><Save className="h-4 w-4 mr-2" /> Save settings</>}
          </Button>
        </div>
      </div>
    </div>
  )
}
