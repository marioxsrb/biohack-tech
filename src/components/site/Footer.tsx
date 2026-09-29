import Link from 'next/link'
import { CookieSettingsButton } from '@/components/consent/ConsentManager'
import { Arrow, Mail, Phone } from '@/components/ui/icons'
import { productHref, products } from '@/content/catalog'
import { legalPages } from '@/content/legal'
import { companyLine } from '@/config/company'
import { site, terms } from '@/config/site'
import { Wordmark } from './Wordmark'

const page = (slug: string) => legalPages.find((p) => p.slug === slug)!

const help = [
  { href: `/${page('politica-livrare').slug}`, label: 'Livrare' },
  { href: `/${page('plati').slug}`, label: 'Plăți' },
  { href: `/${page('politica-retur').slug}`, label: 'Retur și retragere' },
  { href: `/${page('garantie').slug}`, label: 'Garanție și reclamații' },
  // OUG 34/2014 art. 11^1: the online withdrawal function, reachable from every page.
  { href: '/retragere', label: 'Retrage-te din contract aici' },
  { href: '/contact-us', label: 'Contact' },
  { href: '/about-us', label: 'Despre noi' },
]

const legal = [
  { href: `/${page('terms-of-service').slug}`, label: 'Termeni și condiții' },
  { href: `/${page('privacy-policy').slug}`, label: 'Confidențialitate' },
  { href: `/${page('politica-cookies').slug}`, label: 'Politica de cookies' },
]

/**
 * The ending: the opening line returns on the dark surface, then everything practical in
 * four short columns (products, help, legal, contact). On phones the columns pair up.
 */
export function Footer() {
  return (
    <footer className="on-dark bg-dark text-dark-muted">
      <div className="wrap pt-[calc(var(--sec)*0.8)] pb-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <p className="text-[clamp(40px,5.6vw,80px)] leading-[0.96] font-medium tracking-[-0.045em] text-white">
            Minte limpede.
            <br />
            Corp relaxat.
          </p>
          <Link href="/products" className="cta self-start md:self-auto">
            Vezi produsele <Arrow />
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-2 gap-x-6 gap-y-10 border-t border-dark-line pt-10 text-[15px] md:grid-cols-12 max-sm:mt-12">
          <nav aria-labelledby="ft-products" className="col-span-2 md:col-span-4">
            <h2 id="ft-products" className="text-[13px] font-semibold tracking-[0.12em] text-white uppercase">
              Produse
            </h2>
            <ul className="mt-4 space-y-1">
              {products.map((p) => (
                <li key={p.id}>
                  <Link href={productHref(p)} className="group flex min-h-11 items-baseline gap-3 py-1">
                    <span className="text-[17px] font-medium text-white group-hover:text-cyan">{p.name}</span>
                    <span className="text-[14px]">{p.purpose}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="ft-help" className="md:col-span-2">
            <h2 id="ft-help" className="text-[13px] font-semibold tracking-[0.12em] text-white uppercase">
              Ajutor
            </h2>
            <ul className="mt-4">
              {help.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="flex min-h-10 items-center hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="ft-legal" className="md:col-span-2">
            <h2 id="ft-legal" className="text-[13px] font-semibold tracking-[0.12em] text-white uppercase">
              Legal
            </h2>
            <ul className="mt-4">
              {legal.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="flex min-h-10 items-center hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <CookieSettingsButton className="flex min-h-10 items-center text-left hover:text-white" />
              </li>
              <li>
                <a href="https://anpc.ro" target="_blank" rel="noopener noreferrer" className="flex min-h-10 items-center hover:text-white">
                  ANPC
                  <span className="sr-only"> (se deschide într-o filă nouă)</span>
                </a>
              </li>
              <li>
                <a href="https://reclamatiisal.anpc.ro" target="_blank" rel="noopener noreferrer" className="flex min-h-10 items-center hover:text-white">
                  ANPC SAL, soluționarea alternativă a litigiilor
                  <span className="sr-only"> (se deschide într-o filă nouă)</span>
                </a>
              </li>
            </ul>
          </nav>

          <div className="col-span-2 md:col-span-4 md:pl-6">
            <h2 className="text-[13px] font-semibold tracking-[0.12em] text-white uppercase">Contact</h2>
            <ul className="mt-4">
              <li>
                <a href={`mailto:${site.email}`} className="flex min-h-11 items-center gap-3 text-[16px] text-white hover:text-cyan">
                  <Mail className="h-[18px] w-[18px] text-dark-muted" /> {site.email}
                </a>
              </li>
              <li>
                <a href={site.phoneHref} className="flex min-h-11 items-center gap-3 text-[16px] text-white hover:text-cyan">
                  <Phone className="h-[18px] w-[18px] text-dark-muted" /> {site.phone}
                </a>
              </li>
            </ul>
            <p className="mt-3">Îți răspundem {terms.responseTime}.</p>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-dark-line pt-6 text-[13.5px] md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Wordmark tone="dark" className="text-white" />
            <span>© {new Date().getFullYear()}</span>
          </div>
          <div className="max-w-[46em] space-y-1 md:text-right">
            {companyLine() && <p>{companyLine()}</p>}
            <p>Produse de wellness pentru uz zilnic. Nu înlocuiesc sfatul medicului.</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
