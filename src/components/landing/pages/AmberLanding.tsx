import { mentionsOffer } from '@/lib/lead'
import { getProduct } from '@/content/catalog'
import type { Landing } from '@/content/landings'
import { terms } from '@/config/site'
import { formatLei } from '@/lib/money'
import { AmberSelector } from '../AmberSelector'
import { AmberShowcase } from '../AmberShowcase'
import { GatedHeroPrice } from '@/components/gate/Gate'
import { HeroCta } from '../HeroCta'
import { AmberHero, AmberWhy } from '../stories/amber'
import { FinalCta, Help, LandingFaq, LandingShell, Testimonials } from '../kit'

const CTA = 'Alege perechile'

/**
 * NEUROS Amber: the glasses first as an object worth wearing (the hero, then the product films on the
 * landing's one dark stage), the four frames to choose from (mix and match, 2+1 built in), what the lens
 * does and when to wear them, reviews, questions. One warm palette, set in globals.css under
 * [data-landing='amber']: ivory surfaces, warm black for text and buttons, amber as the only accent.
 */
export function AmberLanding({ landing, gated = false }: { landing: Landing; gated?: boolean }) {
  const p = getProduct(landing.productId)!
  return (
    <LandingShell landing={landing} heroTone="dark" cta={CTA}>
      <AmberHero
        name={p.name}
        buy={
          gated ? (
            <GatedHeroPrice productId={p.id} />
          ) : (
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
          )
        }
        cta={<HeroCta slug={landing.slug} productId={p.id} label={CTA} />}
      />

      <AmberShowcase productId={p.id} />
      <AmberSelector slug={landing.slug} productId={p.id} />
      <AmberWhy />

      <Testimonials productId={p.id} />
      <LandingFaq items={gated ? landing.faqs.filter((f) => !mentionsOffer(`${f.q} ${f.a}`)) : landing.faqs} />
      <Help title="Te ajutăm să alegi rama." text="Scrie-ne ce formă porți de obicei. Îți recomandăm rama potrivită." />
      <FinalCta title={gated ? 'Patru rame, aceeași lentilă chihlimbar.' : 'Trei perechi, una gratuită.'} cta={CTA} />
    </LandingShell>
  )
}
