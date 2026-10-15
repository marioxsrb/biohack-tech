'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const GROUPS: { title: string; items: { href: string; label: string }[] }[] = [
  { title: 'Privire de ansamblu', items: [{ href: '/admin', label: 'Dashboard' }, { href: '/admin/raport', label: 'Raport zilnic (AI)' }] },
  {
    title: 'Operațional',
    items: [
      { href: '/admin/comenzi', label: 'Comenzi' },
      { href: '/admin/leaduri', label: 'Leaduri și apeluri AI' },
      { href: '/admin/mesaje', label: 'Mesaje' },
    ],
  },
  {
    title: 'Marketing',
    items: [
      { href: '/admin/stats', label: 'Funnel A/B și vânzări' },
      { href: '/admin/coduri', label: 'Coduri promoționale' },
    ],
  },
]

/** The side menu; the current page is marked (an order's page belongs to "Comenzi"). */
export function AdminNav() {
  const path = usePathname().replace(/^\/en(?=\/)/, '')
  const active = (href: string) => (href === '/admin' ? path === '/admin' : path.startsWith(href) || (href === '/admin/comenzi' && path.startsWith('/admin/orders')))
  return (
    <aside className="bg-ink text-white md:sticky md:top-0 md:h-dvh md:overflow-y-auto">
      <div className="flex items-center justify-between px-5 py-5 max-md:py-3.5">
        <Link href="/admin" className="text-[15px] font-extrabold tracking-[0.04em]">
          BIOHACK <span className="text-cyan-300">TECH</span>
          <span className="ml-2 rounded-[6px] bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold tracking-normal text-white/70">Admin</span>
        </Link>
        <form action="/api/admin/logout" method="post" className="md:hidden">
          <button className="rounded-[8px] px-2.5 py-1.5 text-[13px] text-white/70 hover:bg-white/10 hover:text-white">Ieșire</button>
        </form>
      </div>
      <nav aria-label="Administrare" className="px-3 pb-6 max-md:flex max-md:gap-1 max-md:overflow-x-auto max-md:pb-3">
        {GROUPS.map((g) => (
          <div key={g.title} className="mb-5 max-md:mb-0 max-md:flex max-md:gap-1">
            <p className="px-2 pb-1.5 text-[11px] font-semibold tracking-[0.12em] text-white/40 uppercase max-md:hidden">{g.title}</p>
            {g.items.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                aria-current={active(i.href) ? 'page' : undefined}
                className={`block rounded-[10px] px-3 py-2 text-[14.5px] whitespace-nowrap transition-colors ${active(i.href) ? 'bg-white text-ink font-semibold' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
              >
                {i.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="mt-auto border-t border-white/10 px-5 py-4 max-md:hidden">
        <a href="/" target="_blank" className="block text-[13px] text-white/60 hover:text-white">
          Deschide magazinul ↗
        </a>
        <form action="/api/admin/logout" method="post" className="mt-2">
          <button className="text-[13px] text-white/60 underline underline-offset-4 hover:text-white">Deconectare</button>
        </form>
      </div>
    </aside>
  )
}
