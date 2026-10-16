import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE, checkAdminSession } from '@/lib/admin-auth'
import { getDb } from '@/server/db'
import { AdminNav } from './AdminNav'

/** How many messages wait for the team (shown beside Mesaje and Suport), only behind a valid session. */
async function waiting(): Promise<Record<string, number>> {
  try {
    if ((await checkAdminSession((await cookies()).get(ADMIN_COOKIE)?.value)) !== 'ok') return {}
    const db = await getDb()
    const { rows } = await db.query<{ e: number; s: number }>(
      `select (select count(*)::int from enquiries where status = 'new') as e, (select count(*)::int from support_requests where status = 'open') as s`,
    )
    return { '/admin/mesaje': rows[0]?.e ?? 0, '/admin/suport': rows[0]?.s ?? 0 }
  } catch {
    return {}
  }
}

export const metadata: Metadata = { title: { default: 'Admin', template: '%s · Admin Biohack Tech' }, robots: { index: false, follow: false } }

/**
 * The admin shell: a side menu on desktop (a scrolling bar on phones), the page on the right. Every page and
 * action behind it checks the session itself (proxy and Server Actions), see lib/admin-auth.ts.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const badges = await waiting()
  return (
    <div className="min-h-dvh bg-mist md:grid md:grid-cols-[232px_1fr]">
      <AdminNav badges={badges} />
      <div className="min-w-0 px-6 pt-6 pb-16 max-md:px-4 md:px-10 md:pt-8">{children}</div>
    </div>
  )
}
