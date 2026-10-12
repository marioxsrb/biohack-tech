/**
 * NEUROS Amber, told once: the hero, what the lens does, when to wear them. Used by the landing (with
 * the frame selector and the 2+1 offer) and by the presentation page (information only).
 */
import Image from 'next/image'
import type { ReactNode } from 'react'
import { Arrow } from '@/components/ui/icons'
import { Kicker, Title } from '../parts'

import terasa from '@/assets/img/glasses/lifestyle-terasa.webp'
import seara from '@/assets/img/glasses/result-seara.webp'
import birou from '@/assets/img/glasses/result-focus.webp'

/** Hero: the photograph first, the proposition and the offer beside it. */
export function AmberHero({ name, buy, cta }: { name: string; buy?: ReactNode; cta?: ReactNode }) {
  return (
    <section id="lp-hero" aria-labelledby="lp-title" className="relative isolate">
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(60%_70%_at_28%_40%,rgb(240_179_90/0.22),transparent_70%)]" />
      <div className="lp-wrap pt-24 pb-[var(--sec)] max-sm:pt-20">
        <div className="grid items-center gap-y-10 lg:grid-cols-12 lg:gap-x-12">
          <div className="relative aspect-[16/11] overflow-hidden rounded-[32px] lg:col-span-7 max-sm:-mx-[var(--gut)] max-sm:rounded-none">
            <Image
              src={terasa}
              alt="Femeie pe o terasă, la apus, purtând NEUROS Amber cat eye bej"
              fill
              loading="eager"
              fetchPriority="high"
              quality={85}
              placeholder="blur"
              sizes="(min-width: 1152px) 680px, 100vw"
              className="object-cover object-[72%_40%]"
            />
          </div>
          <div className="lg:col-span-5">
            <Kicker>{name} · ochelari pentru lumina albastră</Kicker>
            <h1 id="lp-title" className="mt-4 text-[clamp(40px,4.8vw,68px)] leading-[0.98] tracking-[-0.045em]">
              Ecranele, într-o lumină mai caldă.
            </h1>
            <p className="mt-5 max-w-[26em] text-[clamp(17px,1.3vw,19px)] leading-snug text-[var(--lp-muted)]">
              Ochii tăi petrec ore întregi în lumina ecranelor. Lentilele chihlimbar filtrează lumina albastră. Patru rame, același filtru.
            </p>
            {buy}
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              {cta}
              <a href="#cum" className="tlink">
                Ce face lentila <Arrow />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/** How it works: the lens, in the evening. */
export function AmberHow() {
  return (
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
            <p>Lentilele chihlimbar o filtrează. Lumina ecranelor devine mai blândă.</p>
            <p>Rama este ușoară. Îi porți toată ziua.</p>
          </div>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] lg:col-span-7">
          <Image src={seara} alt="Femeie în pat, seara, citind pe tabletă cu NEUROS Amber" fill placeholder="blur" sizes="(min-width: 1152px) 660px, 100vw" className="object-cover" />
        </div>
      </div>
    </section>
  )
}

/** When to wear them. */
export function AmberWhen() {
  return (
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
              ['Seara', 'Când citești pe tabletă sau stai pe telefon. Lumina ecranului devine mai blândă înainte de somn.'],
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
  )
}

/** The landing's one section of explanation: what the lens does and when to wear them, beside the evening photograph. */
export function AmberWhy() {
  return (
    <section id="cum" aria-labelledby="cum-title" className="lp-wrap scroll-mt-20 py-[var(--sec)]">
      <div className="grid items-center gap-y-10 lg:grid-cols-12 lg:gap-x-14">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[28px] lg:col-span-5 max-lg:aspect-[4/3]">
          <Image src={seara} alt="Femeie în pat, seara, citind pe tabletă cu NEUROS Amber" fill placeholder="blur" quality={85} sizes="(min-width: 1152px) 470px, 100vw" className="object-cover" />
        </div>
        <div className="lg:col-span-7">
          <Kicker>Cum funcționează</Kicker>
          <Title id="cum-title" className="mt-3 max-w-[14em]">
            Lentila chihlimbar filtrează lumina albastră.
          </Title>
          <p className="mt-5 max-w-[30em] text-[17.5px] leading-relaxed text-[var(--lp-muted)]">
            Monitorul, telefonul și becurile LED emit lumină albastră. Lentilele chihlimbar o filtrează, iar lumina ecranelor devine mai blândă. Rama este ușoară: îi porți toată ziua.
          </p>
          <ul className="mt-9 divide-y divide-[var(--lp-line)] border-y border-[var(--lp-line)]">
            {[
              ['La birou', 'În fața monitorului, ore în șir.'],
              ['Seara', 'Pe telefon sau pe tabletă. Lumina ecranului devine mai blândă înainte de somn.'],
            ].map(([t, d]) => (
              <li key={t} className="grid gap-1 py-4 sm:grid-cols-[160px_1fr] sm:gap-6">
                <span className="text-[17px] font-medium text-[var(--lp-ink)]">{t}</span>
                <span className="text-[16px] text-[var(--lp-muted)]">{d}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
