import Link from 'next/link'
import { Arrow } from '@/components/ui/icons'
import { productHref, products } from '@/content/catalog'
import { site } from '@/config/site'
import { legalPages } from '@/content/legal'
import { formatMoney } from '@/lib/money'
import { Wordmark } from './Wordmark'

/** The last thing on every page leads back to the products; the fine print sits underneath. */
export function Footer() {
  return (
    <footer className="bg-dark text-dark-muted">
      <div className="wrap pt-[var(--sec)] pb-16">
        <p className="text-[clamp(32px,3.6vw,52px)] leading-none font-medium tracking-[-0.04em] text-white">Alege-ți produsul.</p>
        <ul className="mt-10 border-t border-dark-line max-sm:mt-8">
          {products.map((p) => (
            <li key={p.id} className="border-b border-dark-line">
              <Link href={productHref(p)} className="group grid grid-cols-[1fr_auto] items-center gap-x-6 py-6 sm:grid-cols-[1.2fr_1fr_auto] max-sm:py-5">
                <span className="text-[clamp(24px,2.6vw,36px)] leading-tight font-medium tracking-[-0.03em] text-white transition-colors group-hover:text-cyan">
                  {p.name}
                </span>
                <span className="text-[15.5px] max-sm:col-start-1 max-sm:row-start-2 max-sm:mt-1">
                  {p.purpose} · {formatMoney(p.price)}
                </span>
                <Arrow className="h-5 w-5 text-white transition-transform duration-200 group-hover:translate-x-1 max-sm:row-span-2" />
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="wrap flex flex-col gap-8 pb-10 text-[14.5px] md:flex-row md:items-end md:justify-between">
        <div>
          <Wordmark />
          <p className="mt-4">
            <a href={`mailto:${site.email}`} className="hover:text-white">
              {site.email}
            </a>
            <span className="mx-2">·</span>
            <a href={site.phoneHref} className="hover:text-white">
              {site.phone}
            </a>
          </p>
        </div>
        <nav aria-label="Informații" className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/about-us" className="hover:text-white">Despre noi</Link>
          <Link href="/contact-us" className="hover:text-white">Contact</Link>
          {legalPages.map((p) => (
            <Link key={p.slug} href={`/${p.slug}`} className="hover:text-white">
              {p.shortTitle}
            </Link>
          ))}
          <a href="https://anpc.ro/ce-este-sal/" target="_blank" rel="noopener noreferrer" className="hover:text-white">
            ANPC
          </a>
        </nav>
      </div>
      <div className="wrap border-t border-dark-line py-6 text-[13px]">© {new Date().getFullYear()} {site.name}</div>
    </footer>
  )
}
