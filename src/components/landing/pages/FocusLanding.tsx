import { mentionsOffer } from '@/lib/lead'
import { getProduct } from '@/content/catalog'
import type { Landing } from '@/content/landings'
import { terms } from '@/config/site'
import { formatLei } from '@/lib/money'
import { GatedHeroPrice } from '@/components/gate/Gate'
import { HeroCta } from '../HeroCta'
import { LandingOffer } from '../LandingOffer'
import { FocusHero, FocusHow, FocusVideo, FocusWhere } from '../stories/focus'
import { FinalCta, Help, LandingFaq, LandingShell, Testimonials } from '../kit'

const CTA = 'Comandă NEUROS Focus'

/**
 * NEUROS Focus: a precise, bright page. From the idea (attention you can train, as a game) to what the
 * headset reads, how the app turns it into play, where it is used, the facts, and the purchase.
 */
export function FocusLanding({ landing, gated = false }: { landing: Landing; gated?: boolean }) {
  const p = getProduct(landing.productId)!
  return (
    <LandingShell landing={landing} heroTone="dark" cta="Comandă">
      <FocusHero
        name={p.name}
        buy={
          gated ? (
            <GatedHeroPrice productId={p.id} />
          ) : (
            <p className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="text-[30px] font-medium tracking-[-0.03em] tabular-nums">{p.price !== null && formatLei(p.price)}</span>
              <span className="text-[14px] text-[var(--lp-muted)]">{terms.vat} · livrare gratuită</span>
            </p>
          )
        }
        cta={<HeroCta slug={landing.slug} productId={p.id} label={CTA} />}
      />

      <FocusVideo />

      <FocusHow />

      <FocusWhere />

      <LandingOffer
        withQuantity
        slug={landing.slug}
        productId={p.id}
        cta={CTA}
        title="NEUROS Focus, gata de joc."
        text="Casca ajunge la tine acasă. Aplicația Neuros Game o instalezi pe tableta ta."
        details={[
          ['Senzori', '3 senzori EEG'],
          ['Aplicație', 'Neuros Game: peste 10 jocuri și meditații ghidate'],
          ['Ai nevoie de', 'O tabletă, conectată prin Bluetooth'],
          ['Baterie', 'Până la 4 ore, după o oră de încărcare'],
          ['Certificări', 'CE, FCC'],
          ['Model hardware', 'BrainLink Pro'],
          ['Ghidaj', 'Un specialist îți recomandă jocurile și programul'],
        ]}
      />
      <Testimonials productId={p.id} />
      <LandingFaq items={gated ? landing.faqs.filter((f) => !mentionsOffer(`${f.q} ${f.a}`)) : landing.faqs} />
      <Help title="Vrei să afli dacă ți se potrivește?" text="Spune-ne pentru ce o folosești: muncă, studiu sau relaxare. Îți spunem cum să începi." />
      <FinalCta title="Pui casca. Deschizi primul joc." cta={CTA} />
    </LandingShell>
  )
}
