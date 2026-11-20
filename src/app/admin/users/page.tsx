'use client'

import { useEffect, useState, useCallback } from 'react'
import { Users, ShieldCheck, User, Trash2, Loader2, ShoppingCart } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AdminTitle } from '@/components/admin/shell'
import { formatINR, timeAgo } from '@/lib/format'
import { toast } from '@/hooks/use-toast'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

interface UserRow {
  id: string
  name: string
  email: string
  role: string
  createdAt: string
  orderCount: number
  loginCount: number
  cartCount: number
  lastOrder: { total: number; createdAt: string } | null
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[] | null>(null)
  const [stats, setStats] = useState<{ total: number; admins: number; customers: number } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<UserRow | null>(null)

  const load = useCallback(() => {
    fetch('/api/admin/users', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j) { setUsers(j.users); setStats(j.stats) }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 8000)
    return () => clearInterval(t)
  }, [load])

  const changeRole = async (u: UserRow, role: string) => {
    setBusyId(u.id)
    try {
      const r = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: u.id, role }),
      })
      const j = await r.json().catch(() => ({}))
      if (r.ok) {
        toast({ title: `${u.email} is now ${role === 'ADMIN' ? 'an administrator' : 'a customer'}` })
        load()
      } else {
        toast({ title: 'Role change refused', description: j.error, variant: 'destructive' })
      }
    } finally {
      setBusyId(null)
    }
  }

  const remove = async () => {
    if (!deleting) return
    try {
      const r = await fetch(`/api/admin/users?id=${deleting.id}`, { method: 'DELETE' })
      const j = await r.json().catch(() => ({}))
      if (r.ok) {
        toast({ title: 'Account deleted', description: `${deleting.email} and all their orders/cart data are gone.` })
        load()
      } else {
        toast({ title: 'Delete refused', description: j.error, variant: 'destructive' })
      }
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div>
      <AdminTitle
        title="Customers & Admins"
        subtitle="Every registered account with real activity. Promote trusted staff to ADMIN or remove bad actors — deletion cascades to their orders, cart and login history."
      />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Accounts</span>
              <Users className="h-4 w-4 text-zinc-300" />
            </div>
            <div className="text-2xl font-extrabold text-white mt-1.5">{stats ? stats.total : '—'}</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Admins</span>
              <ShieldCheck className="h-4 w-4 text-zinc-300" />
            </div>
            <div className="text-2xl font-extrabold text-white mt-1.5">{stats ? stats.admins : '—'}</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Customers</span>
              <User className="h-4 w-4 text-zinc-300" />
            </div>
            <div className="text-2xl font-extrabold text-white mt-1.5">{stats ? stats.customers : '—'}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-0">
          {!users ? (
            <div className="p-4 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 bg-slate-800" />)}</div>
          ) : users.length === 0 ? (
            <p className="text-xs text-slate-500 py-10 text-center">No registered accounts yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-800">
                    <th className="px-3 py-2.5 font-medium">Account</th>
                    <th className="px-3 py-2.5 font-medium">Role</th>
                    <th className="px-3 py-2.5 font-medium">Orders</th>
                    <th className="px-3 py-2.5 font-medium">Logins</th>
                    <th className="px-3 py-2.5 font-medium">Last order</th>
                    <th className="px-3 py-2.5 font-medium">Joined</th>
                    <th className="px-3 py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {users.map((u) => (
                    <tr key={u.id} className="text-slate-300 hover:bg-slate-800/40">
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-slate-200">{u.name}</div>
                        <div className="text-[10px] text-slate-500">{u.email}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        {busyId === u.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                        ) : (
                          <Select value={u.role} onValueChange={(v) => changeRole(u, v)}>
                            <SelectTrigger className="w-28 h-7 bg-slate-800 border-slate-700 text-[11px] text-slate-200">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                              <SelectItem value="USER">USER</SelectItem>
                              <SelectItem value="ADMIN">ADMIN</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                      <td className="px-3 py-2.5"><span className="flex items-center gap-1"><ShoppingCart className="h-3 w-3 text-slate-500" />{u.orderCount}</span></td>
                      <td className="px-3 py-2.5">{u.loginCount}</td>
                      <td className="px-3 py-2.5">{u.lastOrder ? `${formatINR(u.lastOrder.total)} · ${timeAgo(u.lastOrder.createdAt)}` : <span className="text-slate-600">—</span>}</td>
                      <td className="px-3 py-2.5 text-slate-400">{timeAgo(u.createdAt)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-400"
                          onClick={() => setDeleting(u)} aria-label={`Delete ${u.email}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-700 text-slate-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete {deleting?.email}?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400 text-xs">
              This permanently removes the account with its {deleting?.orderCount ?? 0} order(s), cart items and login records.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 text-slate-300">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-red-600 hover:bg-red-500 text-white">Delete account</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
