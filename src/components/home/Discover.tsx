import Image from 'next/image'
import Link from 'next/link'
import { AddToCartButton } from '@/components/cart/AddToCartButton'
import { Price } from '@/components/cart/Price'
import { PromoNote } from '@/components/cart/PromoNote'
import { Arrow } from '@/components/ui/icons'
import { productHref, products } from '@/content/catalog'
import { terms } from '@/config/site'

/**
 * The four products, straight after the photograph, on one aligned row (two on tablets). Each card
 * answers in one glance: what it is for, its name, what it is, price, offer, and one action. Products
 * without a choice to make go straight to the cart; the others open their picker.
 */
export function Discover() {
  return (
    <section id="produse" aria-labelledby="produse-title" className="relative z-10 -mt-[132px] scroll-mt-[calc(var(--nav-h)+16px)] max-md:-mt-[88px]">
      <h2 id="produse-title" className="sr-only">
        Produse
      </h2>
      <ul className="wrap grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
        {products.map((p) => {
          const choose = !!p.variants?.length
          return (
            <li key={p.id} className="flex flex-col overflow-hidden rounded-[20px] bg-paper shadow-[0_30px_60px_-40px_rgba(8,17,19,.45)]">
              {/* Phones: image beside the text, so four products fit in little more than a screen. */}
              <Link href={productHref(p)} className="group grid flex-1 grid-cols-[112px_1fr] items-center gap-4 px-5 pt-5 sm:flex sm:flex-col sm:items-stretch sm:gap-0">
                <span className="sm:order-2 sm:mt-3 max-sm:row-span-1">
                  <span className="relative block aspect-square rounded-[14px] bg-mist sm:aspect-[4/3]">
                  <Image
                    src={p.cutout.src}
                    alt={p.cutout.alt}
                    fill
                    sizes="(min-width: 1152px) 260px, (min-width: 640px) 45vw, 90vw"
                    className={`object-contain p-[10%] transition-transform duration-300 ease-[var(--ease-brand)] group-hover:scale-[1.04] ${p.cutout.bleed === 'bottom' ? 'object-bottom pb-0' : ''}`}
                  />
                  </span>
                </span>
                <span className="block sm:order-1">
                  <span className="block text-[14px] font-medium text-cyan-700">{p.purpose}</span>
                  <span className="mt-1 block text-[24px] leading-tight font-medium tracking-[-0.03em] text-ink group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4 sm:text-[26px]">
                    {p.name}
                  </span>
                  <span className="mt-1 block text-[15px] leading-snug text-muted sm:min-h-[2.8em]">{p.kind}</span>
                </span>
              </Link>
              <div className="px-5 pt-4 pb-5">
                <div className="flex items-center justify-between gap-3 sm:block">
                  <p className="text-[20px] font-medium tracking-[-0.02em] text-ink tabular-nums">
                    <Price productId={p.id} />
                  </p>
                  <PromoNote productId={p.id} className="sm:mt-2" />
                </div>
                <div className="mt-4">
                  {choose ? (
                    <Link href={`${productHref(p)}#cumpara`} className="cta sm w-full">
                      {p.chooseLabel ?? 'Alege varianta'} <Arrow />
                    </Link>
                  ) : (
                    <AddToCartButton productId={p.id} size="sm" className="w-full" />
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      <ul className="wrap mt-8 grid gap-x-6 gap-y-2 text-[15px] text-text sm:grid-cols-2 lg:flex lg:justify-between">
        <li>✓ Plată cu cardul (Stripe) sau prin transfer bancar</li>
        <li>✓ Livrare gratuită în România</li>
        <li>✓ Retur în {terms.returnDays} zile</li>
        <li>✓ Garanție {terms.warrantyYears} ani</li>
      </ul>
    </section>
  )
}
