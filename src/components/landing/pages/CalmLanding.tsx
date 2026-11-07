import { getProduct } from '@/content/catalog'
import type { Landing } from '@/content/landings'
import { terms } from '@/config/site'
import { formatLei } from '@/lib/money'
import { CalmEvening } from '@/components/calm/CalmEvening'
import { HeroCta } from '../HeroCta'
import { LandingOffer } from '../LandingOffer'
import { FinalCta, Help, LandingFaq, LandingShell, Testimonials } from '../kit'
import { CalmHero, CalmHow, CalmMoments, CalmUse } from '../stories/calm'

const CTA = 'Comandă NEUROS Calm'
const HERO_CTA = 'Vreau serile mai liniștite'

/**
 * NEUROS Calm: the site's light pages, with one dark moment (the evening photograph in the hero). The story goes from the moment (evening, a few minutes for
 * yourself) to the object, why the neck, how it is used, where it fits, what arrives, and the purchase.
 * Copy stays within the product page (product-content.ts): no health outcome is promised.
 */
export function CalmLanding({ landing }: { landing: Landing }) {
  const p = getProduct(landing.productId)!
  return (
    <LandingShell landing={landing} heroTone="light" cta="Comandă">
      <CalmHero
        name={p.name}
        buy={
          <p className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-[30px] font-medium tracking-[-0.03em] text-white tabular-nums">{p.price !== null && formatLei(p.price)}</span>
            <span className="text-[14px] text-white/70">{terms.vat} · livrare gratuită</span>
          </p>
        }
        cta={<HeroCta slug={landing.slug} productId={p.id} label={HERO_CTA} className="whitespace-normal text-center" />}
      />
      <CalmEvening
        frame="landing"
        cta={<HeroCta slug={landing.slug} productId={p.id} label={HERO_CTA} className="whitespace-normal text-center max-md:w-full" />}
        note={<p className="text-[13.5px] leading-relaxed text-[var(--lp-muted)]">Plată la livrare. Garanție {terms.warrantyYears} ani.</p>}
      />
      <CalmHow />
      <CalmUse />
      <CalmMoments />

      <LandingOffer
        withQuantity
        slug={landing.slug}
        productId={p.id}
        cta={CTA}
        title="Liniștea, livrată acasă."
        text="Livrare gratuită, plată la livrare și 14 zile să vezi dacă ți se potrivește."
        details={[
          ['Tehnologie', '660 nm și 810 nm (6 diode pe stânga), pulsat la 14 Hz'],
          ['Ședința', 'Câteva minute, se oprește singur'],
        ]}
      />

      <Testimonials productId={p.id} />
      <LandingFaq items={landing.faqs} />
      <Help title="Vrei să vezi dacă ți se potrivește?" text="Spune-ne cum arată seara ta. Îți spunem sincer dacă NEUROS Calm te poate ajuta." />
      <FinalCta title="Începe cu câteva minute de calm, chiar în seara asta." cta={CTA} />
    </LandingShell>
  )
}
