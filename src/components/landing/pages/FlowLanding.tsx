import { PromoNote } from '@/components/cart/PromoNote'
import { getProduct } from '@/content/catalog'
import type { Landing } from '@/content/landings'
import { formatLei } from '@/lib/money'
import { HeroCta } from '../HeroCta'
import { LandingOffer } from '../LandingOffer'
import { FlowExplain, FlowHero, FlowHome, FlowSpecialist, FlowSpecs, flowZones } from '../stories/flow'
import { FinalCta, Help, LandingFaq, LandingShell, Testimonials } from '../kit'

const CTA = 'Alege configurația'

/**
 * NEUROS Flow: the page that teaches most, so it teaches in layers, each said once. The hero says what it
 * is (810 nm, 1/4/13 zones, a specialist); then the person at home, what photobiomodulation is in simple
 * words, how it goes with the specialist, the configurations, and only at the end the technical sheet. Only facts from the product page
 * (810 nm, 1/4/13 zones, adjustable protocol, remote, battery, consultation); no health claims, and the
 * source's study list is not used.
 */
export function FlowLanding({ landing }: { landing: Landing }) {
  const p = getProduct(landing.productId)!
  return (
    <LandingShell landing={landing} heroTone="dark" cta="Alege">
      <FlowHero
        name={p.name}
        buy={
          <p className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <span className="text-[30px] font-medium tracking-[-0.03em] tabular-nums">de la {p.price !== null && formatLei(p.price)}</span>
            <PromoNote productId={p.id} />
          </p>
        }
        cta={<HeroCta slug={landing.slug} productId={p.id} label={CTA} />}
      />

      <FlowHome />

      <FlowExplain />

      <FlowSpecialist />

      <LandingOffer
        slug={landing.slug}
        productId={p.id}
        layout="columns"
        defaultVariant="4-zone"
        cta="Comandă NEUROS Flow"
        title="Alege configurația."
        text="Casca și tehnologia sunt aceleași. Se schimbă numărul de zone pe care le poți activa în același protocol. Te ajutăm să alegi."
        notes={flowZones}
      />

      <FlowSpecs />

      <Testimonials productId={p.id} />
      <LandingFaq items={landing.faqs} />
      <Help title="Vorbește cu un specialist înainte să alegi." text="Spune-ne ce vrei să urmărești. Îți explicăm configurațiile și cum decurge consultația de început." />
      <FinalCta title="Începi cu o consultație." cta={CTA} />
    </LandingShell>
  )
}
