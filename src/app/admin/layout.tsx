import type { ReactNode } from 'react'
import { AdminShell } from '@/components/admin/shell'

export const metadata = {
  title: 'SecureSentinel — Fraud & IP Anomaly Console',
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}
