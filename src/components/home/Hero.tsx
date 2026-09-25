import Link from 'next/link'
import { ProductShot } from '@/components/product/ProductShot'
import { Idx } from '@/components/ui/Idx'
import { Arrow } from '@/components/ui/icons'
import { productHref, products } from '@/content/catalog'
import { terms } from '@/config/site'
import { formatMoney } from '@/lib/money'

/**
 * Dark hero with the product line-up on a frame that bridges into the page,
 * the same device curs.neuros.ro uses for its video. Here the frame holds the store.
 */
export function Hero() {
  return (
    <section className="on-dark bg-dark pt-[calc(var(--nav-h)+64px)] text-white max-sm:pt-[calc(var(--nav-h)+28px)]">
      <div className="wrap grid items-end gap-y-6 md:grid-cols-12 md:gap-x-6">
        <div className="md:col-span-7">
          <Idx n="Magazin" className="rev">
            Dispozitive de wellness
          </Idx>
          <h1 className="h1 rev !text-white">
            Tehnologie pentru <em className="not-italic text-cyan">minte și corp</em>, de folosit acasă.
          </h1>
        </div>
        <div className="rev md:col-span-5 md:col-start-8 lg:col-span-4 lg:col-start-9">
          <p className="max-w-[22em] text-[17px] text-dark-muted max-sm:text-[16px]">
            Trei produse pentru relaxare, focus și ore lungi la ecran. Le comanzi online, iar livrarea e gratuită.
          </p>
          <a href="#produse" className="cta mt-6 w-full max-md:w-auto max-sm:w-full">
            Alege produsul <Arrow />
          </a>
          <p className="mt-3 text-[14px] text-dark-muted max-sm:text-center">
            Retur în {terms.returnDays} zile · Garanție {terms.warrantyYears} ani
          </p>
        </div>
      </div>

      <div className="mt-14 bg-[linear-gradient(var(--color-dark)_0_46%,var(--color-paper)_46%)] max-sm:mt-10">
        <div className="wrap">
          <div className="rev rounded-[22px] bg-dark-3 p-2 shadow-[0_60px_100px_-70px_rgba(8,17,19,.95)]">
            <ul className="grid overflow-hidden rounded-[15px] bg-paper md:grid-cols-3">
              {products.map((p, i) => (
                <li key={p.id} className="border-mist-2 max-md:[&+li]:border-t md:[&+li]:border-l">
                  <Link
                    href={productHref(p)}
                    className="group grid h-full grid-cols-[112px_1fr] items-center gap-4 p-3 text-ink sm:grid-cols-[140px_1fr] md:flex md:flex-col md:items-stretch md:gap-0 md:p-3 md:pb-6"
                  >
                    <span className="block aspect-[4/3] overflow-hidden rounded-[12px]">
                      <span className="block h-full transition-transform duration-500 ease-[var(--ease-brand)] group-hover:scale-[1.03]">
                        <ProductShot
                          image={p.cutout}
                          sizes="(min-width: 768px) 360px, 140px"
                          inset="md"
                          priority={i === 0}
                        />
                      </span>
                    </span>
                    <span className="flex flex-col md:flex-1 md:px-3 md:pt-5">
                      <span className="mono block !text-[11px] !text-cyan-700">
                        0{i + 1} · {p.category}
                      </span>
                      <span className="mt-1.5 flex items-center justify-between gap-3">
                        <span className="text-[19px] font-medium tracking-[-0.02em] md:text-[21px]">{p.name}</span>
                      </span>
                      <span className="mt-0.5 hidden text-[15px] leading-snug text-muted sm:block">{p.tagline}</span>
                      <span className="mt-2 flex items-center justify-between md:mt-auto md:pt-4">
                        <span className="text-[15px] font-medium tabular-nums">{formatMoney(p.price)}</span>
                        <span className="flex items-center gap-1.5 text-[14px] font-medium text-muted transition-colors group-hover:text-ink">
                          <span className="max-sm:sr-only">Detalii</span>
                          <Arrow className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
