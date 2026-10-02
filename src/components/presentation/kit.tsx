/**
 * The frame of the presentation pages (<slug>.biohack-tech.ro/prezentare): information only. No price,
 * no purchase button, no cart, no cookies, no form, and no link to the main site. The visitor can read,
 * watch and write or call us; nothing else leaves the page.
 */
import Image from 'next/image'
import type { ReactNode } from 'react'
import { Wordmark } from '@/components/site/Wordmark'
import { Mail, Phone } from '@/components/ui/icons'
import type { ProductImage } from '@/content/catalog'
import type { Landing } from '@/content/landings'
import { companyLine } from '@/config/company'
import { site, terms } from '@/config/site'
import { Kicker, LandingFaq, Lead, Specs, Title, themeVars } from '@/components/landing/parts'

export function PresentationShell({ landing, heroTone, children }: { landing: Landing; heroTone: 'light' | 'dark'; children: ReactNode }) {
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
            href="#contact"
            className={`flex min-h-11 items-center rounded-full px-4 text-[15px] font-semibold backdrop-blur-md transition-colors ${
              light ? 'bg-white/14 text-white hover:bg-white/24' : 'bg-white/80 text-[var(--lp-ink)] shadow-[inset_0_0_0_1px_var(--lp-line)] hover:bg-white'
            }`}
          >
            Contact
          </a>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="border-t border-[var(--lp-line)] text-[14px] text-[var(--lp-muted)]">
        <div className="lp-wrap space-y-1.5 py-8">
          <span className="text-[var(--lp-ink)]">
            <Wordmark tone="light" />
          </span>
          {companyLine() && <p className="max-w-[40em]">{companyLine()}</p>}
          <p>Fiecare om răspunde în ritmul lui. Produse de wellness pentru uz zilnic. Pentru o afecțiune, cere întâi sfatul medicului.</p>
        </div>
      </footer>
    </div>
  )
}

/** The facts in one place: a clean product shot beside the label / value rows. */
export function Facts({ image, rows }: { image: ProductImage; rows: [string, string][] }) {
  return (
    <section aria-labelledby="detalii" className="lp-wrap py-[var(--sec)]">
      <div className="grid items-start gap-y-10 lg:grid-cols-12 lg:gap-x-12">
        <div className="lg:col-span-5">
          <Kicker>Detalii tehnice</Kicker>
          <Title id="detalii" className="mt-3">
            Pe scurt, în cifre.
          </Title>
          <div className="relative mt-8 aspect-[3/2] rounded-[24px] bg-[var(--lp-panel)]">
            <Image src={image.src} alt={image.alt} fill sizes="(min-width: 1152px) 440px, 100vw" className="object-contain p-[10%]" />
          </div>
        </div>
        <Specs className="lg:col-span-7" rows={rows} />
      </div>
    </section>
  )
}

/** The product questions, without the ones about buying. */
export function Questions({ landing }: { landing: Landing }) {
  return <LandingFaq items={landing.faqs.filter((f) => !f.buy)} />
}

/** A person to ask: email and phone only, so the page collects no data of its own. */
export function Contact({ text }: { text: string }) {
  return (
    <section id="contact" aria-labelledby="contact-title" className="lp-wrap scroll-mt-10 pb-[var(--sec)]">
      <div className="rounded-[28px] bg-[var(--lp-panel)] p-[clamp(24px,4vw,56px)] md:grid md:grid-cols-12 md:items-center md:gap-x-12">
        <div className="md:col-span-6">
          <Kicker>Contact</Kicker>
          <Title id="contact-title" className="mt-3 text-[clamp(28px,3vw,40px)]">
            Ai o întrebare?
          </Title>
          <Lead className="mt-3 text-[var(--lp-muted)]">{text}</Lead>
        </div>
        <div className="mt-6 md:col-span-6 md:mt-0">
          <ul className="space-y-2 text-[17px]">
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
      </div>
    </section>
  )
}
