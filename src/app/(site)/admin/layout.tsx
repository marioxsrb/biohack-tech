import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'

export const metadata: Metadata = { title: 'Administrare comenzi', robots: { index: false, follow: false } }

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <section className="pt-[calc(var(--nav-h)+32px)] pb-[var(--sec)]">
      <div className="wrap">
        <p className="text-[13px] font-semibold tracking-[0.12em] text-muted uppercase">
          <Link href="/admin" className="hover:text-ink">
            Administrare
          </Link>
        </p>
        {children}
      </div>
    </section>
  )
}
