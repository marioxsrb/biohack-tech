import type { Metadata } from 'next'
import Link from 'next/link'
import { AddToCartButton } from '@/components/cart/AddToCartButton'
import { Compare } from '@/components/home/Compare'
import { ProductShot } from '@/components/product/ProductShot'
import { ContactBlock } from '@/components/site/ContactBlock'
import { Arrow } from '@/components/ui/icons'
import { productHref, products } from '@/content/catalog'
import { terms } from '@/config/site'
import { formatMoney } from '@/lib/money'
import { pageMetadata } from '@/lib/seo'

export const metadata: Metadata = pageMetadata({
  title: 'Produse: Balance Wave, BrainLink Pro, Ochelari Biohack',
  description:
    'Toate produsele Biohack Tech, cu prețuri și diferențele dintre ele: Balance Wave, BrainLink Pro și Ochelari Biohack. Livrare gratuită în România.',
  path: '/products',
})

export default function ProductsPage() {
  return (
    <>
      <section className="pt-[calc(var(--nav-h)+64px)] pb-[var(--sec)] max-sm:pt-[calc(var(--nav-h)+32px)]">
        <div className="wrap">
          <div className="grid items-end gap-y-4 md:grid-cols-12 md:gap-x-6">
            <div className="md:col-span-7">
              <p className="idx" data-n="Magazin">
                <i aria-hidden />
                {products.length} produse
              </p>
              <h1 className="h1">Produse</h1>
            </div>
            <p className="sub md:col-span-5 md:col-start-8 lg:col-span-4 lg:col-start-9">
              {terms.shipping}. Retur în {terms.returnDays} zile și garanție {terms.warrantyYears} ani pentru fiecare produs.
            </p>
          </div>

          <ul className="mt-12 grid gap-x-6 gap-y-12 max-md:mt-8 md:grid-cols-3">
            {products.map((p, i) => (
              <li key={p.id} className="rev flex flex-col">
                <Link href={productHref(p)} className="group block">
                  <span className="block aspect-[4/3] overflow-hidden rounded-[16px]">
                    <span className="block h-full transition-transform duration-500 ease-[var(--ease-brand)] group-hover:scale-[1.03]">
                      <ProductShot image={p.cutout} sizes="(min-width: 1152px) 360px, (min-width: 768px) 32vw, 100vw" inset="md" priority={i === 0} />
                    </span>
                  </span>
                  <span className="mono mt-5 block !text-[11px] !text-cyan-700">{p.category}</span>
                  <h2 className="mt-1.5 text-[24px] leading-tight tracking-[-0.03em] group-hover:underline">{p.name}</h2>
                </Link>
                <p className="mt-2 text-[15.5px] text-muted">{p.summary}</p>
                <div className="mt-auto flex items-center justify-between gap-4 pt-5">
                  <span className="text-[19px] font-medium tracking-[-0.015em] text-ink tabular-nums">{formatMoney(p.price)}</span>
                  {p.variants ? (
                    <Link href={productHref(p)} className="btn2 sm">
                      Alege modelul <Arrow />
                    </Link>
                  ) : (
                    <AddToCartButton productId={p.id} size="sm" />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Compare index="01" />

      <section className="py-[var(--sec)]">
        <div className="wrap">
          <ContactBlock />
        </div>
      </section>
    </>
  )
}
