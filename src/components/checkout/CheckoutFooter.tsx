import Link from '@/components/ui/Link'
import { CookieSettingsButton } from '@/components/consent/ConsentManager'
import { companyLine } from '@/config/company'
import { site } from '@/config/site'
import { getLocale } from '@/i18n/server'

/** Everything a buyer may need to read before paying, and nothing to browse. */
const LINKS = {
  ro: [
    ['/terms-of-service', 'Termeni și condiții'],
    ['/terms-of-service#comunicari', 'Comunicări comerciale'],
    ['/privacy-policy', 'Confidențialitate'],
    ['/politica-cookies', 'Cookies'],
    ['/politica-livrare', 'Livrare'],
    ['/plati', 'Plăți'],
    ['/politica-retur', 'Retur'],
    ['/garantie', 'Garanție'],
    // OUG 34/2014 art. 11^1: the online withdrawal function, reachable from every page.
    ['/retragere', 'Retrage-te din contract aici'],
  ],
  en: [
    ['/terms-of-service', 'Terms and conditions'],
    ['/terms-of-service#comunicari', 'Commercial communications'],
    ['/privacy-policy', 'Privacy'],
    ['/politica-cookies', 'Cookies'],
    ['/politica-livrare', 'Delivery'],
    ['/plati', 'Payments'],
    ['/politica-retur', 'Returns'],
    ['/garantie', 'Warranty'],
    ['/retragere', 'Withdraw from the contract here'],
  ],
} as const

const COPY = {
  ro: { wellness: 'Produse de wellness pentru uz zilnic. Pentru o afecțiune, cere întâi sfatul medicului.', legal: 'Informații legale', newTab: ' (se deschide într-o filă nouă)' },
  en: { wellness: 'Wellness devices for daily use. If you have a medical condition, ask your doctor first.', legal: 'Legal information', newTab: ' (opens in a new tab)' },
}

export async function CheckoutFooter() {
  const locale = await getLocale()
  const t = COPY[locale]
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
          <p>{t.wellness}</p>
        </div>
        <nav aria-label={t.legal}>
          <ul className="flex max-w-[36em] flex-wrap gap-x-5 gap-y-0.5 md:justify-end">
            {LINKS[locale].map(([href, label]) => (
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
                ANPC<span className="sr-only">{t.newTab}</span>
              </a>
            </li>
            <li>
              <a href="https://reclamatiisal.anpc.ro" target="_blank" rel="noopener noreferrer" className="flex min-h-10 items-center hover:text-ink">
                ANPC SAL<span className="sr-only">{t.newTab}</span>
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  )
}
