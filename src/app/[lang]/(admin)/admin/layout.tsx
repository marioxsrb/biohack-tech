import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { AdminNav } from './AdminNav'

export const metadata: Metadata = { title: { default: 'Admin', template: '%s · Admin Biohack Tech' }, robots: { index: false, follow: false } }

/**
 * The admin shell: a side menu on desktop (a scrolling bar on phones), the page on the right. Every page and
 * action behind it checks the session itself (proxy and Server Actions), see lib/admin-auth.ts.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-mist md:grid md:grid-cols-[232px_1fr]">
      <AdminNav />
      <div className="min-w-0 px-6 pt-6 pb-16 max-md:px-4 md:px-10 md:pt-8">{children}</div>
    </div>
  )
}
