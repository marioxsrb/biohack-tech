import Image from 'next/image'
import { Arrow } from '@/components/ui/icons'
import { getProduct } from '@/content/catalog'
import type { Landing } from '@/content/landings'
import { terms } from '@/config/site'
import { formatLei } from '@/lib/money'
import { HeroCta } from '../HeroCta'
import { LandingOffer } from '../LandingOffer'
import { FinalCta, Help, Kicker, LandingFaq, LandingShell, Lead, Specs, Steps, Testimonials, Title } from '../kit'

import somn from '@/assets/img/balance-wave/result-somn.webp'
import activ from '@/assets/img/balance-wave/dispozitiv-activ.webp'
import spate from '@/assets/img/balance-wave/dispozitiv.webp'
import nervVag from '@/assets/img/balance-wave/pillar-nerv-vag.webp'
import birou from '@/assets/img/balance-wave/audience-birou.webp'
import canapea from '@/assets/img/balance-wave/lifestyle-canapea.webp'
import cutie from '@/assets/img/balance-wave/cutie.webp'

const CTA = 'Comandă NEUROS Calm'

/**
 * NEUROS Calm: a warm, dark evening page. The story goes from the moment (evening, a few minutes for
 * yourself) to the object, why the neck, how it is used, where it fits, what arrives, and the purchase.
 * Copy stays within the product page (product-content.ts): no health outcome is promised.
 */
export function CalmLanding({ landing }: { landing: Landing }) {
  const p = getProduct(landing.productId)!
  return (
    <LandingShell landing={landing} heroTone="light" cta="Comandă">
      {/* Hero: the evening photograph, the message on the dark side. */}
      <section id="lp-hero" aria-labelledby="lp-title" className="relative isolate flex min-h-[min(100svh,900px)] items-end overflow-hidden max-md:min-h-0 max-md:flex-col max-md:items-stretch">
        <div className="absolute inset-0 -z-10 max-md:relative max-md:aspect-[4/3]">
          <Image src={somn} alt="Femeie în pat, seara, cu ochii închiși, purtând NEUROS Calm la gât" fill priority placeholder="blur" sizes="100vw" className="object-cover object-[64%_50%]" />
          <div aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,rgb(17_12_10/.9)_0%,rgb(17_12_10/.55)_40%,transparent_70%)] max-md:bg-[linear-gradient(0deg,#110c0a,transparent_40%)]" />
        </div>
        <div className="lp-wrap w-full pt-28 pb-[clamp(56px,10vh,110px)] max-md:pt-2 max-md:pb-12">
          <Kicker>{p.name} · pentru relaxare</Kicker>
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

      {/* What it is: the object, large, on a warm stage. */}
      <section aria-labelledby="ce-este" className="lp-wrap pt-[var(--sec)]">
        <div className="grid items-center gap-y-10 md:grid-cols-12 md:gap-x-12">
          <div className="relative aspect-square overflow-hidden rounded-[32px] bg-[radial-gradient(circle_at_50%_70%,#3a1d17,#1d1512_65%)] md:col-span-6">
            <span aria-hidden className="absolute inset-x-[15%] bottom-[10%] h-[40%] rounded-full bg-[radial-gradient(closest-side,rgb(255_90_70/.35),transparent)]" />
            <Image src={activ} alt="NEUROS Calm, dispozitivul cu luminile roșii aprinse" fill sizes="(min-width: 768px) 520px, 100vw" className="object-contain object-bottom px-[10%] pt-[10%]" />
          </div>
          <div className="md:col-span-6">
            <Kicker>Ce este</Kicker>
            <Title id="ce-este" className="mt-3">
              Un dispozitiv mic, purtat la gât.
            </Title>
            <Lead className="mt-4 max-w-[28em] text-[var(--lp-muted)]">
              Aplică lumină roșie pe piele, din ambele părți ale gâtului. Tu alegi cât durează ședința. Restul îl face singur.
            </Lead>
            <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-[var(--lp-line)] pt-6">
              {[
                ['5-20', 'minute pe ședință'],
                ['Trepte', 'de intensitate'],
                ['Auto', 'se oprește singur'],
              ].map(([big, small]) => (
                <div key={small}>
                  <dt className="text-[clamp(26px,3vw,38px)] leading-none font-medium tracking-[-0.04em] text-white">{big}</dt>
                  <dd className="mt-2 text-[14.5px] leading-snug text-[var(--lp-muted)]">{small}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* How it works: a light page inside the dark one, so the explanation reads calmly. */}
      <section id="cum" aria-labelledby="cum-title" className="mt-[var(--sec)] scroll-mt-10 bg-[#f7efe9] py-[var(--sec)] text-[#1d1512]">
        <div className="lp-wrap grid items-center gap-y-10 md:grid-cols-12 md:gap-x-12">
          <div className="md:col-span-6">
            <p className="text-[13px] font-semibold tracking-[0.14em] text-[#a3392b] uppercase">Cum funcționează</p>
            <h2 id="cum-title" className="mt-3 text-[clamp(32px,3.8vw,52px)] leading-[1.02] tracking-[-0.04em] !text-[#1d1512]">
              De ce la gât?
            </h2>
            <div className="mt-5 max-w-[30em] space-y-4 text-[17.5px] leading-relaxed text-[#4e3f38]">
              <p>Pe acolo trece nervul vag, cel mai lung nerv din corp. Leagă creierul de inimă, plămâni și digestie.</p>
              <p>Nervul vag are un rol în felul în care corpul trece din alertă în repaus.</p>
              <p>NEUROS Calm folosește fotobiomodulare: lumină roșie aplicată pe piele, din ambele părți ale gâtului.</p>
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] md:col-span-6">
            <Image src={nervVag} alt="Ilustrație: nervul vag pornește din creier și ajunge la inimă, plămâni și digestie" fill placeholder="blur" sizes="(min-width: 768px) 520px, 100vw" className="object-cover" />
          </div>
        </div>
      </section>

      {/* How you use it: three steps beside the button on the back of the device. */}
      <section aria-labelledby="folosire" className="lp-wrap pt-[var(--sec)]">
        <div className="grid gap-y-10 md:grid-cols-12 md:gap-x-12">
          <div className="md:col-span-4">
            <Kicker>Cum îl folosești</Kicker>
            <Title id="folosire" className="mt-3">
              Trei gesturi.
            </Title>
            <div className="relative mt-8 aspect-[4/3] rounded-[24px] bg-[var(--lp-panel)]">
              <Image src={spate} alt="NEUROS Calm văzut din spate, cu butonul de pornire" fill sizes="360px" className="object-contain p-[12%]" />
            </div>
          </div>
          <Steps
            className="text-white md:col-span-8 md:self-end"
            items={[
              { title: 'Îl așezi la gât.', text: 'Luminile stau pe ambele părți ale gâtului.' },
              { title: 'Alegi durata.', text: 'Între 5 și 20 de minute. Intensitatea se reglează pe trepte.' },
              { title: 'Te relaxezi.', text: 'Poți citi sau medita. Se oprește singur la final.' },
            ]}
          />
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

      {/* What arrives. */}
      <section aria-labelledby="primesti" className="lp-wrap pt-[var(--sec)]">
        <div className="grid items-start gap-y-10 md:grid-cols-12 md:gap-x-12">
          <div className="relative aspect-[8/7] rounded-[28px] bg-[#f7efe9] md:col-span-5">
            <Image src={cutie} alt="NEUROS Calm lângă cutia produsului" fill sizes="(min-width: 768px) 440px, 100vw" className="object-contain p-[10%]" />
          </div>
          <div className="md:col-span-7">
            <Kicker>Ce primești</Kicker>
            <Title id="primesti" className="mt-3">
              Dispozitivul și un om care te ajută să începi.
            </Title>
            <Specs
              className="mt-8"
              rows={[
                ['Tehnologie', 'Fotobiomodulare duală, lumină roșie'],
                ['Unde se aplică', 'La gât, în zona nervului vag'],
                ['Durată', '5-20 de minute, la alegere'],
                ['Intensitate', 'Reglabilă pe trepte'],
                ['Oprire', 'Automată'],
                ['Ghidaj', 'Un specialist îți recomandă durata și programul'],
                ['Garanție', `${terms.warrantyYears} ani`],
              ]}
            />
          </div>
        </div>
      </section>

      <LandingOffer
        slug={landing.slug}
        productId={p.id}
        cta={CTA}
        title="NEUROS Calm, livrat acasă."
        text="Plătești cu cardul sau prin transfer. Livrarea în România este gratuită."
      />

      <Testimonials productId={p.id} />
      <LandingFaq items={landing.faqs} />
      <Help title="Nu ești sigur că e pentru tine?" text="Spune-ne cum arată seara ta. Îți spunem sincer dacă NEUROS Calm are sens." />
      <FinalCta productId={p.id} dark line="Câteva minute de lumină roșie, la gât. Se oprește singur." cta={CTA} />
    </LandingShell>
  )
}
