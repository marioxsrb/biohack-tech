import Image from 'next/image'
import Link from 'next/link'
import { OfferTrigger } from '@/components/offers/OfferTrigger'
import { Arrow } from '@/components/ui/icons'
import { PROMOTIONS } from '@/config/promotions'
import { getProduct } from '@/content/catalog'

/**
 * The two standing offers. Readable in one line each ("3 produse, 20% reducere" / "2+1 gratis"), then one
 * sentence, then one action. Rules and names come from config/promotions.ts; the cart computes them.
 * No countdowns, no struck-through prices, no stickers.
 */
export function Offers() {
  const bundle = PROMOTIONS.find((p) => p.kind === 'bundle_percent')!
  const amber = PROMOTIONS.find((p) => p.kind === 'buy_x_get_y')!
  const bundleProducts = bundle.products.map((id) => getProduct(id)!)
  const amberProduct = getProduct(amber.products[0])!
  const top = bundle.kind === 'bundle_percent' ? bundle.tiers[bundle.tiers.length - 1] : null
  const first = bundle.kind === 'bundle_percent' ? bundle.tiers[0] : null
  const percent = top?.percent ?? 0
  const minUnits = top?.minUnits ?? 0

  return (
    <section aria-labelledby="offers-title" className="wrap pt-[var(--sec)]">
      <h2 id="offers-title" className="text-[clamp(34px,4vw,54px)] leading-[1] tracking-[-0.045em]">
        Oferte
      </h2>
      <p className="mt-4 max-w-[34em] text-[18px] leading-relaxed text-text">Se aplică singure în coș. Le vezi separat în comandă și pe factură.</p>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <article aria-labelledby="offer-bundle" className="on-dark relative flex flex-col overflow-hidden rounded-[24px] bg-dark p-[clamp(24px,3.2vw,40px)] text-white">
          <p className="text-[13px] font-semibold tracking-[0.12em] text-cyan uppercase">NEUROS Calm · Focus · Flow</p>
          <h3 id="offer-bundle" className="mt-5 !text-white">
            <span className="block text-[22px] font-medium tracking-[-0.02em] text-white/80">{minUnits} produse</span>
            <span className="mt-1 block text-[clamp(56px,6vw,80px)] leading-[0.95] font-medium tracking-[-0.05em]">
              {percent}% <span className="text-[0.45em] tracking-[-0.02em] text-cyan">reducere</span>
            </span>
          </h3>
          <p className="mt-4 max-w-[26em] text-[16px] leading-relaxed text-white/80">
            Oricare trei: același produs sau combinate. Reducerea se aplică la toate trei.{first && first !== top && ` La ${first.minUnits} produse primești ${first.percent}%.`}
          </p>
          {/* The products are the way in: the image opens the 3-product picker, like the button. */}
          <OfferTrigger offer="bundle" placement="homepage" label="Alege 3 produse pentru 20% reducere" className="group mt-7 grid w-full cursor-pointer grid-cols-3 items-start gap-3 text-left">
            {bundleProducts.map((p) => (
              <span key={p.id} className="block">
                <span className="relative block aspect-square rounded-[16px] bg-mist transition-colors duration-200 group-hover:bg-paper">
                  <Image src={p.cutout.src} alt="" fill sizes="140px" className={`object-contain p-[14%] transition-transform duration-300 group-hover:scale-[1.03] ${p.cutout.bleed === 'bottom' ? 'object-bottom pb-0' : ''}`} />
                </span>
                <span className="mt-2 block text-center text-[14px] font-medium text-white/85 group-hover:text-white">{p.model}</span>
              </span>
            ))}
          </OfferTrigger>
          <OfferTrigger offer="bundle" placement="homepage" className="cta sm mt-7 self-start">
            Alege 3 produse <Arrow />
          </OfferTrigger>
        </article>

        <article aria-labelledby="offer-amber" className="relative flex flex-col overflow-hidden rounded-[24px] bg-paper p-[clamp(24px,3.2vw,40px)]">
          <p className="text-[13px] font-semibold tracking-[0.12em] text-cyan-700 uppercase">NEUROS Amber</p>
          <h3 id="offer-amber" className="mt-5">
            <span className="block text-[22px] font-medium tracking-[-0.02em] text-muted">La 3 perechi</span>
            <span className="mt-1 block text-[clamp(56px,6vw,80px)] leading-[0.95] font-medium tracking-[-0.05em] text-ink">
              2+1 <span className="ml-1 inline-flex rounded-full bg-[#f5b041] px-3 py-1 align-middle text-[0.3em] font-semibold tracking-normal text-ink">gratis</span>
            </span>
          </h3>
          <p className="mt-4 max-w-[24em] text-[16px] leading-relaxed text-text">Plătești două, a treia e gratuită. Poți combina ramele.</p>
          <OfferTrigger offer="amber" placement="homepage" label="Alege 3 perechi NEUROS Amber, plătești 2" className="group relative mt-auto block aspect-[16/7] w-full cursor-pointer rounded-[16px] bg-mist transition-colors duration-200 hover:bg-mist-2">
            <Image src={amberProduct.cutout.src} alt="" fill sizes="(min-width: 768px) 480px, 90vw" className="object-contain p-[6%] transition-transform duration-300 group-hover:scale-[1.03]" />
          </OfferTrigger>
          <OfferTrigger offer="amber" placement="homepage" className="cta sm mt-5 self-start">
            Alege 3 perechi <Arrow />
          </OfferTrigger>
        </article>
      </div>
      <p className="mt-4 text-[14px] text-muted">
        Ofertele se pot cumula. NEUROS Amber nu intră în calculul celor 3 produse.{' '}
        <Link href="/plati" className="underline underline-offset-4 hover:text-ink">
          Detalii
        </Link>
      </p>
    </section>
  )
}
