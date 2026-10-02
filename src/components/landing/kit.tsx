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
import { Arrow, Mail, Phone } from '@/components/ui/icons'
import { getProduct, type ProductId } from '@/content/catalog'
import { testimonials } from '@/content/home'
import type { Landing } from '@/content/landings'
import { companyLine } from '@/config/company'
import { site, terms } from '@/config/site'
import { StickyBuy } from './StickyBuy'

/** True for dark page backgrounds (relative luminance of the hex colour below 0.2). */
export function isDark(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.2
}

export function themeVars(t: Landing['theme']) {
  return { '--lp-bg': t.bg, '--lp-ink': t.ink, '--lp-muted': t.muted, '--lp-panel': t.panel, '--lp-line': t.line, '--lp-accent': t.accent } as React.CSSProperties
}

/** Header over the hero, the page, the legal footer, and the purchase bar on phones. */
export function LandingShell({ landing, heroTone, cta, children }: { landing: Landing; heroTone: 'light' | 'dark'; cta: string; children: ReactNode }) {
  const product = getProduct(landing.productId)!
  const light = heroTone === 'light'
  return (
    <div style={themeVars(landing.theme)} className="lp min-h-dvh bg-[var(--lp-bg)] text-[var(--lp-ink)]">
        <a href="#main" className="sr-only z-[300] rounded-md bg-paper px-4 py-2 text-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
          Sari la conținut
        </a>
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="lp-wrap flex h-16 items-center justify-between">
          <span className={light ? 'text-white' : 'text-[var(--lp-ink)]'}>
            <Wordmark tone={light ? 'dark' : 'light'} />
          </span>
          <a
            href="#comanda"
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
          <p>Produse de wellness pentru uz zilnic. Nu înlocuiesc sfatul medicului.</p>
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

export function Kicker({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-[13px] font-semibold tracking-[0.14em] text-[var(--lp-accent)] uppercase ${className}`}>{children}</p>
}

export function Title({ id, children, className = '' }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <h2 id={id} className={`text-[clamp(32px,3.8vw,52px)] leading-[1.02] tracking-[-0.04em] text-[var(--lp-ink)] ${className}`}>
      {children}
    </h2>
  )
}

export function Lead({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-[17.5px] leading-relaxed ${className}`}>{children}</p>
}

const COLS: Record<number, string> = { 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4' }

/** Numbered steps. `tone` lets a step list sit on a light or dark surface inside any theme. */
export function Steps({ items, className = '' }: { items: { title: string; text?: string }[]; className?: string }) {
  return (
    <ol className={`grid gap-8 ${COLS[items.length] ?? 'md:grid-cols-3'} ${className}`}>
      {items.map((s, i) => (
        <li key={s.title} className="border-t border-current/15 pt-5">
          <span aria-hidden className="block text-[44px] leading-none font-medium tracking-[-0.04em] tabular-nums opacity-40">
            {i + 1}
          </span>
          <span className="mt-4 block text-[20px] leading-snug font-medium tracking-[-0.015em]">{s.title}</span>
          {s.text && <span className="mt-1.5 block text-[16px] leading-relaxed opacity-75">{s.text}</span>}
        </li>
      ))}
    </ol>
  )
}

/** Label / value rows. Only verified values; unknown ones are simply not listed. */
export function Specs({ rows, className = '' }: { rows: [string, string][]; className?: string }) {
  return (
    <dl className={`divide-y divide-[var(--lp-line)] border-y border-[var(--lp-line)] ${className}`}>
      {rows.map(([k, v]) => (
        <div key={k} className="grid gap-1 py-4 sm:grid-cols-[200px_1fr] sm:gap-6">
          <dt className="text-[15px] text-[var(--lp-muted)]">{k}</dt>
          <dd className="text-[16px] text-[var(--lp-ink)]">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function LandingFaq({ items, id = 'intrebari' }: { items: { q: string; a: string }[]; id?: string }) {
  return (
    <section aria-labelledby={id} className="lp-wrap py-[var(--sec)]">
      <div className="grid gap-y-6 lg:grid-cols-12 lg:gap-x-12">
        <div className="lg:col-span-4">
          <Title id={id}>Întrebări</Title>
          <Lead className="mt-3 max-w-[20em] text-[var(--lp-muted)]">Ce ne întreabă oamenii despre acest produs.</Lead>
        </div>
        <div className="border-t border-[var(--lp-line)] lg:col-span-8">
          {items.map((f) => (
            <details key={f.q} className="group border-b border-[var(--lp-line)]">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-4 text-[18px] leading-snug font-medium tracking-[-0.012em] [&::-webkit-details-marker]:hidden">
                {f.q}
                <span aria-hidden className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[20px] leading-none text-[var(--lp-accent)] shadow-[inset_0_0_0_1px_var(--lp-line)] transition-transform duration-200 group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="max-w-[42em] pb-6 text-[16.5px] leading-relaxed text-[var(--lp-muted)]">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

/** Verified customer words for this product, when there are some. Nothing is shown otherwise. */
export function Testimonials({ productId }: { productId: ProductId }) {
  const list = testimonials.filter((t) => t.productId === productId)
  if (!list.length) return null
  return (
    <section aria-label="Ce spun clienții" className="lp-wrap pb-[var(--sec)]">
      <ul className="grid gap-6 md:grid-cols-3">
        {list.map((t) => (
          <li key={t.quote}>
            <blockquote className="text-[18px] leading-relaxed">„{t.quote}”</blockquote>
            <p className="mt-3 text-[14.5px] text-[var(--lp-muted)]">{t.name}</p>
          </li>
        ))}
      </ul>
    </section>
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
        <a href="#comanda" className="cta flex-none">
          {cta} <Arrow />
        </a>
      </div>
    </section>
  )
}
