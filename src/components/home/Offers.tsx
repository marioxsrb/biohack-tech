import Image from 'next/image'
import Link from 'next/link'
import { Arrow } from '@/components/ui/icons'
import { PROMOTIONS } from '@/config/promotions'
import { getProduct, productHref } from '@/content/catalog'

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
  const percent = bundle.kind === 'bundle_percent' ? bundle.percent : 0
  const minUnits = bundle.kind === 'bundle_percent' ? bundle.minUnits : 0

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
          <p className="mt-4 max-w-[26em] text-[16px] leading-relaxed text-white/80">Oricare trei: același produs sau combinate. Reducerea se aplică la toate trei.</p>
          <ul aria-label="Produse eligibile" className="mt-7 grid grid-cols-3 items-start gap-3">
            {bundleProducts.map((p) => (
              <li key={p.id}>
                <Link href={productHref(p)} className="group block">
                  <span className="relative block aspect-square rounded-[16px] bg-white/[0.06] shadow-[inset_0_0_0_1px_rgb(255_255_255/.08)] transition-colors group-hover:bg-white/[0.1]">
                    <Image src={p.cutout.src} alt={p.name} fill sizes="140px" className={`object-contain p-[14%] ${p.cutout.bleed === 'bottom' ? 'object-bottom pb-0' : ''}`} />
                  </span>
                  <span className="mt-2 block text-center text-[14px] font-medium text-white/85 group-hover:text-white">{p.model}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="#produse" className="cta sm mt-7 self-start">
            Alege produsele <Arrow />
          </Link>
        </article>

        <article aria-labelledby="offer-amber" className="relative flex flex-col overflow-hidden rounded-[24px] bg-[#f5ecdd] p-[clamp(24px,3.2vw,40px)]">
          <p className="text-[13px] font-semibold tracking-[0.12em] text-[#8a5206] uppercase">NEUROS Amber</p>
          <h3 id="offer-amber" className="mt-5">
            <span className="block text-[22px] font-medium tracking-[-0.02em] text-[#5b4630]">La 3 perechi</span>
            <span className="mt-1 block text-[clamp(56px,6vw,80px)] leading-[0.95] font-medium tracking-[-0.05em] text-ink">
              2+1 <span className="text-[0.45em] tracking-[-0.02em] text-[#8a5206]">gratis</span>
            </span>
          </h3>
          <p className="mt-4 max-w-[24em] text-[16px] leading-relaxed text-[#4b3b27]">Plătești două, a treia e gratuită. Poți combina ramele.</p>
          <div className="relative mt-auto aspect-[16/7] w-full">
            <Image src={amberProduct.cutout.src} alt="" fill sizes="(min-width: 768px) 480px, 90vw" className="object-contain" />
          </div>
          <Link href={`${productHref(amberProduct)}#cumpara`} className="cta sm mt-4 self-start">
            Alege ramele <Arrow />
          </Link>
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
