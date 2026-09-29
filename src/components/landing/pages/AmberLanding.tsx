import Image from 'next/image'
import { Arrow } from '@/components/ui/icons'
import { getProduct } from '@/content/catalog'
import type { Landing } from '@/content/landings'
import { terms } from '@/config/site'
import { formatLei } from '@/lib/money'
import { priceLines } from '@/lib/promotions'
import { HeroCta } from '../HeroCta'
import { LandingOffer } from '../LandingOffer'
import { FinalCta, Help, Kicker, LandingFaq, LandingShell, Lead, Specs, Testimonials, Title } from '../kit'

import terasa from '@/assets/img/glasses/lifestyle-terasa.webp'
import seara from '@/assets/img/glasses/result-seara.webp'
import birou from '@/assets/img/glasses/result-focus.webp'
import catNegru from '@/assets/img/glasses/cat-eye-negru-1.webp'
import catBej from '@/assets/img/glasses/cat-eye-bej-1.webp'
import sqNegru from '@/assets/img/glasses/patrat-negru-1.webp'
import sqMaro from '@/assets/img/glasses/patrat-maro-1.webp'

const CTA = 'Alege rama'
const FRAMES = [
  { src: catNegru, label: 'Cat eye', color: 'Negru' },
  { src: catBej, label: 'Cat eye', color: 'Bej' },
  { src: sqNegru, label: 'Unisex pătrat', color: 'Negru' },
  { src: sqMaro, label: 'Unisex pătrat', color: 'Maro' },
]

/**
 * NEUROS Amber: a warm page in evening light. The glasses first as an object worth wearing, then the four
 * frames, what the lens does, when to wear them, the 2+1 offer as a clear calculation, and the purchase.
 */
export function AmberLanding({ landing }: { landing: Landing }) {
  const p = getProduct(landing.productId)!
  // The 2+1 example is computed by the same engine the cart uses, from the catalog price.
  const three = priceLines([{ key: 'x', productId: p.id, quantity: 3, unitAmount: p.price ?? 0 }])
  return (
    <LandingShell landing={landing} heroTone="dark" cta={CTA}>
      {/* Hero: the photograph first, the proposition and the offer beside it. */}
      <section id="lp-hero" aria-labelledby="lp-title" className="lp-wrap pt-24 pb-[var(--sec)] max-sm:pt-20">
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
              <a href="#doi-plus-unu" className="flex flex-col justify-center rounded-[16px] bg-[var(--lp-ink)] px-4 py-2 text-white">
                <span className="text-[22px] leading-none font-semibold tracking-[-0.02em] whitespace-nowrap">2+1 gratis</span>
                <span className="mt-1 text-[13px] text-white/75">la 3 perechi</span>
              </a>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <HeroCta slug={landing.slug} productId={p.id} label={CTA} />
              <a href="#rame" className="tlink">
                Vezi ramele <Arrow />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* The four frames, as objects. */}
      <section id="rame" aria-labelledby="rame-title" className="scroll-mt-10 bg-white py-[var(--sec)]">
        <div className="lp-wrap">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <Title id="rame-title">Patru rame. Același filtru.</Title>
            <Lead className="max-w-[24em] text-[var(--lp-muted)]">Alegi forma și culoarea. Lentilele sunt aceleași.</Lead>
          </div>
          <ul className="mt-10 grid grid-cols-2 gap-x-5 gap-y-8 lg:grid-cols-4">
            {FRAMES.map((f) => (
              <li key={f.label + f.color}>
                <div className="relative aspect-[4/3] rounded-[20px] bg-[var(--lp-bg)]">
                  <Image src={f.src} alt={`NEUROS Amber ${f.label.toLowerCase()} ${f.color.toLowerCase()}, din față`} fill sizes="(min-width: 1024px) 270px, 45vw" className="object-contain p-[10%]" />
                </div>
                <p className="mt-3 text-[17px] font-medium">{f.label}</p>
                <p className="text-[15px] text-[var(--lp-muted)]">{f.color}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works: the lens, in the evening. */}
      <section id="cum" aria-labelledby="cum-title" className="relative isolate overflow-hidden bg-[#1a120a] py-[var(--sec)] text-white">
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

      {/* When to wear them. */}
      <section aria-labelledby="cand" className="lp-wrap pt-[var(--sec)]">
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
                ['Oriunde lucrezi cu ecrane', 'Laptop, telefon, lumină LED.'],
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

      {/* 2+1: the offer as a calculation. */}
      <section id="doi-plus-unu" aria-labelledby="oferta-title" className="lp-wrap scroll-mt-10 pt-[var(--sec)]">
        <div className="grid overflow-hidden rounded-[32px] bg-[var(--lp-ink)] text-white lg:grid-cols-12">
          <div className="on-dark p-[clamp(24px,4.4vw,56px)] lg:col-span-6">
            <p className="text-[13px] font-semibold tracking-[0.14em] text-[#f0b35a] uppercase">Ofertă</p>
            <h2 id="oferta-title" className="mt-3 !text-white">
              <span className="block text-[clamp(64px,8vw,112px)] leading-[0.9] font-medium tracking-[-0.05em]">2+1</span>
              <span className="mt-2 block text-[clamp(26px,2.6vw,34px)] leading-tight tracking-[-0.03em] text-[#f0b35a]">gratis</span>
            </h2>
            <p className="mt-5 max-w-[26em] text-[17px] leading-relaxed text-white/80">Alegi trei perechi, plătești două. Poți combina ramele: una pentru birou, una pentru seară, una de rezervă.</p>
            <dl className="mt-8 grid max-w-[26em] grid-cols-[1fr_auto] gap-y-2 border-t border-white/15 pt-5 text-[16px]">
              <dt className="text-white/70">3 perechi, la preț întreg</dt>
              <dd className="text-right text-white/70 tabular-nums">{formatLei(three.subtotalMinor)}</dd>
              <dt className="font-semibold">Plătești</dt>
              <dd className="text-right font-semibold tabular-nums">{formatLei(three.totalMinor)}</dd>
            </dl>
            <a href="#comanda" className="cta mt-8">
              Alege ramele <Arrow />
            </a>
          </div>
          <div className="flex flex-col justify-center gap-1 bg-[#2a1d10] px-[8%] py-8 lg:col-span-6">
            {[catBej, sqNegru, sqMaro].map((src, i) => (
              <div key={i} className={`relative aspect-[5/2] w-[78%] ${i === 1 ? 'self-end' : ''}`}>
                <Image src={src} alt="" fill sizes="420px" className="object-contain" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <LandingOffer slug={landing.slug} productId={p.id} cta="Comandă NEUROS Amber" title="Alege-ți rama." text="Același preț pentru toate cele patru rame. La trei perechi, una e gratuită." />

      <section aria-labelledby="detalii" className="lp-wrap pb-[var(--sec)]">
        <div className="grid gap-y-8 lg:grid-cols-12 lg:gap-x-12">
          <div className="lg:col-span-4">
            <Kicker>Detalii</Kicker>
            <Title id="detalii" className="mt-3">
              Ce primești.
            </Title>
          </div>
          <Specs
            className="lg:col-span-8"
            rows={[
              ['Modele', 'Cat eye, unisex pătrat'],
              ['Culori', 'Cat eye: negru, bej. Unisex pătrat: negru, maro'],
              ['Lentile', 'Filtru pentru lumina albastră, nuanță chihlimbar'],
              ['Ramă', 'Ușoară, pentru purtare zilnică'],
              ['Garanție', `${terms.warrantyYears} ani`],
            ]}
          />
        </div>
      </section>

      <Testimonials productId={p.id} />
      <LandingFaq items={landing.faqs} />
      <Help title="Nu știi ce ramă să alegi?" text="Scrie-ne ce formă porți de obicei. Te ajutăm să alegi." />
      <FinalCta productId={p.id} line="Lentile chihlimbar pentru ecrane. Patru rame. La trei perechi, una e gratuită." cta="Alege rama" />
    </LandingShell>
  )
}
