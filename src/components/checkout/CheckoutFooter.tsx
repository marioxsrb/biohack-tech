import Link from 'next/link'
import { CookieSettingsButton } from '@/components/consent/ConsentManager'
import { companyLine } from '@/config/company'
import { site } from '@/config/site'

/** Everything a buyer may need to read before paying, and nothing to browse. */
const LINKS = [
  ['/terms-of-service', 'Termeni și condiții'],
  ['/privacy-policy', 'Confidențialitate'],
  ['/politica-cookies', 'Cookies'],
  ['/politica-livrare', 'Livrare'],
  ['/plati', 'Plăți'],
  ['/politica-retur', 'Retur'],
  ['/garantie', 'Garanție'],
  // OUG 34/2014 art. 11^1: the online withdrawal function, reachable from every page.
  ['/retragere', 'Retrage-te din contract aici'],
] as const

export function CheckoutFooter() {
  return (
    <footer className="border-t border-line bg-paper text-[13.5px] text-muted">
      <div className="wrap flex flex-col gap-4 py-8 md:flex-row md:items-start md:justify-between">
        <div className="max-w-[40em] space-y-1.5">
          {companyLine() && <p>{companyLine()}</p>}
          <p>
            <a href={`mailto:${site.email}`} className="hover:text-ink">
              {site.email}
            </a>{' '}
            ·{' '}
            <a href={site.phoneHref} className="hover:text-ink">
              {site.phone}
            </a>
          </p>
          <p>Produse de wellness pentru uz zilnic. Nu înlocuiesc sfatul medicului.</p>
        </div>
        <nav aria-label="Informații legale">
          <ul className="flex max-w-[36em] flex-wrap gap-x-5 gap-y-0.5 md:justify-end">
            {LINKS.map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="flex min-h-10 items-center hover:text-ink">
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <CookieSettingsButton className="flex min-h-10 items-center text-left hover:text-ink" />
            </li>
            <li>
              <a href="https://anpc.ro" target="_blank" rel="noopener noreferrer" className="flex min-h-10 items-center hover:text-ink">
                ANPC<span className="sr-only"> (se deschide într-o filă nouă)</span>
              </a>
            </li>
            <li>
              <a href="https://reclamatiisal.anpc.ro" target="_blank" rel="noopener noreferrer" className="flex min-h-10 items-center hover:text-ink">
                ANPC SAL<span className="sr-only"> (se deschide într-o filă nouă)</span>
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  )
}
