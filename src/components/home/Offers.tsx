import Image from 'next/image'
import Link from 'next/link'
import { Arrow } from '@/components/ui/icons'
import { PROMOTIONS } from '@/config/promotions'
import { getProduct, productHref } from '@/content/catalog'

/**
 * The two standing offers, stated once and plainly. Rules and names come from config/promotions.ts;
 * the cart computes them. No countdowns, no struck-through prices.
 */
export function Offers() {
  const [bundle, amber] = [PROMOTIONS.find((p) => p.kind === 'bundle_percent')!, PROMOTIONS.find((p) => p.kind === 'buy_x_get_y')!]
  const bundleProducts = bundle.products.map((id) => getProduct(id)!)
  const amberProduct = getProduct(amber.products[0])!
  return (
    <section aria-labelledby="offers-title" className="wrap pt-[var(--sec)]">
      <div className="grid gap-y-4 md:grid-cols-12 md:gap-x-6">
        <h2 id="offers-title" className="text-[clamp(34px,4.4vw,60px)] leading-[1] tracking-[-0.045em] md:col-span-6">
          Două oferte, spuse simplu.
        </h2>
        <p className="max-w-[30em] self-end text-[18px] leading-relaxed text-text md:col-span-5 md:col-start-8">Se aplică singure în coș. Le vezi separat în comandă și pe factură.</p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2 max-sm:mt-10">
        <article className="flex flex-col rounded-[28px] bg-paper p-[clamp(24px,3.4vw,40px)]">
          <p className="text-[clamp(56px,6vw,84px)] leading-none font-medium tracking-[-0.05em] text-ink">
            20<span className="text-cyan-700">%</span>
          </p>
          <h3 className="mt-3 text-[22px] tracking-[-0.02em]">{bundle.badge}</h3>
          <p className="mt-2 max-w-[28em] text-[16.5px] leading-relaxed text-text">{bundle.line} Poți lua și de trei ori același produs.</p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {bundleProducts.map((p) => (
              <li key={p.id}>
                <Link href={productHref(p)} className="flex min-h-11 items-center gap-2 rounded-full bg-mist py-1.5 pr-4 pl-1.5 text-[15px] font-medium text-ink hover:bg-mist-2">
                  <span className="relative h-8 w-8 overflow-hidden rounded-full bg-paper">
                    <Image src={p.cutout.src} alt="" fill sizes="32px" className="object-contain p-1" />
                  </span>
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
        </article>

        <article className="flex flex-col rounded-[28px] bg-[#fbf3e4] p-[clamp(24px,3.4vw,40px)]">
          <p className="text-[clamp(56px,6vw,84px)] leading-none font-medium tracking-[-0.05em] text-ink">
            2<span className="text-[#9a5b06]">+</span>1
          </p>
          <h3 className="mt-3 text-[22px] tracking-[-0.02em]">{amber.label}</h3>
          <p className="mt-2 max-w-[28em] text-[16.5px] leading-relaxed text-[#4b3b27]">{amber.line}</p>
          <Link href={productHref(amberProduct)} className="tlink mt-auto pt-6">
            Alege ramele <Arrow />
          </Link>
        </article>
      </div>
    </section>
  )
}
