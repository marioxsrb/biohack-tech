import Image from 'next/image'
import Link from 'next/link'
import { CookieSettingsButton } from '@/components/consent/ConsentManager'
import { Wordmark } from '@/components/site/Wordmark'
import { getProduct } from '@/content/catalog'
import type { Landing } from '@/content/landings'
import { companyLine } from '@/config/company'
import { site, terms } from '@/config/site'
import { HeroCta } from './HeroCta'
import { LandingOffer } from './LandingOffer'

/**
 * One advertising landing: a full-bleed photograph with one message, three facts, the product in use,
 * how it works, a second moment, the offer with its picker, questions, and the legal essentials.
 * No site menu and no links away except the legal pages: the only road is the checkout.
 */
export function LandingPage({ landing }: { landing: Landing }) {
  const product = getProduct(landing.productId)!
  const t = landing.theme
  const vars = {
    '--lp-bg': t.bg,
    '--lp-ink': t.ink,
    '--lp-muted': t.muted,
    '--lp-panel': t.panel,
    '--lp-line': t.line,
    '--lp-accent': t.accent,
  } as React.CSSProperties
  const heroLight = t.heroTone === 'light'

  return (
    <div style={vars} className="lp min-h-dvh bg-[var(--lp-bg)] text-[var(--lp-ink)]">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="lp-wrap flex h-16 items-center justify-between">
          <span className={heroLight ? 'text-white' : 'text-[var(--lp-ink)]'}>
            <Wordmark tone={heroLight ? 'dark' : 'light'} />
          </span>
          <a
            href="#comanda"
            className={`flex min-h-11 items-center rounded-full px-4 text-[15px] font-medium backdrop-blur-md transition-colors ${
              heroLight ? 'bg-white/12 text-white hover:bg-white/20' : 'bg-white/70 text-[var(--lp-ink)] shadow-[inset_0_0_0_1px_var(--lp-line)] hover:bg-white'
            }`}
          >
            Comandă
          </a>
        </div>
      </header>

      <main id="main">
        {/* Hero: the photograph, with the message on its clear side. */}
        <section aria-labelledby="lp-title" className="relative flex min-h-[min(92dvh,860px)] items-end overflow-hidden max-md:min-h-0 max-md:flex-col max-md:items-stretch">
          <div className="absolute inset-0 max-md:relative max-md:aspect-[4/3]">
            <Image src={landing.hero.image.src} alt={landing.hero.image.alt} fill priority placeholder="blur" sizes="100vw" className={`object-cover ${landing.hero.position ?? ''}`} />
            <div
              aria-hidden
              className={`absolute inset-0 max-md:hidden ${
                heroLight ? 'bg-[linear-gradient(90deg,rgb(0_0_0/.62),rgb(0_0_0/.2)_55%,transparent)]' : 'bg-[linear-gradient(90deg,rgb(255_255_255/.78),rgb(255_255_255/.35)_45%,transparent_70%)]'
              }`}
            />
          </div>
          <div className="lp-wrap relative w-full pt-28 pb-[clamp(56px,9vh,112px)] max-md:pt-8 max-md:pb-12">
            <p className={`text-[15px] font-semibold tracking-[0.14em] uppercase ${heroLight ? 'text-white/80 max-md:text-[var(--lp-accent)]' : 'text-[var(--lp-accent)]'}`}>
              {landing.hero.eyebrow}
            </p>
            <h1
              id="lp-title"
              className={`mt-4 max-w-[11em] text-[clamp(42px,6vw,88px)] leading-[0.97] tracking-[-0.045em] ${heroLight ? 'text-white max-md:text-[var(--lp-ink)]' : 'text-[var(--lp-ink)]'}`}
            >
              {landing.hero.title.map((line, i) => (
                <span key={i} className={`block ${i === landing.hero.title.length - 1 ? 'text-[var(--lp-accent)]' : ''}`}>
                  {line}
                </span>
              ))}
            </h1>
            <p className={`mt-5 max-w-[30em] text-[clamp(17px,1.4vw,20px)] leading-snug ${heroLight ? 'text-white/85 max-md:text-[var(--lp-muted)]' : 'text-[var(--lp-muted)]'}`}>
              {landing.hero.text}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <HeroCta slug={landing.slug} productId={product.id} choose={product.variants?.length ? product.chooseLabel : undefined} />
              <span className={`text-[15px] ${heroLight ? 'text-white/80 max-md:text-[var(--lp-muted)]' : 'text-[var(--lp-muted)]'}`}>Livrare gratuită în România</span>
            </div>
          </div>
        </section>

        {/* Three facts */}
        <section aria-label="Pe scurt" className="lp-wrap pt-[calc(var(--sec)*0.8)]">
          <ul className="grid gap-6 sm:grid-cols-3">
            {landing.points.map((p, i) => (
              <li key={p.title} className="border-t border-[var(--lp-line)] pt-5">
                <span aria-hidden className="font-mono text-[12px] tracking-[0.12em] text-[var(--lp-accent)]">
                  0{i + 1}
                </span>
                <p className="mt-2 text-[22px] leading-snug font-medium tracking-[-0.02em]">{p.title}</p>
                <p className="mt-1.5 max-w-[22em] text-[16.5px] leading-relaxed text-[var(--lp-muted)]">{p.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* The product in use */}
        <section aria-labelledby="lp-story" className="lp-wrap pt-[var(--sec)]">
          <div className="grid items-center gap-y-8 md:grid-cols-12 md:gap-x-10">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[24px] md:col-span-7 max-sm:-mx-[var(--gut)] max-sm:rounded-none">
              <Image src={landing.story.image.src} alt={landing.story.image.alt} fill placeholder="blur" sizes="(min-width: 1152px) 660px, (min-width: 768px) 58vw, 100vw" className="object-cover" />
            </div>
            <div className="md:col-span-5">
              <h2 id="lp-story" className="text-[clamp(32px,3.4vw,48px)] leading-[1.02] tracking-[-0.04em]">
                {landing.story.title}
              </h2>
              <p className="mt-4 max-w-[28em] text-[17.5px] leading-relaxed text-[var(--lp-muted)]">{landing.story.text}</p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section aria-labelledby="lp-steps" className="lp-wrap pt-[var(--sec)]">
          <div className="rounded-[28px] bg-[var(--lp-panel)] p-[clamp(24px,5vw,64px)]">
            <h2 id="lp-steps" className="text-[clamp(28px,3vw,40px)] leading-tight tracking-[-0.035em]">
              {landing.steps.title}
            </h2>
            <ol className="mt-8 grid gap-6 md:grid-cols-3">
              {landing.steps.items.map((s, i) => (
                <li key={s} className="flex gap-4 md:flex-col md:gap-5">
                  <span aria-hidden className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[var(--lp-bg)] text-[15px] font-semibold tabular-nums shadow-[inset_0_0_0_1px_var(--lp-line)]">
                    {i + 1}
                  </span>
                  <span className="pt-1.5 text-[19px] leading-snug tracking-[-0.01em]">{s}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* A second moment */}
        <section aria-labelledby="lp-moment" className="relative mt-[var(--sec)] overflow-hidden">
          <div className="relative aspect-[21/9] max-md:aspect-[4/3]">
            <Image src={landing.moment.image.src} alt={landing.moment.image.alt} fill placeholder="blur" sizes="100vw" className="object-cover" />
            <div aria-hidden className="absolute inset-0 bg-[linear-gradient(0deg,rgb(0_0_0/.55),transparent_55%)]" />
          </div>
          <div className="lp-wrap absolute inset-x-0 bottom-0 pb-[clamp(24px,5vw,56px)] max-md:relative max-md:bg-[var(--lp-bg)] max-md:pt-6 max-md:pb-0">
            <h2 id="lp-moment" className="text-[clamp(28px,3.2vw,44px)] leading-tight tracking-[-0.035em] text-white max-md:text-[var(--lp-ink)]">
              {landing.moment.title}
            </h2>
            <p className="mt-2 max-w-[30em] text-[17px] text-white/85 max-md:text-[var(--lp-muted)]">{landing.moment.text}</p>
          </div>
        </section>

        <LandingOffer slug={landing.slug} productId={product.id} title={landing.offer.title} text={landing.offer.text} />

        {/* Questions */}
        <section aria-labelledby="lp-faq" className="lp-wrap pb-[var(--sec)]">
          <div className="grid gap-y-6 md:grid-cols-12 md:gap-x-10">
            <h2 id="lp-faq" className="text-[clamp(28px,3vw,40px)] leading-tight tracking-[-0.035em] md:col-span-4">
              Întrebări
            </h2>
            <div className="border-t border-[var(--lp-line)] md:col-span-8">
              {landing.faqs.map((f) => (
                <details key={f.q} className="lp-faq group border-b border-[var(--lp-line)]">
                  <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-4 text-[17.5px] font-medium tracking-[-0.012em] [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span aria-hidden className="text-[22px] leading-none text-[var(--lp-accent)] transition-transform duration-200 group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="max-w-[40em] pb-5 text-[16.5px] leading-relaxed text-[var(--lp-muted)]">{f.a}</p>
                </details>
              ))}
              <details className="lp-faq group border-b border-[var(--lp-line)]">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-4 text-[17.5px] font-medium tracking-[-0.012em] [&::-webkit-details-marker]:hidden">
                  Cum ajunge la mine?
                  <span aria-hidden className="text-[22px] leading-none text-[var(--lp-accent)] transition-transform duration-200 group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="max-w-[40em] pb-5 text-[16.5px] leading-relaxed text-[var(--lp-muted)]">
                  Livrarea este gratuită în România. Pregătim comanda în {terms.processingDays} de la confirmarea plății. Transportul durează de obicei {terms.transitDays}. După ce o
                  primești, ai {terms.returnDays} zile să te răzgândești.
                </p>
              </details>
            </div>
          </div>
        </section>

        <p className="lp-wrap pb-10 text-[13.5px] leading-relaxed text-[var(--lp-muted)]">
          {product.name} este un produs de wellness. Nu înlocuiește sfatul medicului. Rezultatele diferă de la o persoană la alta.
        </p>
      </main>

      <footer className="border-t border-[var(--lp-line)] text-[14px] text-[var(--lp-muted)]">
        <div className="lp-wrap flex flex-col gap-5 py-8 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1.5">
            <Wordmark tone={heroLight ? 'dark' : 'light'} className={heroLight ? 'text-white' : 'text-[var(--lp-ink)]'} />
            {companyLine() && <p>{companyLine()}</p>}
            <p>
              <a href={`mailto:${site.email}`} className="underline-offset-4 hover:underline">
                {site.email}
              </a>{' '}
              ·{' '}
              <a href={site.phoneHref} className="underline-offset-4 hover:underline">
                {site.phone}
              </a>
            </p>
          </div>
          <nav aria-label="Informații legale">
            <ul className="flex max-w-[34em] flex-wrap gap-x-5 gap-y-1">
              {LEGAL.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="flex min-h-10 items-center hover:text-[var(--lp-ink)]">
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <CookieSettingsButton className="flex min-h-10 items-center text-left hover:text-[var(--lp-ink)]" />
              </li>
              <li>
                <a href="https://anpc.ro" target="_blank" rel="noopener noreferrer" className="flex min-h-10 items-center hover:text-[var(--lp-ink)]">
                  ANPC<span className="sr-only"> (se deschide într-o filă nouă)</span>
                </a>
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
    </div>
  )
}

const LEGAL = [
  { href: '/terms-of-service', label: 'Termeni și condiții' },
  { href: '/privacy-policy', label: 'Confidențialitate' },
  { href: '/politica-cookies', label: 'Cookies' },
  { href: '/politica-livrare', label: 'Livrare' },
  { href: '/politica-retur', label: 'Retur' },
  { href: '/garantie', label: 'Garanție' },
  { href: '/retragere', label: 'Retrage-te din contract aici' },
]
