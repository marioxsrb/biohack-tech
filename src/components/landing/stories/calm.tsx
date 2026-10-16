/**
 * NEUROS Calm, told once: the evening hero, why the neck, the three steps, the two moments. Used by the
 * landing (with price and purchase) and by the presentation page (information only). Server markup only.
 */
import Image from 'next/image'
import type { ReactNode } from 'react'
import { Arrow } from '@/components/ui/icons'
import { Kicker, Steps, Title } from '../parts'

import somn from '@/assets/img/balance-wave/result-somn.webp'
import spate from '@/assets/img/balance-wave/dispozitiv.webp'
import nervVag from '@/assets/img/balance-wave/pillar-nerv-vag.webp'
import birou from '@/assets/img/balance-wave/audience-birou.webp'
import canapea from '@/assets/img/balance-wave/lifestyle-canapea.webp'

/** Hero: the evening photograph, the message on the dark side. `buy` holds the price and the button. */
export function CalmHero({ name, buy, cta }: { name: string; buy?: ReactNode; cta?: ReactNode }) {
  return (
    <section
      id="lp-hero"
      aria-labelledby="lp-title"
      className="on-dark relative isolate flex min-h-[min(100svh,900px)] items-end overflow-hidden bg-dark max-md:min-h-0 max-md:flex-col max-md:items-stretch"
    >
      <div className="absolute inset-0 -z-10 max-md:relative max-md:aspect-[4/3]">
        <Image
          src={somn}
          alt="Femeie în pat, seara, cu ochii închiși, purtând NEUROS Calm la gât"
          fill
          preload
          fetchPriority="high"
          quality={85}
          placeholder="blur"
          sizes="100vw"
          className="object-cover object-[64%_50%]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(90deg,rgb(8_17_19/.88)_0%,rgb(8_17_19/.5)_40%,transparent_70%)] max-md:bg-[linear-gradient(0deg,var(--color-dark),transparent_40%)]"
        />
      </div>
      <div className="lp-wrap w-full pt-28 pb-[clamp(56px,10vh,110px)] max-md:pt-2 max-md:pb-12">
        <p className="text-[13px] font-semibold tracking-[0.14em] text-cyan uppercase">{name} · pentru liniște</p>
        <h1 id="lp-title" className="mt-4 max-w-[10.5em] text-[clamp(42px,6vw,84px)] leading-[0.98] tracking-[-0.045em] !text-white">
          Câteva minute de liniște, doar pentru tine.
        </h1>
        <p className="mt-5 max-w-[30em] text-[clamp(17px,1.4vw,20px)] leading-snug text-white/85">
          Te ajută să lași stresul zilei în urmă. Susține calmul și un somn mai lin. Pornești și te relaxezi.
        </p>
        {buy}
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          {cta}
          <a href="#cum" className="tlink !text-white">
            Cum te ajută <Arrow />
          </a>
        </div>
      </div>
    </section>
  )
}

/** Why the neck: a light page inside the dark one, so the explanation reads calmly. */
export function CalmHow() {
  return (
    <section id="cum" aria-labelledby="cum-title" className="scroll-mt-10 bg-paper py-[var(--sec)]">
      <div className="lp-wrap grid items-center gap-y-10 md:grid-cols-12 md:gap-x-12">
        <div className="md:col-span-6">
          <Kicker>Cum te ajută</Kicker>
          <Title id="cum-title" className="mt-3">
            De ce la gât?
          </Title>
          <div className="mt-5 max-w-[30em] space-y-4 text-[17.5px] leading-relaxed text-[var(--lp-muted)]">
            <p>Te ajută în trecerea din alertă spre repaus. Prin gât trece nervul vag, un nerv lung care leagă creierul de inimă, plămâni și digestie.</p>
            <p>Nervul vag are un rol în felul în care corpul se liniștește.</p>
            <p>Pe partea stângă, 6 diode de 810 nm luminează zona nervului vag. Lumina infraroșie pătrunde mai adânc. Pe restul gâtului, lumină roșie de 660 nm. Este cel mai puternic dispozitiv de acest fel de pe piață.</p>
            <p>Lumina pulsează de 14 ori pe secundă, ritmul undelor cerebrale SMR, asociat cu o stare calmă. Metoda se numește fotobiomodulare.</p>
          </div>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] md:col-span-6">
          <Image
            src={nervVag}
            alt="Ilustrație: nervul vag pornește din creier și ajunge la inimă, plămâni și digestie"
            fill
            fetchPriority="low"
            placeholder="blur"
            sizes="(min-width: 768px) 520px, 100vw"
            className="object-cover"
          />
        </div>
      </div>
    </section>
  )
}

/** How you use it: the back of the device (its one button) beside the three steps. */
export function CalmUse() {
  return (
    <section aria-labelledby="folosire" className="lp-wrap pt-[var(--sec)]">
      <div className="grid items-center gap-y-10 md:grid-cols-12 md:gap-x-12">
        <div className="relative aspect-square overflow-hidden rounded-[32px] bg-[var(--lp-panel)] md:col-span-6">
          <Image src={spate} alt="NEUROS Calm văzut din spate, cu butonul de pornire" fill fetchPriority="low" sizes="(min-width: 768px) 520px, 100vw" className="object-contain p-[16%]" />
        </div>
        <div className="md:col-span-6">
          <Kicker>Cum îl folosești</Kicker>
          <Title id="folosire" className="mt-3">
            Trei pași. Apoi, liniște.
          </Title>
          <Steps
            className="mt-8 md:!grid-cols-1"
            items={[
              {
                title: 'Îl așezi la gât.',
                text: 'Stă confortabil. Tu doar te așezi.',
              },
              {
                title: 'Îl pornești.',
                text: 'Un singur buton, pe spate.',
              },
              {
                title: 'Te relaxezi.',
                text: 'Citești sau meditezi. La final, se oprește singur.',
              },
            ]}
          />
        </div>
      </div>
    </section>
  )
}

/** Where it fits: two real moments, full width. */
export function CalmMoments() {
  return (
    <section aria-labelledby="momente" className="lp-wrap pt-[var(--sec)]">
      <Kicker>Când îl folosești</Kicker>
      <Title id="momente" className="mt-3 max-w-[16em]">
        Seara pe canapea. Și în pauza de la birou.
      </Title>
      <div className="mt-10 grid gap-5 md:grid-cols-5">
        <figure className="md:col-span-3">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[24px]">
            <Image src={canapea} alt="Femeie relaxată pe canapea, purtând NEUROS Calm" fill fetchPriority="low" placeholder="blur" sizes="(min-width: 768px) 680px, 100vw" className="object-cover" />
          </div>
          <figcaption className="mt-3 text-[15.5px] text-[var(--lp-muted)]">Seara, câteva minute te ajută să te liniștești. Te ajută să treci mai ușor spre somn.</figcaption>
        </figure>
        <figure className="md:col-span-2 md:pt-24">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[24px]">
            <Image src={birou} alt="Femeie la birou, cu ochii închiși, lângă NEUROS Calm" fill fetchPriority="low" placeholder="blur" sizes="(min-width: 768px) 440px, 100vw" className="object-cover" />
          </div>
          <figcaption className="mt-3 text-[15.5px] text-[var(--lp-muted)]">La birou, o pauză scurtă te ajută să lași stresul jos, între două sarcini.</figcaption>
        </figure>
      </div>
    </section>
  )
}
