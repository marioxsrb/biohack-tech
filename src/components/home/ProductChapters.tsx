import Image from 'next/image'
import Link from 'next/link'
import { AddToCartButton } from '@/components/cart/AddToCartButton'
import { ProductShot } from '@/components/product/ProductShot'
import { Idx } from '@/components/ui/Idx'
import { Arrow } from '@/components/ui/icons'
import { productHref, products } from '@/content/catalog'
import { productContent } from '@/content/product-content'
import { formatMoney } from '@/lib/money'

/** One editorial row per product: photo in use, the product itself, and the facts that tell them apart. */
export function ProductChapters() {
  return (
    <section id="produse" className="sec scroll-mt-4">
      <div className="wrap">
        <header className="grid items-end gap-y-4 md:grid-cols-12 md:gap-x-6">
          <div className="md:col-span-7">
            <Idx n="01">Produse</Idx>
            <h2 className="h2 rev">Trei produse, fiecare cu rolul lui.</h2>
          </div>
          <p className="sub rev md:col-span-5 md:col-start-8 lg:col-span-4 lg:col-start-9">
            Balance Wave lucrează cu corpul, BrainLink Pro cu mintea, iar Ochelarii Biohack cu lumina ecranelor.
          </p>
        </header>

        <div className="mt-16 space-y-24 max-md:mt-10 max-md:space-y-16">
          {products.map((p, i) => {
            const c = productContent[p.id]
            const flip = i % 2 === 1
            return (
              <article key={p.id} className="grid items-center gap-y-8 md:grid-cols-12 md:gap-x-6" aria-labelledby={`ch-${p.id}`}>
                <figure className={`rev relative md:col-span-7 ${flip ? 'md:order-2 md:col-start-6' : ''}`}>
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[24px] max-sm:-mx-[var(--gut)] max-sm:rounded-none">
                    <Image
                      src={p.lifestyle.src}
                      alt={p.lifestyle.alt}
                      fill
                      sizes="(min-width: 1152px) 660px, (min-width: 768px) 58vw, 100vw"
                      placeholder="blur"
                      className="object-cover"
                    />
                  </div>
                  {/* The product itself, set against the photo so buyers see exactly what arrives. */}
                  <div
                    className={`absolute bottom-5 h-[108px] w-[144px] overflow-hidden rounded-[14px] shadow-[0_18px_36px_-22px_rgba(8,17,19,.5)] ring-4 ring-paper max-sm:bottom-4 max-sm:h-[84px] max-sm:w-[112px] ${
                      flip ? 'right-5 max-sm:right-4' : 'left-5 max-sm:left-4'
                    }`}
                  >
                    <ProductShot image={p.cutout} sizes="144px" inset="sm" />
                  </div>
                </figure>

                <div className={`rev md:col-span-5 ${flip ? 'md:order-1 md:col-span-4 md:col-start-1' : 'md:col-start-8 lg:col-span-4 lg:col-start-9'}`}>
                  <p className="mono !text-cyan-700">
                    0{i + 1} · {p.category}
                  </p>
                  <h3 id={`ch-${p.id}`} className="mt-3 text-[30px] leading-[1.05] tracking-[-0.035em] max-sm:text-[26px]">
                    {p.name}
                  </h3>
                  <p className="mt-3 text-[16.5px] text-muted">{p.summary}</p>

                  <dl className="mt-6 border-t border-mist-2">
                    {c.facts.map((f) => (
                      <div key={f.label} className="grid grid-cols-[112px_1fr] gap-4 border-b border-mist-2 py-2.5 text-[15px]">
                        <dt className="mono self-center !text-[11px]">{f.label}</dt>
                        <dd className="text-ink">{f.value}</dd>
                      </div>
                    ))}
                  </dl>

                  <p className="mt-6 text-[22px] font-medium tracking-[-0.02em] text-ink tabular-nums">{formatMoney(p.price)}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
                    {p.variants ? (
                      <Link href={productHref(p)} className="cta">
                        Alege modelul <Arrow />
                      </Link>
                    ) : (
                      <>
                        <AddToCartButton productId={p.id} />
                        <Link href={productHref(p)} className="tlink">
                          Detalii produs <Arrow />
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
