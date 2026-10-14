import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'

export const metadata: Metadata = { title: 'Administrare comenzi', robots: { index: false, follow: false } }

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <section className="pt-[calc(var(--nav-h)+32px)] pb-[var(--sec)]">
      <div className="wrap">
        <nav aria-label="Administrare" className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] font-semibold tracking-[0.12em] text-muted uppercase">
          <span className="flex items-center gap-4">
            <span className="text-[11px] text-ink/40">Stats</span>
            <Link href="/admin/stats" className="hover:text-ink">
              A/B și vânzări
            </Link>
          </span>
          <span className="flex items-center gap-4">
            <span className="text-[11px] text-ink/40">Operațional</span>
            <Link href="/admin" className="hover:text-ink">
              Comenzi
            </Link>
            <Link href="/admin/leaduri" className="hover:text-ink">
              Leaduri
            </Link>
            <Link href="/admin/mesaje" className="hover:text-ink">
              Mesaje
            </Link>
          </span>
        </nav>
        {children}
      </div>
    </section>
  )
}
