import { getProduct } from '@/content/catalog'
import type { Landing } from '@/content/landings'
import { terms } from '@/config/site'
import { formatLei } from '@/lib/money'
import { AmberSelector } from '../AmberSelector'
import { HeroCta } from '../HeroCta'
import { AmberHero, AmberHow, AmberWhen } from '../stories/amber'
import { FinalCta, Help, LandingFaq, LandingShell, Testimonials } from '../kit'

const CTA = 'Alege perechile'

/**
 * NEUROS Amber, the simplest landing: what the lens does, then the frames to choose from (mix and match,
 * 2+1 built in), when to wear them, questions. The site's neutral surfaces, type and red button; the
 * warmth comes from the lens photographs and a little amber light, never from brown surfaces. The glasses first as an object worth wearing, then the four
 * frames, what the lens does, when to wear them, the 2+1 offer as a clear calculation, and the purchase.
 */
export function AmberLanding({ landing }: { landing: Landing }) {
  const p = getProduct(landing.productId)!
  return (
    <LandingShell landing={landing} heroTone="dark" cta={CTA}>
      <AmberHero
        name={p.name}
        buy={
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
        }
        cta={<HeroCta slug={landing.slug} productId={p.id} label={CTA} />}
      />

      <AmberHow />

      <AmberSelector slug={landing.slug} productId={p.id} />

      <AmberWhen />

      <Testimonials productId={p.id} />
      <LandingFaq items={landing.faqs} />
      <Help title="Te ajutăm să alegi rama." text="Scrie-ne ce formă porți de obicei. Îți recomandăm rama potrivită." />
      <FinalCta title="Trei perechi, una gratuită." cta={CTA} />
    </LandingShell>
  )
}
