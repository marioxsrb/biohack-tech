import Link from 'next/link'
import { productHref, products } from '@/content/catalog'
import { site, terms } from '@/config/site'
import { legalPages } from '@/content/legal'
import { Wordmark } from './Wordmark'

export function Footer() {
  return (
    <footer className="on-dark bg-dark text-dark-muted">
      <div className="wrap grid gap-10 py-16 md:grid-cols-12 md:gap-6">
        <div className="md:col-span-4">
          <Wordmark />
          <p className="mt-5 max-w-[22em] text-[15px] leading-relaxed">{site.tagline}</p>
          <div className="mt-6 space-y-1 text-[15px]">
            <a href={`mailto:${site.email}`} className="block text-white hover:text-cyan">
              {site.email}
            </a>
            <a href={site.phoneHref} className="block text-white hover:text-cyan">
              {site.phone}
            </a>
          </div>
        </div>

        <FooterCol title="Produse" className="md:col-span-2 md:col-start-6">
          {products.map((p) => (
            <li key={p.id}>
              <Link href={productHref(p)}>{p.name}</Link>
            </li>
          ))}
        </FooterCol>

        <FooterCol title="Companie" className="md:col-span-2">
          <li><Link href="/products">Toate produsele</Link></li>
          <li><Link href="/about-us">Despre noi</Link></li>
          <li><Link href="/contact-us">Contact</Link></li>
        </FooterCol>

        <FooterCol title="Informații" className="md:col-span-3">
          {legalPages.map((p) => (
            <li key={p.slug}>
              <Link href={`/${p.slug}`}>{p.shortTitle}</Link>
            </li>
          ))}
          <li>
            <a href="https://anpc.ro/ce-este-sal/" target="_blank" rel="noopener noreferrer">
              ANPC, soluționarea litigiilor
            </a>
          </li>
        </FooterCol>
      </div>

      <div className="border-t border-dark-line">
        <div className="wrap flex flex-col gap-2 py-6 text-[13.5px] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {site.name}. Toate drepturile rezervate.</p>
          <p>
            {terms.shipping} · Retur în {terms.returnDays} zile · Garanție {terms.warrantyYears} ani
          </p>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, className, children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <nav aria-label={title} className={className}>
      <p className="mono">{title}</p>
      <ul className="mt-4 space-y-2.5 text-[15px] [&_a]:transition-colors [&_a:hover]:text-white">{children}</ul>
    </nav>
  )
}
