import Link from '@/components/ui/Link'
import { CookieSettingsButton } from '@/components/consent/ConsentManager'
import { Arrow, Mail, Phone } from '@/components/ui/icons'
import { productHref, productsIn } from '@/content/catalog'
import { legalPages } from '@/content/legal'
import { companyLine } from '@/config/company'
import { site } from '@/config/site'
import { getLocale, getUi } from '@/i18n/server'
import type { Locale } from '@/i18n/locales'
import { MainHostOnly } from './MainHostOnly'
import { Wordmark } from './Wordmark'

const page = (slug: string) => legalPages.find((p) => p.slug === slug)!

/** `mainOnly`: pages that exist only on the main host (hidden on the landing hosts, see MainHostOnly). */
type FooterLink = { href: string; label: Record<Locale, string>; mainOnly?: true; /** The English address when it differs. */ en?: string }

const help: FooterLink[] = [
  { href: `/${page('politica-livrare').slug}`, label: { ro: 'Livrare', en: 'Delivery' } },
  { href: `/${page('plati').slug}`, label: { ro: 'Plăți', en: 'Payments' } },
  { href: `/${page('politica-retur').slug}`, label: { ro: 'Retur și retragere', en: 'Returns and withdrawal' } },
  { href: `/${page('garantie').slug}`, label: { ro: 'Garanție și reclamații', en: 'Warranty and complaints' } },
  // OUG 34/2014 art. 11^1: the online withdrawal function, reachable from every page.
  { href: '/retragere', label: { ro: 'Retrage-te din contract aici', en: 'Withdraw from the contract here' } },
  { href: '/pentru-companii', en: '/for-business', label: { ro: 'Pentru companii (−40%)', en: 'For business (−40%)' }, mainOnly: true },
  { href: '/intrebari-frecvente', label: { ro: 'Întrebări frecvente', en: 'FAQ' }, mainOnly: true },
  { href: '/contact-us', label: { ro: 'Contact', en: 'Contact' }, mainOnly: true },
  { href: '/about-us', label: { ro: 'Despre noi', en: 'About us' }, mainOnly: true },
]

const legal: FooterLink[] = [
  { href: `/${page('terms-of-service').slug}`, label: { ro: 'Termeni și condiții', en: 'Terms and conditions' } },
  { href: `/${page('terms-of-service').slug}#comunicari`, label: { ro: 'Comunicări comerciale', en: 'Commercial communications' } },
  { href: `/${page('privacy-policy').slug}`, label: { ro: 'Confidențialitate', en: 'Privacy' } },
  { href: `/${page('politica-cookies').slug}`, label: { ro: 'Politica de cookies', en: 'Cookie policy' } },
]

const COPY = {
  ro: {
    line1: 'Mai calm seara.',
    line2: 'Mai atent ziua.',
    products: 'Vezi produsele',
    productsTitle: 'Produse',
    help: 'Ajutor',
    newTab: ' (se deschide într-o filă nouă)',
    sal: 'ANPC SAL, soluționarea alternativă a litigiilor',
  },
  en: {
    line1: 'Calmer evenings.',
    line2: 'Sharper days.',
    products: 'See the products',
    productsTitle: 'Products',
    help: 'Help',
    newTab: ' (opens in a new tab)',
    sal: 'ANPC SAL, alternative dispute resolution',
  },
}

/**
 * The ending: the opening line returns on the dark surface, then everything practical in
 * four short columns (products, help, legal, contact). On phones the columns pair up.
 */
export async function Footer() {
  const locale = await getLocale()
  const t = COPY[locale]
  const ui = await getUi()
  const products = productsIn(locale)
  return (
    <footer className="on-dark bg-dark text-dark-muted">
      <div className="wrap pt-[calc(var(--sec)*0.8)] pb-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <p className="text-[clamp(40px,5.6vw,80px)] leading-[0.96] font-medium tracking-[-0.045em] text-white">
            {t.line1}
            <br />
            {t.line2}
          </p>
          <Link href="/products" className="cta self-start md:self-auto">
            {t.products} <Arrow />
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-2 gap-x-6 gap-y-10 border-t border-dark-line pt-10 text-[15px] md:grid-cols-12 max-sm:mt-12">
          <nav aria-labelledby="ft-products" className="col-span-2 md:col-span-4">
            <h2 id="ft-products" className="text-[13px] font-semibold tracking-[0.12em] text-white uppercase">
              {t.productsTitle}
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
              {t.help}
            </h2>
            <ul className="mt-4">
              {help.map((l) => {
                const item = (
                  <li key={l.href}>
                    <Link href={locale === 'en' && l.en ? l.en : l.href} className="flex min-h-10 items-center hover:text-white">
                      {l.label[locale]}
                    </Link>
                  </li>
                )
                return l.mainOnly ? <MainHostOnly key={l.href}>{item}</MainHostOnly> : item
              })}
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
                    {l.label[locale]}
                  </Link>
                </li>
              ))}
              <li>
                <CookieSettingsButton className="flex min-h-10 items-center text-left hover:text-white" />
              </li>
              <li>
                <a href="https://anpc.ro" target="_blank" rel="noopener noreferrer" className="flex min-h-10 items-center hover:text-white">
                  ANPC
                  <span className="sr-only">{t.newTab}</span>
                </a>
              </li>
              <li>
                <a href="https://reclamatiisal.anpc.ro" target="_blank" rel="noopener noreferrer" className="flex min-h-10 items-center hover:text-white">
                  {t.sal}
                  <span className="sr-only">{t.newTab}</span>
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
            <p className="mt-3">{ui.replyTime}.</p>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-dark-line pt-6 text-[13.5px] md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Wordmark tone="dark" className="text-white" />
            <span>© {new Date().getFullYear()}</span>
          </div>
          <div className="max-w-[46em] space-y-1 md:text-right">
            {companyLine() && <p>{companyLine()}</p>}
            <p>{ui.wellness}</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
