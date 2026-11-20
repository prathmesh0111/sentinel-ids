'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, ShieldCheck, ShieldAlert, Clock, Globe, Monitor, Activity } from 'lucide-react'
import { StoreHeader, StoreFooter } from '@/components/store/header'
import { timeAgo } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface SecurityData {
  me: { name: string; email: string; role: string }
  myIp: {
    address: string; isValid: boolean; isPrivate: boolean
    country: string | null; city: string | null; isp: string | null
    riskScore: number; threatLabel: string; status: string
    firstSeen: string | null; totalRequests: number
  }
  logins: { id: string; ip: string; userAgent: string | null; success: boolean; country: string | null; city: string | null; createdAt: string }[]
  events: { id: string; type: string; severity: string; title: string; createdAt: string }[]
  credentialTries: number
}

function riskColor(score: number) {
  if (score >= 80) return 'text-red-600'
  if (score >= 55) return 'text-zinc-900'
  if (score >= 30) return 'text-amber-500'
  return 'text-zinc-900'
}

export default function MySecurityPage() {
  const router = useRouter()
  const [data, setData] = useState<SecurityData | null>(null)

  useEffect(() => {
    const load = () =>
      fetch('/api/me/security', { cache: 'no-store' })
        .then((r) => {
          if (r.status === 401) { router.replace('/login?next=/account/security'); return null }
          return r.ok ? r.json() : null
        })
        .then(setData)
        .catch(() => {})
    load()
    const t = setInterval(load, 10_000)
    return () => clearInterval(t)
  }, [router])

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <StoreHeader />
      <main className="max-w-4xl mx-auto w-full px-4 py-6 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Activity className="h-5 w-5 text-zinc-900" />
          <h1 className="text-xl font-bold text-slate-900">My IP &amp; Security</h1>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          What the fraud engine sees about <strong>your</strong> current session — live from the detection system.
        </p>

        {!data ? (
          <div className="space-y-4"><Skeleton className="h-32 rounded-lg" /><Skeleton className="h-48 rounded-lg" /></div>
        ) : (
          <div className="space-y-4">
            {/* current IP card */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="h-4 w-4 text-zinc-900" /> Your current connection
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">IP address</span><span className="font-mono font-semibold">{data.myIp.address}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Location</span><span>{data.myIp.city ?? '—'}{data.myIp.country ? `, ${data.myIp.country}` : ''}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">ISP</span><span className="text-right max-w-[55%] truncate">{data.myIp.isp ?? '—'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Network type</span><span>{data.myIp.isPrivate ? 'Private / local' : 'Public'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">IP validation</span><span>{data.myIp.isValid ? 'Valid format ✓' : 'INVALID'}</span></div>
                  </div>
                  <div className="flex flex-col items-center justify-center bg-slate-50 rounded-lg border border-slate-100 p-4">
                    <div className="text-xs uppercase tracking-wider text-slate-400 font-bold">Live risk score</div>
                    <div className={`text-5xl font-extrabold ${riskColor(data.myIp.riskScore)}`}>{Math.round(data.myIp.riskScore)}</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      {data.myIp.status === 'BLOCKED' ? (
                        <Badge className="bg-red-600 text-white"><ShieldAlert className="h-3 w-3 mr-1" /> BLOCKED</Badge>
                      ) : data.myIp.status === 'WATCHLIST' ? (
                        <Badge className="bg-amber-500 text-white"><ShieldAlert className="h-3 w-3 mr-1" /> WATCHLIST</Badge>
                      ) : (
                        <Badge className="bg-zinc-900 text-white"><ShieldCheck className="h-3 w-3 mr-1" /> {data.myIp.threatLabel}</Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-2">
                      {data.myIp.totalRequests} requests monitored · first seen {data.myIp.firstSeen ? timeAgo(data.myIp.firstSeen) : '—'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              {/* login history */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="h-4 w-4 text-zinc-900" /> Login history
                  </CardTitle>
                </CardHeader>
                <CardContent className="max-h-72 overflow-y-auto">
                  {data.logins.length === 0 ? (
                    <p className="text-sm text-slate-400">No logins recorded yet.</p>
                  ) : (
                    <ul className="space-y-2.5">
                      {data.logins.map((l) => (
                        <li key={l.id} className="text-sm border-b border-slate-50 pb-2 last:border-0">
                          <div className="flex items-center justify-between">
                            <span className={`font-semibold ${l.success ? 'text-zinc-900' : 'text-red-600'}`}>
                              {l.success ? 'Successful' : 'Failed'}
                            </span>
                            <span className="text-[11px] text-slate-400">{timeAgo(l.createdAt)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                            <Globe className="h-3 w-3" /> {l.ip} {l.country ? `· ${l.city ?? ''} ${l.country}` : ''}
                          </div>
                          {l.userAgent && (
                            <div className="flex items-start gap-1.5 text-[10px] text-slate-400 mt-0.5 truncate">
                              <Monitor className="h-3 w-3 shrink-0 mt-0.5" /> <span className="truncate">{l.userAgent}</span>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              {/* events about me */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldAlert className="h-4 w-4 text-zinc-900" /> Security events about your account
                  </CardTitle>
                </CardHeader>
                <CardContent className="max-h-72 overflow-y-auto">
                  {data.events.length === 0 ? (
                    <p className="text-sm text-slate-400">No security events — clean record.</p>
                  ) : (
                    <ul className="space-y-2">
                      {data.events.map((e) => (
                        <li key={e.id} className="text-sm border-b border-slate-50 pb-2 last:border-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-slate-700">{e.type.replaceAll('_', ' ')}</span>
                            <span className="text-[11px] text-slate-400 shrink-0">{timeAgo(e.createdAt)}</span>
                          </div>
                          <div className="text-[11px] text-slate-500">{e.title}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-4 text-sm text-slate-600">
              <span className="font-bold text-slate-900">{data.credentialTries}</span> login attempt(s) have been made with your
              email across all tracked IPs. Failed attempts feed the brute-force &amp; credential-abuse detectors.
            </div>
          </div>
        )}
      </main>
      <StoreFooter />
    </div>
  )
}
