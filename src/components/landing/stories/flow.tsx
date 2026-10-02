/**
 * NEUROS Flow, told in layers: the hero, the person at home, what photobiomodulation is, how it goes
 * with the specialist, the technical sheet. Used by the landing (with the configurations and prices)
 * and by the presentation page (information only).
 */
import Image from 'next/image'
import type { ReactNode } from 'react'
import { Arrow } from '@/components/ui/icons'
import { terms } from '@/config/site'
import { Kicker, Lead, Specs, Steps, Title } from '../parts'

import casca from '@/assets/img/brain-flow/casca.webp'
import femeie from '@/assets/img/brain-flow/lifestyle-femeie.webp'
import interior from '@/assets/img/brain-flow/casca-interior.webp'
import consultatie from '@/assets/img/brain-flow/consultatie.webp'
import telecomanda from '@/assets/img/brain-flow/casca-telecomanda.webp'

/** What each configuration is for: the same words on the landing's picker and on the presentation. */
export const flowZones: Record<string, { big: string; text: string }> = {
  '1-zona': {
    big: '1',
    text: 'O zonă activă. Pentru protocoale simple, cu o singură zonă țintă.',
  },
  '4-zone': {
    big: '4',
    text: 'Până la 4 zone. Pentru protocoale care combină mai multe zone.',
  },
  '13-zone': {
    big: '13',
    text: 'Până la 13 zone. Pentru acoperire extinsă, stabilită cu specialistul.',
  },
}

/** Hero: the helmet, centred, on a faint infrared glow. */
export function FlowHero({ name, buy, cta }: { name: string; buy?: ReactNode; cta?: ReactNode }) {
  return (
    <section id="lp-hero" aria-labelledby="lp-title" className="relative overflow-hidden pt-28 pb-[calc(var(--sec)*0.8)] text-center max-sm:pt-24">
      <div className="lp-wrap">
        <Kicker>{name} · lumină infraroșie acasă</Kicker>
        <h1 id="lp-title" className="mx-auto mt-4 max-w-[13em] text-[clamp(40px,5.4vw,78px)] leading-[0.98] tracking-[-0.045em]">
          Lumină infraroșie, în rutina de acasă.
        </h1>
        <p className="mx-auto mt-5 max-w-[34em] text-[clamp(17px,1.3vw,19px)] leading-snug text-[var(--lp-muted)]">
          Ședințele cu lumină infraroșie au loc acasă, la ora ta. Casca are LED-uri la 810 nm, pe 1, 4 sau 13 zone. Protocolul îl stabilești cu un specialist.
        </p>
        <div className="relative mx-auto mt-6 aspect-[3/2] w-[min(640px,100%)]">
          <span aria-hidden className="absolute inset-[12%] rounded-full bg-[radial-gradient(closest-side,rgb(214_52_60/.22),transparent)]" />
          <Image src={casca} alt="NEUROS Flow, casca albă cu LED-urile aprinse" fill loading="eager" fetchPriority="high" sizes="(min-width: 768px) 640px, 100vw" className="object-contain" />
        </div>
        {buy}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          {cta}
          <a href="#ce-este" className="tlink">
            Ce este fotobiomodularea <Arrow />
          </a>
        </div>
      </div>
    </section>
  )
}

/** The person, at home. */
export function FlowHome() {
  return (
    <section aria-labelledby="acasa" className="relative mt-[var(--sec)]">
      <div className="relative aspect-[21/9] max-md:aspect-[4/3]">
        <Image src={femeie} alt="Femeie relaxată pe canapea, purtând casca NEUROS Flow" fill placeholder="blur" sizes="100vw" className="object-cover object-[75%_40%]" />
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,rgb(242_245_246/.94),rgb(242_245_246/.6)_38%,transparent_60%)] max-md:hidden" />
      </div>
      <div className="lp-wrap md:absolute md:inset-0 md:flex md:items-center">
        <div className="max-w-[24em] max-md:pt-8">
          <Kicker>Acasă</Kicker>
          <h2 id="acasa" className="mt-3 text-[clamp(30px,3.4vw,46px)] leading-[1.02] tracking-[-0.04em]">
            Acasă, la ora aleasă de tine.
          </h2>
          <Lead className="mt-3 text-[var(--lp-muted)]">Te așezi în fotoliu sau pe canapea. Casca are baterie reîncărcabilă, iar ședințele intră în rutina zilei.</Lead>
        </div>
      </div>
    </section>
  )
}

/** Layer 2: what photobiomodulation is, simply. */
export function FlowExplain() {
  return (
    <section id="ce-este" aria-labelledby="ce-este-title" className="lp-wrap scroll-mt-10 pt-[var(--sec)]">
      <div className="grid items-center gap-y-10 lg:grid-cols-12 lg:gap-x-12">
        <div className="lg:col-span-6">
          <Kicker>Cum funcționează</Kicker>
          <Title id="ce-este-title" className="mt-3">
            Ce este fotobiomodularea?
          </Title>
          <div className="mt-5 max-w-[30em] space-y-4 text-[17.5px] leading-relaxed text-[var(--lp-muted)]">
            <p>Fotobiomodularea înseamnă lumină roșie sau infraroșie aplicată din exterior.</p>
            <p>În NEUROS Flow, LED-urile din interiorul căștii aplică lumină infraroșie prin scalp, pe zonele alese în protocol.</p>
          </div>
        </div>
        <div className="relative aspect-[3/2] rounded-[28px] bg-[var(--lp-panel)] lg:col-span-6">
          <Image src={interior} alt="Interiorul căștii NEUROS Flow, cu LED-urile, lângă telecomandă" fill sizes="(min-width: 1152px) 560px, 100vw" className="object-contain p-[8%]" />
        </div>
      </div>
    </section>
  )
}

/** How it goes: consultation first. */
export function FlowSpecialist() {
  return (
    <section aria-labelledby="decurge" className="mt-[var(--sec)] bg-dark py-[var(--sec)] text-white">
      <div className="lp-wrap">
        <div className="grid items-end gap-y-8 lg:grid-cols-12 lg:gap-x-12">
          <div className="on-dark lg:col-span-6">
            <p className="text-[13px] font-semibold tracking-[0.14em] text-[#ff8a8f] uppercase">Cum decurge</p>
            <h2 id="decurge" className="mt-3 text-[clamp(32px,3.6vw,48px)] leading-[1.02] tracking-[-0.04em] !text-white">
              Începi cu un specialist.
            </h2>
            <p className="mt-4 max-w-[28em] text-[17px] leading-relaxed text-white/80">
              La consultația de început, un specialist Biohack Tech stabilește cu tine zonele, durata și frecvența ședințelor.
            </p>
          </div>
          <div className="relative aspect-[16/10] overflow-hidden rounded-[24px] lg:col-span-6">
            <Image
              src={consultatie}
              alt="Consultație Biohack Tech: specialistul arată protocolul pe tabletă"
              fill
              placeholder="blur"
              sizes="(min-width: 1152px) 560px, 100vw"
              className="object-cover"
            />
          </div>
        </div>
        <Steps
          className="mt-14 text-white"
          items={[
            {
              title: 'Consultație și protocol.',
              text: 'Zonele, frecvența și durata ședințelor.',
            },
            {
              title: 'Pui casca și confirmi zonele.',
              text: 'Pe telecomandă vezi zonele active și durata.',
            },
            {
              title: 'Ședința rulează singură.',
              text: 'Casca se oprește la final. Revizuiți protocolul împreună, periodic.',
            },
          ]}
        />
      </div>
    </section>
  )
}

/** Layer 3: the technical sheet, last. */
export function FlowSpecs() {
  return (
    <section aria-labelledby="detalii" className="lp-wrap pb-[var(--sec)]">
      <div className="grid items-start gap-y-10 lg:grid-cols-12 lg:gap-x-12">
        <div className="lg:col-span-5">
          <Kicker>Detalii tehnice</Kicker>
          <Title id="detalii" className="mt-3">
            Pe scurt, în cifre.
          </Title>
          <div className="relative mt-8 aspect-[3/2] rounded-[24px] bg-[var(--lp-panel)]">
            <Image src={telecomanda} alt="NEUROS Flow lângă telecomanda inclusă" fill sizes="440px" className="object-contain p-[8%]" />
          </div>
        </div>
        <Specs
          className="lg:col-span-7"
          rows={[
            ['Tehnologie', 'Fotobiomodulare transcraniană (t-PBM)'],
            ['Lungime de undă', '810 nm, infraroșu apropiat'],
            ['Configurații', '1, 4 sau 13 zone selectabile'],
            ['Parametri reglabili', 'Zone active, frecvență, durata ședinței'],
            ['Control', 'Telecomandă inclusă'],
            ['Alimentare', 'Baterie reîncărcabilă'],
            ['Ghidaj', 'Consultație inițială pentru configurarea protocolului'],
            ['Garanție', `${terms.warrantyYears} ani`],
          ]}
        />
      </div>
    </section>
  )
}
