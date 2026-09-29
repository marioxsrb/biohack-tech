import Image from 'next/image'
import { Arrow } from '@/components/ui/icons'
import { getProduct } from '@/content/catalog'
import type { Landing } from '@/content/landings'
import { terms } from '@/config/site'
import { formatLei } from '@/lib/money'
import { AmberSelector } from '../AmberSelector'
import { HeroCta } from '../HeroCta'
import { FinalCta, Help, Kicker, LandingFaq, LandingShell, Testimonials, Title } from '../kit'

import terasa from '@/assets/img/glasses/lifestyle-terasa.webp'
import seara from '@/assets/img/glasses/result-seara.webp'
import birou from '@/assets/img/glasses/result-focus.webp'

const CTA = 'Alege perechile'

/**
 * NEUROS Amber, the simplest landing: what the lens does, then the frames to choose from (mix and match,
 * 2+1 built in), when to wear them, questions. The site's neutral surfaces, type and red button; the
 * warmth comes from the lens photographs and a little amber light, never from brown surfaces. The glasses first as an object worth wearing, then the four
 * frames, what the lens does, when to wear them, the 2+1 offer as a clear calculation, and the purchase.
 */
export function AmberLanding({ landing }: { landing: Landing }) {
  const p = getProduct(landing.productId)!
  return (
    <LandingShell landing={landing} heroTone="dark" cta={CTA}>
      {/* Hero: the photograph first, the proposition and the offer beside it. */}
      <section id="lp-hero" aria-labelledby="lp-title" className="relative isolate">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(60%_70%_at_28%_40%,rgb(240_179_90/0.22),transparent_70%)]" />
        <div className="lp-wrap pt-24 pb-[var(--sec)] max-sm:pt-20">
          <div className="grid items-center gap-y-10 lg:grid-cols-12 lg:gap-x-12">
            <div className="relative aspect-[16/11] overflow-hidden rounded-[32px] lg:col-span-7 max-sm:-mx-[var(--gut)] max-sm:rounded-none">
              <Image src={terasa} alt="Femeie pe o terasă, la apus, purtând NEUROS Amber cat eye bej" fill priority placeholder="blur" sizes="(min-width: 1152px) 680px, 100vw" className="object-cover object-[72%_40%]" />
            </div>
            <div className="lg:col-span-5">
              <Kicker>{p.name} · pentru ecrane</Kicker>
              <h1 id="lp-title" className="mt-4 text-[clamp(40px,4.8vw,68px)] leading-[0.98] tracking-[-0.045em]">
                Ecranele, într-o lumină mai caldă.
              </h1>
              <p className="mt-5 max-w-[26em] text-[clamp(17px,1.3vw,19px)] leading-snug text-[var(--lp-muted)]">
                Ochelari cu lentile chihlimbar. Filtrează lumina albastră a ecranelor. Patru rame, același filtru.
              </p>
              <div className="mt-7 flex items-stretch gap-4">
                <div>
                  <p className="text-[30px] font-medium tracking-[-0.03em] tabular-nums">{p.price !== null && formatLei(p.price)}</p>
                  <p className="text-[14px] text-[var(--lp-muted)]">{terms.vat} · livrare gratuită</p>
                </div>
                <a href="#comanda" className="flex flex-col justify-center rounded-[16px] bg-[var(--lp-ink)] px-4 py-2 text-white">
                  <span className="text-[22px] leading-none font-semibold tracking-[-0.02em] whitespace-nowrap text-[#f0b35a]">2+1 gratis</span>
                  <span className="mt-1 text-[13px] text-white/75">la 3 perechi</span>
                </a>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
                <HeroCta slug={landing.slug} productId={p.id} label={CTA} />
                <a href="#cum" className="tlink">
                  Ce face lentila <Arrow />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works: the lens, in the evening. */}
      <section id="cum" aria-labelledby="cum-title" className="relative isolate overflow-hidden bg-dark py-[var(--sec)] text-white">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(55%_80%_at_75%_50%,rgb(240_179_90/0.16),transparent_70%)]" />
        <div className="lp-wrap grid items-center gap-y-10 lg:grid-cols-12 lg:gap-x-12">
          <div className="on-dark lg:col-span-5">
            <p className="text-[13px] font-semibold tracking-[0.14em] text-[#f0b35a] uppercase">Cum funcționează</p>
            <h2 id="cum-title" className="mt-3 text-[clamp(32px,3.6vw,48px)] leading-[1.02] tracking-[-0.04em] !text-white">
              Lentila chihlimbar filtrează lumina albastră.
            </h2>
            <div className="mt-5 max-w-[28em] space-y-4 text-[17px] leading-relaxed text-white/80">
              <p>Monitorul, telefonul și becurile LED emit lumină albastră.</p>
              <p>Lentilele de culoarea chihlimbarului o filtrează. Lumina ecranelor devine mai blândă.</p>
              <p>Rama e ușoară, ca să îi porți toată ziua.</p>
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] lg:col-span-7">
            <Image src={seara} alt="Femeie în pat, seara, citind pe tabletă cu NEUROS Amber" fill placeholder="blur" sizes="(min-width: 1152px) 660px, 100vw" className="object-cover" />
          </div>
        </div>
      </section>

      <AmberSelector slug={landing.slug} productId={p.id} />

      {/* When to wear them. */}
      <section aria-labelledby="cand" className="lp-wrap">
        <div className="grid items-center gap-y-10 lg:grid-cols-12 lg:gap-x-12">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] lg:order-2 lg:col-span-6">
            <Image src={birou} alt="Bărbat concentrat la birou, purtând NEUROS Amber" fill placeholder="blur" sizes="(min-width: 1152px) 560px, 100vw" className="object-cover" />
          </div>
          <div className="lg:order-1 lg:col-span-6">
            <Kicker>Când îi porți</Kicker>
            <Title id="cand" className="mt-3">
              Ziua la birou. Seara, cu telefonul.
            </Title>
            <ul className="mt-8 divide-y divide-[var(--lp-line)] border-y border-[var(--lp-line)]">
              {[
                ['La birou', 'În fața monitorului, ore în șir.'],
                ['Seara', 'Când citești pe tabletă sau te uiți la telefon.'],
              ].map(([t, d]) => (
                <li key={t} className="grid gap-1 py-4 sm:grid-cols-[200px_1fr] sm:gap-6">
                  <span className="text-[17px] font-medium">{t}</span>
                  <span className="text-[16px] text-[var(--lp-muted)]">{d}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <Testimonials productId={p.id} />
      <LandingFaq items={landing.faqs} />
      <Help title="Nu știi ce ramă să alegi?" text="Scrie-ne ce formă porți de obicei. Te ajutăm să alegi." />
      <FinalCta title="Trei perechi, una gratuită." cta={CTA} />
    </LandingShell>
  )
}
