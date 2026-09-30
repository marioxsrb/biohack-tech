import Image from 'next/image'
import { Arrow } from '@/components/ui/icons'
import { getProduct } from '@/content/catalog'
import type { Landing } from '@/content/landings'
import { terms } from '@/config/site'
import { formatLei } from '@/lib/money'
import { HeroCta } from '../HeroCta'
import { LandingOffer } from '../LandingOffer'
import { FinalCta, Help, Kicker, LandingFaq, LandingShell, Steps, Testimonials, Title } from '../kit'

import somn from '@/assets/img/balance-wave/result-somn.webp'
import spate from '@/assets/img/balance-wave/dispozitiv.webp'
import nervVag from '@/assets/img/balance-wave/pillar-nerv-vag.webp'
import birou from '@/assets/img/balance-wave/audience-birou.webp'
import canapea from '@/assets/img/balance-wave/lifestyle-canapea.webp'

const CTA = 'Comandă NEUROS Calm'

/**
 * NEUROS Calm: the site's light pages, with one dark moment (the evening photograph in the hero). The story goes from the moment (evening, a few minutes for
 * yourself) to the object, why the neck, how it is used, where it fits, what arrives, and the purchase.
 * Copy stays within the product page (product-content.ts): no health outcome is promised.
 */
export function CalmLanding({ landing }: { landing: Landing }) {
  const p = getProduct(landing.productId)!
  return (
    <LandingShell landing={landing} heroTone="light" cta="Comandă">
      {/* Hero: the evening photograph, the message on the dark side. */}
      <section id="lp-hero" aria-labelledby="lp-title" className="on-dark relative isolate flex min-h-[min(100svh,900px)] items-end overflow-hidden bg-dark max-md:min-h-0 max-md:flex-col max-md:items-stretch">
        <div className="absolute inset-0 -z-10 max-md:relative max-md:aspect-[4/3]">
          <Image src={somn} alt="Femeie în pat, seara, cu ochii închiși, purtând NEUROS Calm la gât" fill preload placeholder="blur" sizes="100vw" className="object-cover object-[64%_50%]" />
          <div aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,rgb(8_17_19/.88)_0%,rgb(8_17_19/.5)_40%,transparent_70%)] max-md:bg-[linear-gradient(0deg,var(--color-dark),transparent_40%)]" />
        </div>
        <div className="lp-wrap w-full pt-28 pb-[clamp(56px,10vh,110px)] max-md:pt-2 max-md:pb-12">
          <p className="text-[13px] font-semibold tracking-[0.14em] text-cyan uppercase">{p.name} · pentru relaxare</p>
          <h1 id="lp-title" className="mt-4 max-w-[10.5em] text-[clamp(42px,6vw,84px)] leading-[0.98] tracking-[-0.045em] !text-white">
            Câteva minute doar pentru tine, seara.
          </h1>
          <p className="mt-5 max-w-[30em] text-[clamp(17px,1.4vw,20px)] leading-snug text-white/85">
            Un dispozitiv mic, purtat la gât. Pornești lumina roșie, alegi durata, te relaxezi. Se oprește singur.
          </p>
          <p className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-[30px] font-medium tracking-[-0.03em] text-white tabular-nums">{p.price !== null && formatLei(p.price)}</span>
            <span className="text-[14px] text-white/70">{terms.vat} · livrare gratuită</span>
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            <HeroCta slug={landing.slug} productId={p.id} label={CTA} />
            <a href="#cum" className="tlink !text-white">
              Cum funcționează <Arrow />
            </a>
          </div>
        </div>
      </section>

      {/* How it works: a light page inside the dark one, so the explanation reads calmly. */}
      <section id="cum" aria-labelledby="cum-title" className="scroll-mt-10 bg-paper py-[var(--sec)]">
        <div className="lp-wrap grid items-center gap-y-10 md:grid-cols-12 md:gap-x-12">
          <div className="md:col-span-6">
            <Kicker>Cum funcționează</Kicker>
            <Title id="cum-title" className="mt-3">
              De ce la gât?
            </Title>
            <div className="mt-5 max-w-[30em] space-y-4 text-[17.5px] leading-relaxed text-[var(--lp-muted)]">
              <p>Pe acolo trece nervul vag, cel mai lung nerv din corp. Leagă creierul de inimă, plămâni și digestie.</p>
              <p>Nervul vag are un rol în felul în care corpul trece din alertă în repaus.</p>
              <p>Acolo aplică NEUROS Calm lumina roșie. Metoda se numește fotobiomodulare.</p>
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] md:col-span-6">
            <Image src={nervVag} alt="Ilustrație: nervul vag pornește din creier și ajunge la inimă, plămâni și digestie" fill placeholder="blur" sizes="(min-width: 768px) 520px, 100vw" className="object-cover" />
          </div>
        </div>
      </section>

      {/* How you use it: the back of the device (its one button) beside the three gestures. */}
      <section aria-labelledby="folosire" className="lp-wrap pt-[var(--sec)]">
        <div className="grid items-center gap-y-10 md:grid-cols-12 md:gap-x-12">
          <div className="relative aspect-square overflow-hidden rounded-[32px] bg-[var(--lp-panel)] md:col-span-6">
            <Image src={spate} alt="NEUROS Calm văzut din spate, cu butonul de pornire" fill sizes="(min-width: 768px) 520px, 100vw" className="object-contain p-[16%]" />
          </div>
          <div className="md:col-span-6">
            <Kicker>Cum îl folosești</Kicker>
            <Title id="folosire" className="mt-3">
              Trei gesturi.
            </Title>
            <Steps
              className="mt-8 md:!grid-cols-1"
              items={[
                { title: 'Îl așezi la gât.', text: 'Luminile stau pe ambele părți ale gâtului.' },
                { title: 'Alegi durata.', text: 'Între 5 și 20 de minute. Intensitatea se reglează pe trepte.' },
                { title: 'Te relaxezi.', text: 'Poți citi sau medita. Se oprește singur la final.' },
              ]}
            />
          </div>
        </div>
      </section>

      {/* Where it fits: two real moments, full width. */}
      <section aria-labelledby="momente" className="lp-wrap pt-[var(--sec)]">
        <Kicker>Unde își are locul</Kicker>
        <Title id="momente" className="mt-3 max-w-[16em]">
          Seara, pe canapea. Sau în pauza de la birou.
        </Title>
        <div className="mt-10 grid gap-5 md:grid-cols-5">
          <figure className="md:col-span-3">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[24px]">
              <Image src={canapea} alt="Femeie relaxată pe canapea, purtând NEUROS Calm" fill placeholder="blur" sizes="(min-width: 768px) 680px, 100vw" className="object-cover" />
            </div>
            <figcaption className="mt-3 text-[15.5px] text-[var(--lp-muted)]">O ședință scurtă seara, înainte de somn.</figcaption>
          </figure>
          <figure className="md:col-span-2 md:pt-24">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[24px]">
              <Image src={birou} alt="Femeie la birou, cu ochii închiși, lângă NEUROS Calm" fill placeholder="blur" sizes="(min-width: 768px) 440px, 100vw" className="object-cover" />
            </div>
            <figcaption className="mt-3 text-[15.5px] text-[var(--lp-muted)]">Câteva minute între două sarcini.</figcaption>
          </figure>
        </div>
      </section>

      <LandingOffer
        slug={landing.slug}
        productId={p.id}
        cta={CTA}
        title="NEUROS Calm, livrat acasă."
        text="Dispozitivul și un om care te ajută să începi."
        details={[
          ['Tehnologie', 'Fotobiomodulare duală, lumină roșie'],
          ['Ghidaj', 'Un specialist îți recomandă durata și programul'],
        ]}
      />

      <Testimonials productId={p.id} />
      <LandingFaq items={landing.faqs} />
      <Help title="Nu ești sigur că e pentru tine?" text="Spune-ne cum arată seara ta. Îți spunem sincer dacă NEUROS Calm ți se potrivește." />
      <FinalCta title="Câteva minute pentru tine, în seara asta." cta={CTA} />
    </LandingShell>
  )
}
