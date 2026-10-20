/**
 * Shared parts of the advertising landings: the frame (header, legal footer, sticky mobile purchase bar),
 * section typography, steps, specifications, product FAQ, the help block and the closing decision. Each
 * landing composes its own story from these; colours come from its theme (--lp-*).
 */
import Link from '@/components/ui/Link'
import type { ReactNode } from 'react'
import { CookieSettingsButton } from '@/components/consent/ConsentManager'
import { ContactForm } from '@/components/contact/ContactForm'
import { Wordmark } from '@/components/site/Wordmark'
import { Arrow, Mail, Phone, WhatsApp } from '@/components/ui/icons'
import { getProduct } from '@/content/catalog'
import type { Landing } from '@/content/landings'
import { companyLine } from '@/config/company'
import { site, terms } from '@/config/site'
import { StickyBuy } from './StickyBuy'
import { isDark, Kicker, Lead, Title, themeVars } from './parts'

export { isDark, Kicker, LandingFaq, Lead, Specs, Steps, Testimonials, themeVars, Title } from './parts'

/** Header over the hero, the page, the legal footer, and the purchase bar on phones. */
export function LandingShell({ landing, heroTone, cta, children }: { landing: Landing; heroTone: 'light' | 'dark'; cta: string; children: ReactNode }) {
  const product = getProduct(landing.productId)!
  const light = heroTone === 'light'
  return (
    <div style={themeVars(landing.theme)} data-landing={landing.slug} className="lp min-h-dvh bg-[var(--lp-bg)] text-[var(--lp-ink)]">
      <a href="#main" className="sr-only z-[500] rounded-md bg-paper px-4 py-2 text-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Sari la conținut
      </a>
      <header className="absolute inset-x-0 top-0 z-[100]">
        <div className="lp-wrap flex h-16 items-center justify-between">
          <span className={light ? 'text-white' : 'text-[var(--lp-ink)]'}>
            <Wordmark tone={light ? 'dark' : 'light'} />
          </span>
          <a
            href="#comanda"
            data-buy
            className={`flex min-h-11 items-center rounded-full px-4 text-[15px] font-semibold backdrop-blur-md transition-colors ${
              light ? 'bg-white/14 text-white hover:bg-white/24' : 'bg-white/80 text-[var(--lp-ink)] shadow-[inset_0_0_0_1px_var(--lp-line)] hover:bg-white'
            }`}
          >
            Comandă
          </a>
        </div>
      </header>
      <main id="main">{children}</main>
      <LandingFooter dark={isDark(landing.theme.bg)} />
      <StickyBuy name={product.name} productId={product.id} cta={cta} />
    </div>
  )
}

function LandingFooter({ dark }: { dark: boolean }) {
  const legal = [
    ['/terms-of-service', 'Termeni și condiții'],
    ['/terms-of-service#comunicari', 'Comunicări comerciale'],
    ['/privacy-policy', 'Confidențialitate'],
    ['/politica-cookies', 'Cookies'],
    ['/politica-livrare', 'Livrare'],
    ['/politica-retur', 'Retur'],
    ['/garantie', 'Garanție'],
    ['/retragere', 'Retrage-te din contract aici'],
  ]
  return (
    <footer className="border-t border-[var(--lp-line)] pb-24 text-[14px] text-[var(--lp-muted)] lg:pb-0">
      <div className="lp-wrap flex flex-col gap-5 py-8 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1.5">
          <span className="text-[var(--lp-ink)]">
            <Wordmark tone={dark ? 'dark' : 'light'} />
          </span>
          {companyLine() && <p className="max-w-[40em]">{companyLine()}</p>}
          <p>
            <a href={`mailto:${site.email}`} className="underline-offset-4 hover:underline">
              {site.email}
            </a>{' '}
            ·{' '}
            <a href={site.phoneHref} className="underline-offset-4 hover:underline">
              {site.phone}
            </a>
          </p>
          <p>Produse de wellness pentru uz zilnic. Pentru o afecțiune, cere întâi sfatul medicului.</p>
        </div>
        <nav aria-label="Informații legale">
          <ul className="flex max-w-[34em] flex-wrap gap-x-5 gap-y-1">
            {legal.map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="flex min-h-10 items-center hover:text-[var(--lp-ink)]">
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <CookieSettingsButton className="flex min-h-10 items-center text-left hover:text-[var(--lp-ink)]" />
            </li>
            <li>
              <a href="https://reclamatiisal.anpc.ro" target="_blank" rel="noopener noreferrer" className="flex min-h-10 items-center hover:text-[var(--lp-ink)]">
                ANPC SAL<span className="sr-only"> (se deschide într-o filă nouă)</span>
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  )
}

/** Still unsure: a person to ask, with the site's contact form (same backend as everywhere). */
export function Help({ title, text }: { title: string; text: string }) {
  return (
    <section id="ajutor" aria-labelledby="help-title" className="lp-wrap pb-[var(--sec)]">
      <div className="grid overflow-hidden rounded-[28px] bg-[var(--lp-panel)] lg:grid-cols-12">
        <div className="p-[clamp(24px,4vw,48px)] lg:col-span-5">
          <Kicker>Ajutor</Kicker>
          <Title id="help-title" className="mt-3 text-[clamp(28px,3vw,40px)]">
            {title}
          </Title>
          <Lead className="mt-3 text-[var(--lp-muted)]">{text}</Lead>
          <ul className="mt-6 space-y-2 text-[16px]">
            <li>
              <a href={`mailto:${site.email}`} className="inline-flex min-h-11 items-center gap-3 hover:text-[var(--lp-accent)]">
                <Mail className="h-[18px] w-[18px] text-[var(--lp-accent)]" /> {site.email}
              </a>
            </li>
            <li>
              <a href={site.phoneHref} className="inline-flex min-h-11 items-center gap-3 hover:text-[var(--lp-accent)]">
                <Phone className="h-[18px] w-[18px] text-[var(--lp-accent)]" /> {site.phone}
              </a>
            </li>
            {site.whatsapp && (
              <li>
                <a href={`https://wa.me/${site.whatsapp}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-3 hover:text-[var(--lp-accent)]">
                  <WhatsApp className="h-[18px] w-[18px] text-[#25d366]" /> WhatsApp
                </a>
              </li>
            )}
          </ul>
          <p className="mt-2 text-[15px] text-[var(--lp-muted)]">Răspundem {terms.responseTime}.</p>
        </div>
        <div className="bg-paper p-[clamp(24px,4vw,48px)] text-ink lg:col-span-7">
          <ContactForm compact />
        </div>
      </div>
    </section>
  )
}

/**
 * The page's last word: one sentence and the way back to the purchase block. No price, offer or trust
 * list here: all of it is in the purchase block, one click away.
 */
export function FinalCta({ title, cta }: { title: string; cta: string }) {
  return (
    <section id="final" aria-labelledby="final-title" className="lp-wrap pb-[var(--sec)]">
      <div className="flex flex-col items-start justify-between gap-6 border-t border-[var(--lp-line)] pt-[clamp(32px,5vw,56px)] md:flex-row md:items-center">
        <h2 id="final-title" className="max-w-[18em] text-[clamp(28px,3vw,40px)] leading-[1.05] tracking-[-0.035em] text-[var(--lp-ink)]">
          {title}
        </h2>
        <a href="#comanda" data-buy className="cta flex-none">
          {cta} <Arrow />
        </a>
      </div>
    </section>
  )
}
